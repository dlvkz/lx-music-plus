import { getSearchText } from '@/utils/translate'
import searchSonglistState, { type Source, type ListInfoItem } from '@/store/search/songlist/state'
import searchSonglistActions, { type SearchResult } from '@/store/search/songlist/action'
import musicSdk from '@/utils/musicSdk'
import { searchSoundcloudPlaylists, searchYoutubePlaylists, type SecondaryPlaylistResult } from '@/utils/secondarySources'
// sets the yt-dlp of the YouTube source
import '@/core/music/secondary'

const SECONDARY_LIMIT = 10
const SECONDARY_TIMEOUT = 12000
const SECONDARY_PLAYLIST_SEARCHES = [
  ['sc', searchSoundcloudPlaylists],
  ['yt', searchYoutubePlaylists],
] as const

const toSearchResult = (source: string, list: SecondaryPlaylistResult[]): SearchResult => ({
  list: list.map(p => ({ id: p.id, name: p.name, author: p.author, img: p.img ?? undefined, source: p.source as LX.OnlineSource, total: p.total == null ? undefined : String(p.total) })),
  total: list.length,
  limit: Math.max(1, list.length),
  source: source as LX.OnlineSource,
})

/**
 * The playlists of the secondary sources (SoundCloud, YouTube) that answer in time, as the results of a source;
 * the ones that answer later are given to `onLate` (YouTube: yt-dlp is slow to start on a phone)
 */
const searchSecondaryPlaylists = async(text: string, onLate: (result: SearchResult) => void): Promise<SearchResult[]> => {
  return Promise.all(SECONDARY_PLAYLIST_SEARCHES.map(async([source, searchPlaylists]) => {
    const task = searchPlaylists(text, SECONDARY_LIMIT).catch((err: unknown) => {
      console.log(err)
      return [] as SecondaryPlaylistResult[]
    })
    let isLate = false
    const list = await Promise.race([
      task,
      new Promise<SecondaryPlaylistResult[]>(resolve => setTimeout(() => {
        isLate = true
        resolve([])
      }, SECONDARY_TIMEOUT)),
    ])
    if (isLate) {
      void task.then(lateList => {
        if (lateList.length) onLate(toSearchResult(source, lateList))
      })
    }
    return toSearchResult(source, list)
  }))
}

export const setSource: typeof searchSonglistActions['setSource'] = (source) => {
  searchSonglistActions.setSource(source)
}
export const setSearchText: typeof searchSonglistActions['setSearchText'] = (text) => {
  searchSonglistActions.setSearchText(text)
}
const setListInfo: typeof searchSonglistActions.setListInfo = (result, page, text) => {
  return searchSonglistActions.setListInfo(result, page, text)
}

export const clearListInfo: typeof searchSonglistActions.clearListInfo = (source) => {
  searchSonglistActions.clearListInfo(source)
}


export const search = async(text: string, page: number, sourceId: Source): Promise<ListInfoItem[]> => {
  const listInfo = searchSonglistState.listInfos[sourceId]!
  // if (!text) return []
  // the term may be translated first (search switch), the results are kept under the term really searched
  const searchText = text ? await getSearchText(text) : text
  const key = `${page}__${sourceId}__${searchText}`
  if (listInfo.key == key && listInfo.list.length) return listInfo.list
  if (sourceId == 'all') {
    listInfo.key = key
    let task = []
    for (const source of searchSonglistState.sources) {
      if (source == 'all' || (page > 1 && page > (searchSonglistState.maxPages[source]!))) continue
      task.push(((musicSdk[source]?.songList.search(searchText, page, searchSonglistState.listInfos.all.limit) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          list: [],
          total: 0,
          limit: searchSonglistState.listInfos.all.limit,
          source,
        }
      }))
    }
    // the secondary sources on the first page, searched with the words typed (the translation is for the main sources)
    const secondaryTask = page == 1 && text
      ? searchSecondaryPlaylists(text, (result) => {
        // still the same search: the playlists are added at the end
        if (key != listInfo.key) return
        const ids = new Set(listInfo.list.map(item => `${item.source}_${item.id}`))
        listInfo.list = [...listInfo.list, ...result.list.filter(item => !ids.has(`${item.source}_${item.id}`))]
        global.app_event.searchSonglistUpdated()
      })
      : Promise.resolve([])
    return Promise.all([Promise.all(task), secondaryTask]).then(([mainResults, secondaryResults]) => {
      const results: SearchResult[] = [...mainResults, ...secondaryResults]
      if (key != listInfo.key) return []
      setSearchText(text)
      setSource(sourceId)
      return setListInfo(results, page, text)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo.key = key
    return ((musicSdk[sourceId]?.songList.search(searchText, page, listInfo.limit) as Promise<SearchResult>).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setListInfo(data, page, text)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((err: any) => {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}
