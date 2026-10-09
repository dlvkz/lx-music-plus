import { SECONDARY_SOURCES, coversAllWords, mergeSameSongs, relevanceScore, reorderedQueries, searchSecondary, songKey } from '@/utils/secondarySources'
import settingState from '@/store/setting/state'
import { assertApiSupport } from '@/utils/tools'
import { toNewMusicInfo } from '@/utils'
// sets the yt-dlp of the YouTube source
import '@/core/music/secondary'
import { getSearchText } from '@/utils/translate'
import searchMusicState, { type Source } from '@/store/search/music/state'
import searchMusicActions, { type SearchResult } from '@/store/search/music/action'
import musicSdk from '@/utils/musicSdk'

export const setSource: typeof searchMusicActions['setSource'] = (source) => {
  searchMusicActions.setSource(source)
}
export const setSearchText: typeof searchMusicActions['setSearchText'] = (text) => {
  searchMusicActions.setSearchText(text)
}
export const setListInfo: typeof searchMusicActions.setListInfo = (result, id, page) => {
  return searchMusicActions.setListInfo(result, id, page)
}

export const clearListInfo: typeof searchMusicActions.clearListInfo = (source) => {
  searchMusicActions.clearListInfo(source)
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
 * Songs of the main sources for these searches (first page)
 */
const searchMainReordered = async(queries: string[]): Promise<LX.Music.MusicInfoOnline[]> => {
  const tasks = queries.flatMap(query => searchMusicState.sources.filter(source => source != 'all').map(async source => {
    try {
      const result = await (musicSdk[source]?.musicSearch.search(query, 1, searchMusicState.listInfos.all.limit) as Promise<SearchResult> | undefined)
      return result?.list ?? []
    } catch (err) {
      console.log(err)
      return []
    }
  }))
  return (await Promise.all(tasks)).flat().map(m => toNewMusicInfo(m) as LX.Music.MusicInfoOnline)
}

export const search = async(text: string, page: number, sourceId: Source): Promise<LX.Music.MusicInfoOnline[]> => {
  const listInfo = searchMusicState.listInfos[sourceId]!
  if (!text) return []
  // the term may be translated first (search switch), the results are kept under the term really searched
  const searchText = await getSearchText(text)
  const key = `${page}__${searchText}`
  if (sourceId == 'all') {
    listInfo.key = key
    let task = []
    for (const source of searchMusicState.sources) {
      if (source == 'all') continue
      task.push(((musicSdk[source]?.musicSearch.search(searchText, page, searchMusicState.listInfos.all.limit) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
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
    // the secondary sources (SoundCloud, Bandcamp, KHInsider): their songs come after the ones of the
    // main sources, without the songs the main sources have already (those are exact by their id)
    // the secondary sources are searched with the words typed: the translation of the search
    // (search switch) is meant for the main sources
    const secondaryTask = page == 1 ? searchSecondarySources(text) : Promise.resolve([])
    return Promise.all([Promise.all(task), secondaryTask]).then(async([results, secondaryList]) => {
      if (key != listInfo.key) return []
      setSearchText(text)
      setSource(sourceId)
      let list = setListInfo(results, page, text)
      // no main song with all the words: the main sources may find it with the words in another order
      if (page == 1 && !list.some(m => coversAllWords(text, m.name, m.singer))) {
        // (the words typed too when the search was translated: a translation can lose the names)
        const queries = reorderedQueries(text, secondaryList)
        if (searchText != text) queries.unshift(text)
        const found = await searchMainReordered(queries)
        if (key != listInfo.key) return []
        const ids = new Set(list.map(m => m.id))
        const matched = found.filter(m => {
          if (ids.has(m.id) || !coversAllWords(text, m.name, m.singer)) return false
          ids.add(m.id)
          return true
        })
        if (matched.length) list = listInfo.list = [...matched, ...list]
      }
      // sources not shown: one result per song, played from NetEase, then Kuwo, then the other copies
      if (!settingState.setting['common.isShowSourceSwitch']) list = listInfo.list = mergeSameSongs(list, source => assertApiSupport(source as LX.Source))
      if (!secondaryList.length) return list
      const keys = new Set(list.map(m => songKey(m.name, m.singer)))
      const extra = secondaryList.filter(m => !keys.has(songKey(m.name, m.singer)))
      listInfo.list = mergeByRelevance(list, extra, text)
      return listInfo.list
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo.key = key
    return (musicSdk[sourceId]?.musicSearch.search(searchText, page, listInfo.limit).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setListInfo(data, page, text)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((err: any) => {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}

