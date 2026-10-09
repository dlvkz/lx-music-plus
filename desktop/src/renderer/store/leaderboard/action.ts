import { getCache, setCache } from '@renderer/utils/dataCache'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { markRaw, markRawList } from '@common/utils/vueTools'
import { boards, type Board, listDetailInfo, type ListDetailInfo } from './state'
import { getChartBoards, getChartSongs, isChartSource } from '@renderer/utils/chartSources'
import { assertApiSupport } from '@renderer/store/utils'
// sets the requests of the secondary sources (through node)
import '@renderer/utils/secondaryAudio'

// the charts of Spotify / SoundCloud (utils/chartSources.ts): the songs of Spotify are looked for on these sources
const CHART_SEARCH_SOURCES = ['wy', 'kw']
const chartSearch = async(source: string, text: string) => {
  const result = await musicSdk[source as LX.OnlineSource]?.musicSearch.search(text, 1, 10)
  return markRawList((result?.list ?? []).map((m: any) => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[])
}
const getChartDetail = async(source: string, bangId: string): Promise<ListDetailInfo> => {
  if (!isChartSource(source)) throw new Error('not a chart source: ' + source)
  const list = await getChartSongs(source, bangId, chartSearch, CHART_SEARCH_SOURCES, s => assertApiSupport(s as LX.Source))
  return { list: markRawList(list), total: list.length, limit: Math.max(1, list.length), page: 1, source: source as LX.OnlineSource } as unknown as ListDetailInfo
}

const cache = new Map<string, any>()
const CACHE_PREFIX = 'leaderboard:'

export const setBoard = (board: Board, source: LX.OnlineSource) => {
  boards[source] = markRaw(board)
}

export const setListDetail = (result: ListDetailInfo, id: string, page: number) => {
  listDetailInfo.list = markRaw([...result.list])
  listDetailInfo.id = id
  listDetailInfo.source = result.source
  if (page == 1 || (result.total && result.list.length)) listDetailInfo.total = result.total
  else listDetailInfo.total = result.limit * page
  listDetailInfo.limit = result.limit
  listDetailInfo.page = page

  if (result.list.length) listDetailInfo.noItemLabel = ''
  else if (page == 1) listDetailInfo.noItemLabel = window.i18n.t('no_item')
}
export const clearListDetail = () => {
  listDetailInfo.list = []
  listDetailInfo.id = ''
  listDetailInfo.source = null
  listDetailInfo.total = 0
  listDetailInfo.limit = 30
  listDetailInfo.page = 1
  listDetailInfo.key = null
  listDetailInfo.noItemLabel = ''
}

export const getBoardsList = async(source: LX.OnlineSource) => {
  const result = isChartSource(source)
    ? { list: await getChartBoards(source), source } as unknown as Board
    : await (musicSdk[source]?.leaderboard.getBoards() as Promise<Board>)
  if (result?.list.length) setCache(`${CACHE_PREFIX}boards__${source}`, result)
  return result
}

/**
 * The charts of the source as they were last time, shown until the new ones are loaded
 */
export const getCachedBoardsList = (source: LX.OnlineSource) => getCache<Board>(`${CACHE_PREFIX}boards__${source}`)

/**
 * 获取排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  // let [source, bangId] = tabId.split('__')
  // if (!bangId) return
  let key = `${id}__${page}`

  if (!isRefresh && cache.has(key)) return cache.get(key)

  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]

  if (isChartSource(source)) {
    const result = await getChartDetail(source, bangId)
    cache.set(key, result)
    return result
  }

  return musicSdk[source]?.leaderboard?.getList(bangId, page).then((result: ListDetailInfo) => {
    result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
    cache.set(key, result)
    return result
  })
}


/**
 * 获取排行榜内全部歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  const [source, bangId] = id.split('__') as [LX.OnlineSource, string]
  // console.log(source, id)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const loadData = async(id: string, page: number): Promise<ListDetailInfo> => {
    let key = `${source}__${id}__${page}`
    if (!isRefresh && cache.has(key)) return cache.get(key)
    if (isChartSource(source)) {
      const result = await getChartDetail(source, id)
      cache.set(key, result)
      return result
    }

    return musicSdk[source]?.leaderboard.getList(id, page).then((result: ListDetailInfo) => {
      result.list = markRawList(deduplicationList(result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]))
      cache.set(key, result)
      return result
    }) ?? Promise.reject(new Error('source not found' + source))
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return loadData(bangId, 1).then((result: ListDetailInfo) => {
    if (result.total <= result.limit) return result.list

    let maxPage = Math.ceil(result.total / result.limit)
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const loadDetail = (loadPage = 2): Promise<ListDetailInfo['list']> => {
      return loadPage == maxPage
        ? loadData(bangId, loadPage).then((result: ListDetailInfo) => result.list)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        : loadData(bangId, loadPage).then((result1: ListDetailInfo) => loadDetail(++loadPage).then((result2: ListDetailInfo['list']) => [...result1.list, ...result2]))
    }
    return loadDetail().then(result2 => [...result.list, ...result2])
  }).then((list: ListDetailInfo['list']) => deduplicationList(list))
}


/**
 * 获取并设置排行榜内单页歌曲
 * @param id 排行榜id  {souce}__{id}
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetListDetail = async(id: string, page: number, isRefresh = false) => {
  // let [source, bangId] = tabId.split('__')
  // if (!bangId) return
  let key = `${id}__${page}`

  if (!isRefresh && listDetailInfo.key == key && listDetailInfo.list.length) return

  // the songs the chart had last time (kept between the runs of the app) are shown while it loads
  const cacheKey = `${CACHE_PREFIX}detail__${id}`
  const cached = page == 1 ? getCache<ListDetailInfo>(cacheKey) : null
  listDetailInfo.key = key
  if (cached?.list.length) setListDetail(cached, id, page)
  else listDetailInfo.noItemLabel = window.i18n.t('list__loading')

  return getListDetail(id, page, isRefresh).then((result: ListDetailInfo) => {
    if (page == 1 && result.list.length) setCache(cacheKey, result)
    if (key != listDetailInfo.key) return
    if (!result.list.length && cached?.list.length) return
    setListDetail(result, id, page)
  }).catch((error: any) => {
    if (key == listDetailInfo.key && !cached?.list.length) {
      clearListDetail()
      listDetailInfo.noItemLabel = window.i18n.t('list__load_failed')
    }
    console.log(error)
    throw error
  })
}
