import { getCache, getCacheTime, setCache } from '@renderer/utils/dataCache'
import musicSdk from '@renderer/utils/musicSdk'
import { assertApiSupport } from '@renderer/store/utils'
import { getListDetail as getBoardDetail } from '@renderer/store/leaderboard/action'
import { getTags } from '@renderer/store/songList/action'
import { getList as getHotSearchList } from '@renderer/store/hotSearch'
import { getListMusics } from '@renderer/store/list/action'
import { LIST_IDS } from '@common/constants'
import { getListenStats, getRangeFrom } from '@renderer/utils/listenStats'
import { getArtistsForYou as getSimilarToTop, getMixedAlbums, getMixedArtists, getMixedPlaylists, type HomeAlbum, type HomeArtist, type HomePlaylist } from '@renderer/utils/homeCurated'

// The home page gathers data that needs no account: playlists / artists / albums of NetEase, Deezer,
// SoundCloud and Spotify mixed, artists for the user (Last.fm / Deezer), songs from the charts of NetEase
export const HOME_SOURCE: LX.OnlineSource = 'wy'

// hot / new / soaring charts
const CHART_SETS = {
  wy: [
    { id: 'wy__3778678', name: '热歌榜' },
    { id: 'wy__3779629', name: '新歌榜' },
    { id: 'wy__19723756', name: '飙升榜' },
  ],
  kw: [
    { id: 'kw__16', name: '热歌榜' },
    { id: 'kw__17', name: '新歌榜' },
    { id: 'kw__93', name: '飙升榜' },
  ],
  // the app not in Chinese: global charts (Spotify / Deezer, their songs found on the main sources)
  global: [
    { id: 'sp__37i9dQZEVXbMDoHDwVN2tF', name: 'Top 50 - Global' },
    { id: 'sp__37i9dQZF1DX4JAvHpjipBk', name: 'New Music Friday' },
    { id: 'dz__3155776842', name: 'Top Worldwide' },
  ],
}
/**
 * Charts shown on the home page: kuwo's when the music api can play kuwo songs but not netease ones,
 * so the songs can be played directly
 */
export const getCharts = () => {
  if (!String(window.i18n.locale ?? '').toLowerCase().startsWith('zh')) return CHART_SETS.global
  return !assertApiSupport('wy') && assertApiSupport('kw') ? CHART_SETS.kw : CHART_SETS.wy
}

export interface PlaylistItem {
  id: string
  name: string
  img: string
  play_count: string
  total: number
  source: LX.OnlineSource
}
export interface ArtistItem {
  id: string
  name: string
  img: string
  source: LX.OnlineSource
}
export interface AlbumItem {
  id: string
  name: string
  img: string
  artist: string
  source: LX.OnlineSource
}
export interface TagItem {
  id: string
  name: string
  source: LX.OnlineSource
}

const CACHE_TIME = 30 * 60_000
const CACHE_PREFIX = 'home:'

// The sections are kept in the data cache (also between the runs of the app): the page shows them
// at once, they are loaded again when they are older than CACHE_TIME and replaced when that is done.
const load = async<T>(key: string, loader: () => Promise<T>, isRefresh: boolean): Promise<T> => {
  const cached = getCache<T>(CACHE_PREFIX + key)
  if (!isRefresh && cached != null && Date.now() - getCacheTime(CACHE_PREFIX + key) < CACHE_TIME) return cached
  const data = await loader()
  // an empty answer does not replace what is shown
  if (Array.isArray(data) && !data.length && Array.isArray(cached) && cached.length) return cached
  setCache(CACHE_PREFIX + key, data)
  return data
}

/**
 * Data that is already loaded, lets the page render at once when it is opened again
 */
export const getCached = <T>(key: string): T | null => getCache<T>(CACHE_PREFIX + key)

const homeSdk = musicSdk[HOME_SOURCE].home

