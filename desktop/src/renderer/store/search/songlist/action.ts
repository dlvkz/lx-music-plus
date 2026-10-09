import { markRawList } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'
import { sortInsert, similar } from '@common/utils/common'
import { getSearchText } from '@renderer/utils/translate'

import type { ListInfoItem } from './state'
import { sources, maxPages, listInfos } from './state'
import { searchSoundcloudPlaylists, searchYoutubePlaylists, type SecondaryPlaylistResult } from '@renderer/utils/secondarySources'
// sets the requests / yt-dlp of the secondary sources (through node)
import '@renderer/utils/secondaryAudio'

const SECONDARY_LIMIT = 10
const SECONDARY_TIMEOUT = 12000
const SECONDARY_PLAYLIST_SEARCHES = [
  ['sc', searchSoundcloudPlaylists],
  ['yt', searchYoutubePlaylists],
] as const

/**
 * The playlists of the secondary sources (SoundCloud, YouTube) that answer in time, as the results of a source
 */
const searchSecondaryPlaylists = async(text: string): Promise<SearchResult[]> => {
  return Promise.all(SECONDARY_PLAYLIST_SEARCHES.map(async([source, searchPlaylists]) => {
    const list = await Promise.race([
      searchPlaylists(text, SECONDARY_LIMIT).catch((err: unknown) => {
        console.log(err)
        return [] as SecondaryPlaylistResult[]
      }),
      new Promise<SecondaryPlaylistResult[]>(resolve => setTimeout(() => { resolve([]) }, SECONDARY_TIMEOUT)),
    ])
    return {
      list: list.map(p => ({ id: p.id, name: p.name, author: p.author, img: p.img ?? '', source: p.source as LX.OnlineSource, total: p.total == null ? undefined : String(p.total) })) as unknown as ListInfoItem[],
      total: list.length,
      limit: Math.max(1, list.length),
      source: source as LX.OnlineSource,
    }
  }))
}

interface SearchResult {
  list: ListInfoItem[]
  limit: number
  total: number
  source: LX.OnlineSource
}


/**
 * 按搜索关键词重新排序列表
 * @param list 歌曲列表
 * @param keyword 搜索关键词
 * @returns 排序后的列表
 */
const handleSortList = (list: ListInfoItem[], keyword: string) => {
  let arr: any[] = []
  for (const item of list) {
    sortInsert(arr, {
      num: similar(keyword, item.name),
      data: item,
    })
  }
  return arr.map(item => item.data).reverse()
}


let maxTotals: Partial<Record<LX.OnlineSource, number>> = {

}
const setLists = (results: SearchResult[], page: number, text: string): ListInfoItem[] => {
  let totals = []
  let limit = 0
  let list = []
  for (const source of results) {
    list.push(...source.list)
    totals.push(source.total)
    maxTotals[source.source] = source.total
    maxPages[source.source] = Math.ceil(source.total / source.limit)
    limit = Math.max(source.limit, limit)
  }
  markRawList(list)

  let listInfo = listInfos.all
  const total = Math.max(0, ...totals)
  if (page == 1 || (total && list.length)) listInfo.total = total
  else listInfo.total = limit * page
  listInfo.page = page
  listInfo.list = handleSortList(list, text)
  if (text && !list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

const setList = (datas: SearchResult, page: number, text: string): ListInfoItem[] => {
  // console.log(datas.source, datas.list)
  let listInfo = listInfos[datas.source]!
  listInfo.list = markRawList(datas.list)
  if (page == 1 || (datas.total && datas.list.length)) listInfo.total = datas.total
  else listInfo.total = datas.limit * page
  listInfo.page = page
  listInfo.limit = datas.limit
  if (text && !datas.list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

export const resetListInfo = (sourceId: LX.OnlineSource | 'all'): [] => {
  let listInfo = listInfos[sourceId]
  if (!listInfo) return []
  listInfo.page = 1
  listInfo.limit = 20
  listInfo.total = 0
  listInfo.list = []
  listInfo.key = null
  listInfo.noItemLabel = ''
  listInfo.tagId = ''
  listInfo.sortId = ''
  return []
}

export const search = async(text: string, page: number, sourceId: LX.OnlineSource | 'all'): Promise<ListInfoItem[]> => {
  const listInfo = listInfos[sourceId]!
  if (!text) return resetListInfo(sourceId)
  const searchText = await getSearchText(text)
  const key = `${page}__${sourceId}__${searchText}`
  if (listInfo.key == key && listInfo.list.length) return listInfo.list
  if (sourceId == 'all') {
    listInfo.noItemLabel = window.i18n.t('list__loading')
    listInfo.key = key
    let task = []
    for (const source of sources) {
      if (source == 'all' || (page > 1 && page > (maxPages[source]!))) continue
      task.push((music[source]?.songList.search(searchText, page, listInfos.all.limit) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          list: [],
          total: 0,
          limit: listInfos.all.limit,
          source,
        }
      }))
    }
    // the secondary sources on the first page, searched with the words typed (the translation is for the main sources)
    const secondaryTask = page == 1 ? searchSecondaryPlaylists(text) : Promise.resolve([])
    return Promise.all([Promise.all(task), secondaryTask]).then(([mainResults, secondaryResults]) => {
      if (key != listInfo.key) return []
      return setLists([...mainResults, ...secondaryResults] as SearchResult[], page, searchText)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo.noItemLabel = window.i18n.t('list__loading')
    listInfo.key = key
    return (music[sourceId]?.songList.search(searchText, page, listInfo.limit).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setList(data, page, searchText)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((error: any) => {
      resetListInfo(sourceId)
      listInfo.noItemLabel = window.i18n.t('list__load_failed')
      console.log(error)
      throw error
    })
  }
}

