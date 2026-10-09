import { decodeHtml, getSoundcloudChart, getSoundcloudCharts, isExplicitName, mergeNameKey, mergeSameSongs, secondaryGetJson, secondaryGetText } from './secondarySources'

// The charts of Spotify, Deezer and SoundCloud in the charts tab (the same file in the desktop and the mobile app).
// Spotify: its chart playlists, read from their public embed page (no account); Deezer: its chart and top
// playlists (its public API). Their songs cannot be played: each one is looked for on the main sources (NetEase,
// Kuwo). SoundCloud: its trending lists, played from it.

export const CHART_SOURCES = ['sp', 'dz', 'sc'] as const
export type ChartSource = typeof CHART_SOURCES[number]
export const CHART_SOURCE_NAMES: Record<ChartSource, string> = { sp: 'Spotify', dz: 'Deezer', sc: 'SoundCloud' }
export const isChartSource = (source: string | null | undefined): source is ChartSource => CHART_SOURCES.includes(source as ChartSource)

export interface ChartBoard {
  /** "<source>__<id>" (like the charts of the main sources) */
  id: string
  bangid: string
  name: string
  pic: string | null
}

const SPOTIFY_CHARTS = [
  { id: '37i9dQZEVXbMDoHDwVN2tF', name: 'Top 50 - Global', pic: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_default.jpg' },
  { id: '37i9dQZEVXbLRQDuF5jeBp', name: 'Top 50 - USA', pic: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_us_default.jpg' },
  { id: '37i9dQZEVXbLnolsZ8PSNw', name: 'Top 50 - United Kingdom', pic: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_gb_default.jpg' },
  { id: '37i9dQZF1DXcBWIGoYBM5M', name: 'Today\'s Top Hits', pic: 'https://i.scdn.co/image/ab67706f0000000271992d3b45eb1297df9c6bf7' },
]

/**
 * The charts of a chart source
 */
export const getChartBoards = async(source: ChartSource): Promise<ChartBoard[]> => {
  switch (source) {
    case 'sp':
      return SPOTIFY_CHARTS.map(chart => ({ id: `sp__${chart.id}`, bangid: chart.id, name: chart.name, pic: chart.pic }))
    case 'dz':
      return getDeezerCharts()
    case 'sc':
      return (await getSoundcloudCharts()).map(chart => ({ id: `sc__${chart.id}`, bangid: chart.id, name: chart.name, pic: chart.pic }))
  }
}

/**
 * Whether the charts of a chart source can be loaded (Spotify / Deezer / SoundCloud are blocked in mainland China;
 * the list of the charts of Spotify is known without it: the songs of one of them are asked for)
 */
export const isChartSourceReachable = async(source: ChartSource): Promise<boolean> => {
  try {
    if (source == 'sp') return (await getSpotifyPlaylist(SPOTIFY_CHARTS[0].id)).length > 0
    return (await getChartBoards(source)).length > 0
  } catch {
    return false
  }
}

/* ---------- Deezer (its public API: its chart and its top playlists) ---------- */

const DEEZER_API = 'https://api.deezer.com'
// the chart of the songs of Deezer, before its top playlists
const DEEZER_TOP_ID = 'top'
export const DEEZER_ALBUM_PREFIX = 'album:'

export interface DeezerTrack {
  title?: string
  duration?: number
  artist?: { name?: string }
  contributors?: Array<{ name?: string }>
  album?: { title?: string, cover_big?: string | null }
}

// the charts of Deezer (its account "Deezer Charts"): the worldwide ones, then the ones of some countries; its
// "/chart/0" answers are the charts of the country of the user (by its address), so they are not used
const DEEZER_CHARTS_USER = '637006841'
export const DEEZER_WORLDWIDE_ID = '3155776842'
const DEEZER_CHART_IDS = [
  DEEZER_WORLDWIDE_ID, // Top Worldwide
  '13562522521', // Top Women Worldwide
  '1313621735', // Top USA
  '1111142221', // Top UK
  '1111141961', // Top Brazil
  '1111143121', // Top Germany
  '1109890291', // Top France
  '1111142361', // Top Mexico
  '1362508955', // Top Japan
  '1362510315', // Top South Korea
  '1116190041', // Top Spain
  '1116187241', // Top Italy
]

const getDeezerCharts = async(): Promise<ChartBoard[]> => {
  const data = await secondaryGetJson<{ data?: Array<{ id: number, title: string, picture_xl?: string | null }> }>(`${DEEZER_API}/user/${DEEZER_CHARTS_USER}/playlists?limit=200`)
  const playlists = new Map((data.data ?? []).map(playlist => [String(playlist.id), playlist]))
  return DEEZER_CHART_IDS.map(id => playlists.get(id)).filter(playlist => !!playlist).map(playlist => ({
    id: `dz__${playlist.id}`,
    bangid: String(playlist.id),
    name: playlist.title,
    pic: playlist.picture_xl ?? null,
  }))
}

const getDeezerPlaylist = async(id: string): Promise<ChartTrack[]> => {
  // "album:<id>": an album (the new releases of the home page), else a playlist
  // ("top": the chart shown before, now the worldwide one)
  const url = id == DEEZER_TOP_ID
    ? `${DEEZER_API}/playlist/${DEEZER_WORLDWIDE_ID}/tracks?limit=100`
    : id.startsWith(DEEZER_ALBUM_PREFIX) ? `${DEEZER_API}/album/${id.slice(DEEZER_ALBUM_PREFIX.length)}/tracks?limit=100` : `${DEEZER_API}/playlist/${id}/tracks?limit=100`
  const data = await secondaryGetJson<{ data?: DeezerTrack[] }>(url)
  return (data.data ?? []).filter(track => track.title).map(deezerToChartTrack)
}

export const deezerToChartTrack = (track: DeezerTrack): ChartTrack => ({
  name: track.title!,
  singer: (track.contributors?.length ? track.contributors.map(c => c.name ?? '') : [track.artist?.name ?? '']).filter(name => name).join('、'),
  durationMs: (track.duration ?? 0) * 1000,
  pic: track.album?.cover_big ?? null,
  album: track.album?.title,
})

/* ---------- Spotify ---------- */

// a song that cannot be played (Spotify / Deezer / Last.fm): it is looked for on the main sources
export interface ChartTrack {
  name: string
  singer: string
  durationMs: number
  /** its cover, for the songs found without one (Kuwo has none for many songs) */
  pic?: string | null
  /** Spotify: the id of the song (its cover is asked for when needed) */
  spotifyId?: string
  album?: string
}

interface SpotifyEmbedTrack {
  uri?: string
  title?: string
  subtitle?: string
  duration?: number
}
interface SpotifyEntity {
  name?: string
  coverArt?: { sources?: Array<{ url: string }> }
  trackList?: SpotifyEmbedTrack[]
}

// "album:<id>": an album, else a playlist
export const SPOTIFY_ALBUM_PREFIX = 'album:'

const getSpotifyPlaylist = async(id: string): Promise<ChartTrack[]> => {
  if (id.startsWith(SPOTIFY_ALBUM_PREFIX)) return (await getSpotifyEntity('album', id.slice(SPOTIFY_ALBUM_PREFIX.length))).tracks
  return (await getSpotifyEntity('playlist', id)).tracks
}

/**
 * A playlist / album of Spotify (its public embed page: its first 100 songs)
 */
export const getSpotifyEntity = async(type: 'playlist' | 'album', id: string): Promise<{ name: string, img: string | null, tracks: ChartTrack[] }> => {
  const page = await secondaryGetText(`https://open.spotify.com/embed/${type}/${id}`)
  const json = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(page)?.[1]
  if (!json) throw new Error('Spotify: playlist data not found')
  const entity = (JSON.parse(json) as { props?: { pageProps?: { state?: { data?: { entity?: SpotifyEntity } } } } }).props?.pageProps?.state?.data?.entity
  const name = decodeHtml(entity?.name ?? '')
  const covers = entity?.coverArt?.sources ?? []
  // (the embed page of an album has no cover: its oEmbed)
  const img = covers[covers.length - 1]?.url ?? await secondaryGetJson<{ thumbnail_url?: string }>(`https://open.spotify.com/oembed?url=spotify:${type}:${id}`).then(data => data.thumbnail_url ?? null).catch(() => null)
  const tracks = (entity?.trackList ?? []).filter(track => track.title).map(track => ({
    name: decodeHtml(track.title!),
    // "A,\u00a0B"
    singer: decodeHtml(track.subtitle ?? '').split(/\s*,\s*/).map(name => name.replace(/\u00a0/g, ' ').trim()).filter(name => name).join('、'),
    durationMs: track.duration ?? 0,
    spotifyId: /^spotify:track:(\w+)$/.exec(track.uri ?? '')?.[1],
    // (the songs of an album: its cover)
    pic: type == 'album' ? img : undefined,
    album: type == 'album' ? name : undefined,
  }))
  return { name, img, tracks }
}

// the cover of a song of Spotify (the songs of its embed page have none)
const getSpotifyTrackPic = async(id: string): Promise<string | null> => {
  const data = await secondaryGetJson<{ thumbnail_url?: string }>(`https://open.spotify.com/oembed?url=spotify:track:${id}`)
  return data.thumbnail_url ?? null
}

/* ---------- the songs of a chart of Spotify on the main sources ---------- */

export type ChartSearch = (source: string, text: string) => Promise<LX.Music.MusicInfoOnline[]>

// the same matching as the songs looked for on another source (musicSdk findMusic)
const filterStr = (text: string) => text.toLowerCase().replace(/\s|'|\.|,|，|&|"|、|\(|\)|（|）|`|~|-|<|>|\||\/|\]|\[|!|！/g, '')
const intervalSeconds = (interval: string | null | undefined) => {
  if (!interval) return 0
  return interval.split(':').reduce((total, part) => total * 60 + (parseInt(part) || 0), 0)
}
/**
 * Whether a song found is the one looked for: the same name (or one name in the other), one singer in common, the
 * same length (to `tolerance` seconds)
 */
export const isTrackMatch = (musicInfo: LX.Music.MusicInfoOnline, name: string, singer: string, seconds: number, tolerance = 5) => {
  const itemSeconds = intervalSeconds(musicInfo.interval)
  if (seconds && itemSeconds && Math.abs(seconds - itemSeconds) > tolerance) return false
  const itemName = filterStr(musicInfo.name)
  const targetName = filterStr(name)
  if (itemName != targetName && !(itemName.includes(targetName) || targetName.includes(itemName))) return false
  // one singer in common
  const itemSingers = (musicInfo.singer ?? '').split(/、|&|;|；|\/|,|，/).map(filterStr).filter(s => s)
  const singers = singer.split('、').map(filterStr).filter(s => s)
  return !singers.length || singers.some(s => itemSingers.some(item => item.includes(s) || s.includes(item)))
}

const CHART_SEARCH_CONCURRENCY = 6
const CHART_CACHE_TIME = 3 * 60 * 60 * 1000
const chartCache = new Map<string, { time: number, list: LX.Music.MusicInfoOnline[] }>()

/**
 * Songs known by their name / artist (Spotify, Deezer, Last.fm...) found on the main sources (in the order of
 * `sources`: the song is played from the first one, the others are its copies, `mergeSameSongs`); the songs
 * found nowhere are left out
 */
/**
 * One song known by its name / artist found on the main sources (`matchTracks`), null when it is found nowhere
 */
export const matchTrack = async(track: ChartTrack, search: ChartSearch, sources: readonly string[], isSupported?: (source: string) => boolean): Promise<LX.Music.MusicInfoOnline | null> => {
  const seconds = Math.round(track.durationMs / 1000)
  const firstSinger = track.singer.split('、')[0] ?? ''
  const found = await Promise.all(sources.map(async source => {
    const list = await search(source, `${track.name} ${firstSinger}`).catch(() => [])
    const matches = list.filter(musicInfo => isTrackMatch(musicInfo, track.name, track.singer, seconds))
    // the song of the same name first (not "(Spanish Version)" / "(Remix)"...); its explicit version when the
    // source has both
    const name = filterStr(track.name)
    const exact = matches.find(musicInfo => filterStr(musicInfo.name) == name)
    const explicit = exact && !isExplicitName(exact.name) ? matches.find(musicInfo => isExplicitName(musicInfo.name) && mergeNameKey(musicInfo.name) == mergeNameKey(exact.name)) : undefined
    return explicit ?? exact ?? matches[0] ?? null
  }))
  const copies = found.filter((musicInfo): musicInfo is LX.Music.MusicInfoOnline => !!musicInfo)
  if (!copies.length) return null
  const musicInfo = mergeSameSongs(copies, isSupported)[0]
  // no cover (often Kuwo): the one of a copy, else the one of the chart
  if (!musicInfo.meta.picUrl) {
    let pic = copies.find(copy => copy.meta.picUrl)?.meta.picUrl ?? track.pic ?? null
    if (!pic && track.spotifyId) pic = await getSpotifyTrackPic(track.spotifyId).catch(() => null)
    if (pic) musicInfo.meta.picUrl = pic
  }
  return musicInfo
}

export const matchTracks = async(tracks: ChartTrack[], search: ChartSearch, sources: readonly string[], isSupported?: (source: string) => boolean): Promise<LX.Music.MusicInfoOnline[]> => {
  const result: Array<LX.Music.MusicInfoOnline | null> = Array(tracks.length).fill(null)
  let next = 0
  const worker = async() => {
    while (next < tracks.length) {
      const index = next++
      result[index] = await matchTrack(tracks[index], search, sources, isSupported)
    }
  }
  await Promise.all(Array.from({ length: CHART_SEARCH_CONCURRENCY }, worker))
  return result.filter((musicInfo): musicInfo is LX.Music.MusicInfoOnline => !!musicInfo)
}

const getMatchedChart = async(key: string, getTracks: () => Promise<ChartTrack[]>, search: ChartSearch, sources: readonly string[], isSupported?: (source: string) => boolean): Promise<LX.Music.MusicInfoOnline[]> => {
  const cached = chartCache.get(key)
  if (cached && Date.now() - cached.time < CHART_CACHE_TIME) return cached.list
  const list = await matchTracks(await getTracks(), search, sources, isSupported)
  if (list.length) chartCache.set(key, { time: Date.now(), list })
  return list
}

/**
 * The songs of a chart of a chart source
 */
export const getChartSongs = async(source: ChartSource, id: string, search: ChartSearch, sources: readonly string[], isSupported?: (source: string) => boolean): Promise<LX.Music.MusicInfoOnline[]> => {
  switch (source) {
    case 'sp': return getMatchedChart(`sp__${id}`, async() => getSpotifyPlaylist(id), search, sources, isSupported)
    case 'dz': return getMatchedChart(`dz__${id}`, async() => getDeezerPlaylist(id), search, sources, isSupported)
    case 'sc': return getSoundcloudChart(id)
  }
}
