import { getCache, setCache } from '@renderer/utils/dataCache'
import { getSecondaryPlaylist, isSecondarySource } from '@renderer/utils/secondarySources'
// sets the requests of the secondary sources (through node)
import '@renderer/utils/secondaryAudio'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import musicSdk from '@renderer/utils/musicSdk'
import { markRaw, markRawList } from '@common/utils/vueTools'
import {
  tags,
  listInfo,
  listDetailInfo,
  selectListInfo,
  isVisibleListDetail,
  openSongListInputInfo,
} from './state'
import type {
  ListDetailInfo,
  ListInfoItem,
  ListInfo,
  TagInfo,
} from './state'

const cache = new Map<string, any>()
const CACHE_PREFIX = 'songlist:'

export const setTags = (tagInfo: TagInfo, source: LX.OnlineSource) => {
  tags[source] = markRaw(tagInfo)
}

export const clearList = () => {
  listInfo.list = []
  listInfo.total = 0
  listInfo.noItemLabel = ''
  listInfo.page = 1
  listInfo.key = ''
}

export const setList = (result: ListInfo, tagId: string, sortId: string, page: number) => {
  listInfo.list = markRaw([...result.list])
  if (page == 1 || (result.total && result.list.length)) listInfo.total = result.total
  else listInfo.total = result.limit * page
  listInfo.limit = result.limit
  listInfo.page = page
  listInfo.source = result.source
  listInfo.tagId = tagId
  listInfo.sortId = sortId
  if (result.list.length) listInfo.noItemLabel = ''
  else if (page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
}
export const setListDetail = (result: ListDetailInfo, id: string, page: number) => {
  listDetailInfo.list = markRaw([...result.list])
  listDetailInfo.id = id
  listDetailInfo.source = result.source
  if (page == 1 || (result.total && result.list.length)) listDetailInfo.total = result.total
  else listDetailInfo.total = result.limit * page
  listDetailInfo.limit = result.limit
  listDetailInfo.page = page
  listDetailInfo.info = markRaw({ ...result.info })
  if (result.list.length) listDetailInfo.noItemLabel = ''
  else if (page == 1) listDetailInfo.noItemLabel = window.i18n.t('no_item')
}

export const setSelectListInfo = (info: ListInfoItem) => {
  selectListInfo.author = info.author
  selectListInfo.desc = info.desc
  selectListInfo.id = info.id
  selectListInfo.img = info.img
  selectListInfo.name = info.name
  selectListInfo.play_count = info.play_count
  selectListInfo.source = info.source
}
export const clearListDetail = () => {
  listDetailInfo.list = []
  listDetailInfo.id = ''
  listDetailInfo.source = 'kw'
  listDetailInfo.total = 0
  listDetailInfo.limit = 30
  listDetailInfo.page = 1
  listDetailInfo.key = null
  listDetailInfo.info = {}
  listDetailInfo.noItemLabel = ''
}

export const getTags = async<T extends LX.OnlineSource>(source: T) => {
  return musicSdk[source]?.songList.getTags() as Promise<TagInfo<T>>
}


/**
 * 获取歌单列表
 * @param source 歌单源
 * @param tabId 类型id
 * @param sortId 排序
 * @param page 页数
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetList = async(source: LX.OnlineSource, tabId: string, sortId: string, page: number, isRefresh = false) => {
  // let source = rootState.setting.songList.source
  // let tabId = rootState.setting.songList.tagInfo.id
  // let sortId = rootState.setting.songList.sortId
  // console.log(sortId)
  let key = `slist__${source}__${sortId}__${tabId}__${page}`
  // if (state.list.list.length && state.list.key == key) return
  if (!isRefresh) {
    if (listInfo.key == key && listInfo.list.length) return
    if (cache.has(key)) {
      listInfo.key = key
      setList(cache.get(key), tabId, sortId, page)
      return
    }
  }
  // The playlists shown last time for this category (kept between the runs of the app) are shown
  // while the new ones load; otherwise what is shown stays until they have arrived.
  const cached = getCache<ListInfo>(CACHE_PREFIX + key)
  listInfo.key = key
  if (cached?.list.length) setList(cached, tabId, sortId, page)
  else if (!listInfo.list.length) listInfo.noItemLabel = window.i18n.t('list__loading')
  return musicSdk[source]?.songList.getList(sortId, tabId, page).then((result: ListInfo) => {
    cache.set(key, result)
    if (result.list.length) setCache(CACHE_PREFIX + key, result)
    if (key != listInfo.key) return
    // an empty answer does not replace what is shown
    if (!result.list.length && cached?.list.length) return
    setList(result, tabId, sortId, page)
  }).catch((error: any) => {
    if (key == listInfo.key && !cached?.list.length) {
      clearList()
      listInfo.noItemLabel = window.i18n.t('list__load_failed')
    }
    console.log(error)
    throw error
  })
}

// a page of a playlist: of its source, or of a secondary source (SoundCloud, YouTube: all the songs on the
// first page, converted already)
const fetchListDetail = async(source: LX.OnlineSource, id: string, page: number): Promise<ListDetailInfo> => {
  if (isSecondarySource(source)) {
    if (page > 1) return { list: [], source, total: 0, page, limit: 1, key: null, id, info: {} } as unknown as ListDetailInfo
    const playlist = await getSecondaryPlaylist(source, id)
    return {
      list: playlist.list,
      source,
      total: playlist.list.length,
      page: 1,
      limit: Math.max(1, playlist.list.length),
      key: null,
      id,
      info: { name: playlist.name, img: playlist.img ?? undefined, author: playlist.author },
    } as unknown as ListDetailInfo
  }
  const request = musicSdk[source]?.songList.getListDetail(id, page)
  if (!request) throw new Error('source not found' + source)
  return request
}

/**
 * 获取歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false): Promise<ListDetailInfo> => {
  let key = `sdetail__${source}__${id}__${page}`
  if (!isRefresh && cache.has(key)) return cache.get(key)

  return fetchListDetail(source, id, page).then((result: ListDetailInfo) => {
    result.list = markRawList(deduplicationList(result.list.map(m => (m.meta ? m : toNewMusicInfo(m))) as LX.Music.MusicInfoOnline[]))
    cache.set(key, result)
    return result
  })
}

/**
 * 获取歌单内全部歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getListDetailAll = async(id: string, source: LX.OnlineSource, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  // console.log(source, id)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const loadData = (id: string, page: number): Promise<ListDetailInfo> => {
    let key = `sdetail__${source}__${id}__${page}`
    if (isRefresh && cache.has(key)) cache.delete(key)
    return cache.has(key)
      ? Promise.resolve(cache.get(key))
      : fetchListDetail(source, id, page).then((result: ListDetailInfo) => {
        result.list = markRawList(deduplicationList(result.list.map(m => (m.meta ? m : toNewMusicInfo(m))) as LX.Music.MusicInfoOnline[]))
        cache.set(key, result)
        return result
      })
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return loadData(id, 1).then((result: ListDetailInfo) => {
    if (result.total <= result.limit) return result.list

    let maxPage = Math.ceil(result.total / result.limit)
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const loadDetail = (loadPage = 2): Promise<ListDetailInfo['list']> => {
      return loadPage == maxPage
        ? loadData(id, loadPage).then((result: ListDetailInfo) => result.list)
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        : loadData(id, loadPage).then((result1: ListDetailInfo) => loadDetail(++loadPage).then((result2: ListDetailInfo['list']) => [...result1.list, ...result2]))
    }
    return loadDetail().then(result2 => [...result.list, ...result2])
  }).then((list: ListDetailInfo['list']) => deduplicationList(list))
}


/**
 * 获取并设置歌单内单页歌曲
 * @param id 歌单id
 * @param source 歌单源
 * @param isRefresh 是否跳过缓存
 * @returns
 */
export const getAndSetListDetail = async(id: string, source: LX.OnlineSource, page: number, isRefresh = false) => {
  let key = `sdetail__${source}__${id}__${page}`

  if (!isRefresh && listDetailInfo.key == key && listDetailInfo.list.length) return

  // another playlist: don't keep showing the cover, name and songs of the previous one while it loads,
  // the songs this playlist had last time (kept between the runs of the app) are shown instead
  const cacheKey = `${CACHE_PREFIX}sdetail__${source}__${id}`
  const cached = page == 1 ? getCache<ListDetailInfo>(cacheKey) : null
  if (listDetailInfo.id != id || listDetailInfo.source != source) {
    listDetailInfo.list = []
    listDetailInfo.total = 0
    listDetailInfo.info = {}
    listDetailInfo.id = id
    listDetailInfo.source = source
  }

  listDetailInfo.key = key
  if (cached?.list.length) setListDetail(cached, id, page)
  else listDetailInfo.noItemLabel = window.i18n.t('list__loading')

  return getListDetail(id, source, page, isRefresh).then((result: ListDetailInfo) => {
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

export const setVisibleListDetail = (visible: boolean) => {
  isVisibleListDetail.value = visible
}

export const setOpenSongListInputInfo = (text: string, source: string) => {
  openSongListInputInfo.text = text
  openSongListInputInfo.source = source
}
