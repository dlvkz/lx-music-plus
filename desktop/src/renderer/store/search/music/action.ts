import { markRaw } from '@common/utils/vueTools'
import music from '@renderer/utils/musicSdk'
import { deduplicationList, toNewMusicInfo } from '@renderer/utils'
import { similar } from '@common/utils/common'
import { getSearchText } from '@renderer/utils/translate'
import { SECONDARY_SOURCES, coversAllWords, mergeSameSongs, relevanceScore, reorderedQueries, searchSecondary, songKey } from '@renderer/utils/secondarySources'
import { appSetting } from '@renderer/store/setting'
import { assertApiSupport } from '@renderer/store/utils'
// sets the requests of the secondary sources (through node)
import '@renderer/utils/secondaryAudio'

import { sources, maxPages, listInfos } from './state'

interface SearchResult {
  list: LX.Music.MusicInfo[]
  allPage: number
  limit: number
  total: number
  source: LX.OnlineSource
}


/**
 * Sort the list by how well the songs match the search: the words of the search found in the song
 * whatever their order ("glaive the prom" finds "the prom - glaive" first too), then how similar the text is
 */
const handleSortList = <T extends LX.Music.MusicInfo>(list: T[], keyword: string): T[] => {
  return list
    .map((item, index) => ({ item, index, score: relevanceScore(keyword, item.name, item.singer, false) + similar(keyword, `${item.name} ${item.singer}`) * 0.5 }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}


const setLists = (results: SearchResult[], page: number, text: string): LX.Music.MusicInfo[] => {
  let pages = []
  let totals = []
  let limit = 0
  let list = []
  for (const source of results) {
    maxPages[source.source] = source.allPage
    limit = Math.max(source.limit, limit)
    if (source.allPage < page) continue
    list.push(...source.list)
    pages.push(source.allPage)
    totals.push(source.total)
  }
  list = deduplicationList(list.map(s => markRaw(toNewMusicInfo(s))))
  let listInfo = listInfos.all
  listInfo.maxPage = Math.max(0, ...pages)
  const total = Math.max(0, ...totals)
  if (page == 1 || (total && list.length)) listInfo.total = total
  else listInfo.total = limit * page
  // listInfo.limit = limit
  listInfo.page = page
  listInfo.list = handleSortList(list, text)
  if (text && !list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

const setList = (datas: SearchResult, page: number, text: string): LX.Music.MusicInfo[] => {
  // console.log(datas.source, datas.list)
  let listInfo = listInfos[datas.source]!
  listInfo.list = deduplicationList(datas.list.map(s => markRaw(toNewMusicInfo(s))))
  if (page == 1 || (datas.total && datas.list.length)) listInfo.total = datas.total
  else listInfo.total = datas.limit * page
  listInfo.maxPage = datas.allPage
  listInfo.page = page
  listInfo.limit = datas.limit
  if (text && !datas.list.length && page == 1) listInfo.noItemLabel = window.i18n.t('no_item')
  else listInfo.noItemLabel = ''
  return listInfo.list
}

export const resetListInfo = (sourceId: LX.OnlineSource | 'all'): [] => {
  let listInfo = listInfos[sourceId]
  if (!listInfo) return []
  listInfo.list = []
  listInfo.page = 0
  listInfo.maxPage = 0
  listInfo.total = 0
  listInfo.noItemLabel = ''
  return []
}

const SECONDARY_LIMIT = 8
const SECONDARY_TIMEOUT = 8000
/**
 * Songs of the secondary sources, the ones that answer in time
 */
const searchSecondarySources = async(text: string): Promise<LX.Music.MusicInfoOnline[]> => {
  const lists = await Promise.all(SECONDARY_SOURCES.map(async source => Promise.race([
    searchSecondary(source, text, SECONDARY_LIMIT).catch((err: unknown) => {
      console.log(err)
      return []
    }),
    new Promise<LX.Music.MusicInfoOnline[]>(resolve => setTimeout(() => { resolve([]) }, SECONDARY_TIMEOUT)),
  ])))
  return lists.flat()
}

/**
 * Put the secondary songs among the main ones by how well they match the search (the main list is
 * sorted that way already), a main song stays first unless the secondary one matches clearly better
 */
const mergeByRelevance = (list: LX.Music.MusicInfoOnline[], extra: LX.Music.MusicInfoOnline[], text: string) => {
  const scored = extra.map(m => ({ m, score: relevanceScore(text, m.name, m.singer, true) })).sort((a, b) => b.score - a.score)
  const result: LX.Music.MusicInfoOnline[] = []
  let index = 0
  for (const item of list) {
    const itemScore = relevanceScore(text, item.name, item.singer, false)
    while (index < scored.length && scored[index].score > itemScore) result.push(scored[index++].m)
    result.push(item)
  }
  while (index < scored.length) result.push(scored[index++].m)
  return result
}

/**
 * Songs of the main sources for these searches (first page)
 */
const searchMainReordered = async(queries: string[]): Promise<LX.Music.MusicInfoOnline[]> => {
  const tasks = queries.flatMap(query => sources.filter(source => source != 'all').map(async source => {
    try {
      const result = await (music[source as LX.OnlineSource]?.musicSearch.search(query, 1, listInfos.all.limit) as Promise<SearchResult> | undefined)
      return result?.list ?? []
    } catch (err) {
      console.log(err)
      return []
    }
  }))
  return (await Promise.all(tasks)).flat().map(m => markRaw(toNewMusicInfo(m)) as LX.Music.MusicInfoOnline)
}

export const search = async(text: string, page: number, sourceId: LX.OnlineSource | 'all'): Promise<LX.Music.MusicInfo[]> => {
  const listInfo = listInfos[sourceId]
  if (!text) return resetListInfo(sourceId)
  const searchText = await getSearchText(text)
  const key = `${page}__${searchText}`
  if (sourceId == 'all') {
    listInfo!.noItemLabel = window.i18n.t('list__loading')
    listInfo!.key = key
    let task = []
    for (const source of sources) {
      if (source == 'all') continue
      task.push((music[source]?.musicSearch.search(searchText, page, listInfos.all.limit) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          allPage: 1,
          limit: 30,
          list: [],
          source,
          total: 0,
        }
      }))
    }
    // the secondary sources (SoundCloud, Bandcamp, KHInsider), searched with the words typed (the translation
    // of the search is meant for the main sources): their songs are put among the songs of the main sources
    // by how well they match, without the songs the main sources have already (exact by their id)
    const secondaryTask = page == 1 ? searchSecondarySources(text) : Promise.resolve([])
    return Promise.all([Promise.all(task), secondaryTask]).then(async([results, secondaryList]: [SearchResult[], LX.Music.MusicInfoOnline[]]) => {
      if (key != listInfo!.key) return []
      let list = setLists(results, page, searchText) as LX.Music.MusicInfoOnline[]
      // no main song with all the words: the main sources may find it with the words in another order
      if (page == 1 && !list.some(m => coversAllWords(text, m.name, m.singer))) {
        // (the words typed too when the search was translated: a translation can lose the names)
        const queries = reorderedQueries(text, secondaryList)
        if (searchText != text) queries.unshift(text)
        const found = await searchMainReordered(queries)
        if (key != listInfo!.key) return []
        const ids = new Set(list.map(m => m.id))
        const matched = found.filter(m => {
          if (ids.has(m.id) || !coversAllWords(text, m.name, m.singer)) return false
          ids.add(m.id)
          return true
        })
        if (matched.length) {
          list = listInfo!.list = [...matched, ...list]
          listInfo!.noItemLabel = ''
        }
      }
      // sources not shown: one result per song, played from NetEase, then Kuwo, then the other copies
      if (!appSetting['common.isShowSourceSwitch']) list = listInfo!.list = mergeSameSongs(list, source => assertApiSupport(source as LX.Source))
      if (!secondaryList.length) return list
      const keys = new Set(list.map(m => songKey(m.name, m.singer)))
      const extra = secondaryList.filter(m => !keys.has(songKey(m.name, m.singer))).map(m => markRaw(m))
      listInfo!.list = mergeByRelevance(list, extra, text)
      if (listInfo!.list.length) listInfo!.noItemLabel = ''
      return listInfo!.list
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo!.noItemLabel = window.i18n.t('list__loading')
    listInfo!.key = key
    return music[sourceId].musicSearch.search(searchText, page, listInfo!.limit).then((data: SearchResult) => {
      if (key != listInfo!.key) return []
      return setList(data, page, searchText)
    }).catch((error: any) => {
      resetListInfo(sourceId)
      listInfo!.noItemLabel = window.i18n.t('list__load_failed')
      console.log(error)
      throw error
    })
  }
}