// the sections of every source (utils/homeCurated.ts): NetEase with Deezer, SoundCloud, Spotify
export type MixedPlaylist = HomePlaylist & { play_count?: string }
export const getPlaylists = async(isRefresh = false) => {
  return load<MixedPlaylist[]>('playlists_mixed_v2', async() => {
    const netease = (await homeSdk.getRecommendPlaylists(18).catch(() => []) as PlaylistItem[])
      .map(item => ({ id: item.id, name: item.name, img: item.img, source: 'wy', sourceName: 'NetEase', open: 'songlist' as const, play_count: item.play_count }))
    // (enough to fill two rows of a big window)
    return getMixedPlaylists(netease, 40)
  }, isRefresh)
}
export const getArtists = async(isRefresh = false) => {
  return load<HomeArtist[]>('artists_mixed_v2', async() => {
    const netease = (await homeSdk.getHotArtists(24).catch(() => []) as ArtistItem[]).map(item => ({ name: item.name, img: item.img, source: 'wy' }))
    return getMixedArtists(netease, 40)
  }, isRefresh)
}
export const getAlbums = async(isRefresh = false) => {
  return load<HomeAlbum[]>('albums_mixed_v2', async() => {
    const netease = (await homeSdk.getNewAlbums(18).catch(() => []) as AlbumItem[])
      .map(item => ({ id: item.id, name: item.name, artist: item.artist, img: item.img, source: 'wy', sourceName: 'NetEase', open: 'album' as const }))
    return getMixedAlbums(netease, 40)
  }, isRefresh)
}

// the artists the user listens to the most: the listening stats (the last 90 days), the loved songs then
const getTopArtists = async() => {
  const names: string[] = []
  const add = (name: string) => {
    if (name && !names.some(n => n.toLowerCase() == name.toLowerCase())) names.push(name)
  }
  const stats = await getListenStats(getRangeFrom('last90Days'), 6).catch(() => null)
  for (const artist of stats?.topArtists ?? []) add(artist.name)
  if (names.length < 4) {
    const counts = new Map<string, number>()
    for (const music of await getListMusics(LIST_IDS.LOVE)) {
      const name = music.singer.split(/\s*(?:、|&|;|；|\/|,|，|\|)\s*/)[0]?.trim()
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    for (const [name] of Array.from(counts).sort((a, b) => b[1] - a[1]).slice(0, 4)) add(name)
  }
  return names
}
/**
 * Artists for the user (similar to the ones they listen to): the artists they are similar to, the artists
 */
export const getArtistsForYou = async(isRefresh = false) => {
  return load<{ seeds: string[], list: HomeArtist[] }>('for_you_v2', async() => {
    const top = await getTopArtists()
    // (enough to fill the row of a big window)
    return top.length ? getSimilarToTop(top, 28) : { seeds: [], list: [] }
  }, isRefresh)
}
export const getChartSongs = async(id: string, isRefresh = false) => {
  return load<LX.Music.MusicInfoOnline[]>('chart_' + id, async() => (await getBoardDetail(id, 1, isRefresh)).list, isRefresh)
}
// every playlist category / hot search of all sources: the page shows a random pick of them
export const getHotTags = async(isRefresh = false) => {
  return load<TagItem[]>('tags', async() => {
    const { hotTag, tags } = await getTags(HOME_SOURCE)
    const map = new Map<string, TagItem>()
    for (const tag of [...hotTag, ...tags.flatMap(group => group.list)]) {
      if (tag.name && !map.has(tag.name)) map.set(tag.name, tag)
    }
    return Array.from(map.values())
  }, isRefresh)
}
export const getHotSearch = async(isRefresh = false) => {
  return load<string[]>('hotSearch', async() => getHotSearchList('all'), isRefresh)
}

export const shuffle = <T>(list: T[]): T[] => {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Smaller version of a NetEase image
 */
export const getPic = (url: string | null | undefined, size: number): string | null => {
  if (!url) return null
  if (/^https?:\/\/p\d+\.music\.126\.net\//.test(url) && !url.includes('param=')) {
    return `${url}${url.includes('?') ? '&' : '?'}param=${size}y${size}`
  }
  return url
}
