// Secondary sources: YouTube (through the yt-dlp of the app), SoundCloud, Bandcamp and KHInsider
// (video game music), the last three through their public web players: their search and pages. The audio of
// their songs comes from the source addons the user installs (utils/sourceAddons.ts). Their songs are found by name, so the songs of the main sources
// (found by id) are preferred: a secondary song is played from a main source when the same song is
// there. Shared by the desktop and the mobile app (keep both copies the same), the requests go
// through the http function of the app (setSecondaryHttp).

export type SecondarySource = 'yt' | 'sc' | 'bc' | 'kh'
export const SECONDARY_SOURCES: readonly SecondarySource[] = ['yt', 'sc', 'bc', 'kh']
export const SECONDARY_SOURCE_NAMES: Record<SecondarySource, string> = {
  yt: 'YouTube',
  sc: 'SoundCloud',
  bc: 'Bandcamp',
  kh: 'KHInsider',
}

export const isSecondarySource = (source: string | null | undefined): source is SecondarySource => {
  return SECONDARY_SOURCES.includes(source as SecondarySource)
}

export interface SecondaryHttpResponse {
  status: number
  body: string
}
export type SecondaryHttp = (url: string, options?: { method?: 'GET' | 'POST', headers?: Record<string, string>, body?: string }) => Promise<SecondaryHttpResponse>

let appHttp: SecondaryHttp = async(url, options) => {
  const res = await fetch(url, { method: options?.method ?? 'GET', headers: options?.headers, body: options?.body })
  return { status: res.status, body: await res.text() }
}
export const setSecondaryHttp = (fn: SecondaryHttp) => {
  appHttp = fn
}

// the sources blocked in some places (China: the Great Firewall) often drop the connection instead of refusing
// it: their requests fail after this time, so the pages that wait for them are not stuck
const REQUEST_TIMEOUT = 10_000
const http: SecondaryHttp = async(url, options) => {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return Promise.race([
    appHttp(url, options),
    new Promise<never>((resolve, reject) => {
      timeout = setTimeout(() => { reject(new Error(`request timeout: ${url}`)) }, REQUEST_TIMEOUT)
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
}

/**
 * Runs yt-dlp (bundled with the app) with these options and this url, resolves with what it prints
 */
export type SecondaryYtdlp = (url: string, options: string[]) => Promise<string>
let ytdlp: SecondaryYtdlp | null = null
export const setSecondaryYtdlp = (fn: SecondaryYtdlp | null) => {
  ytdlp = fn
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const getText = async(url: string, options?: Parameters<SecondaryHttp>[1]) => {
  const res = await http(url, { ...options, headers: { 'User-Agent': UA, ...options?.headers } })
  if (res.status < 200 || res.status >= 300) throw new Error(`request failed: ${res.status}`)
  return res.body
}
const getJson = async<T>(url: string, options?: Parameters<SecondaryHttp>[1]): Promise<T> => JSON.parse(await getText(url, options)) as T
// for the searches of artists / albums (utils/entitySearch.ts)
export { getText as secondaryGetText, getJson as secondaryGetJson }
// a request whose answer is read whatever its status (Last.fm: its errors)
export const secondaryRequest = async(url: string, options?: Parameters<SecondaryHttp>[1]) => http(url, { ...options, headers: { 'User-Agent': UA, ...options?.headers } })

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
export const decodeHtml = (text: string) => text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, code: string) => {
  if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16))
  if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10))
  return ENTITIES[code.toLowerCase()] ?? match
})

/** a song found on a secondary source */
export interface SecondaryTrack {
  source: SecondarySource
  id: string
  name: string
  singer: string
  albumName: string
  durationMs: number
  img: string | null
  /** page of the song on the source (Bandcamp / KHInsider: used to get the audio) */
  url: string
}

export interface SecondaryStream {
  url: string
  /** a HLS playlist of mp3 parts (SoundCloud): the parts are joined into one file by the app */
  hls: boolean
  ext: string
}

/* ---------- YouTube (yt-dlp) ---------- */

interface YtEntry {
  id?: string
  title?: string
  channel?: string | null
  uploader?: string | null
  duration?: number | null
  url?: string
  ext?: string
}

const runYtdlp = async(url: string, options: string[]) => {
  if (!ytdlp) throw new Error('yt-dlp is not available')
  return ytdlp(url, options)
}
// for the source addons (utils/sourceAddons.ts)
export { runYtdlp as runSecondaryYtdlp }

const toYtTrack = (entry: YtEntry & { id: string }): SecondaryTrack => ({
  source: 'yt',
  id: entry.id,
  name: entry.title ?? 'Unknown',
  // the auto generated channels of the artists are named "<artist> - Topic"
  singer: (entry.channel ?? entry.uploader ?? '').replace(/ - Topic$/, ''),
  albumName: '',
  durationMs: entry.duration ? Math.round(entry.duration * 1000) : 0,
  img: `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`,
  url: `https://www.youtube.com/watch?v=${entry.id}`,
})

// the JSON objects yt-dlp writes, one a line
const ytLines = <T>(out: string): T[] => {
  const list: T[] = []
  for (const line of out.split('\n')) {
    if (!line.trim().startsWith('{')) continue
    try {
      list.push(JSON.parse(line) as T)
    } catch {}
  }
  return list
}

const searchYoutube = async(query: string, limit: number): Promise<SecondaryTrack[]> => {
  const out = await runYtdlp(`ytsearch${limit}:${query}`, ['--dump-json', '--flat-playlist', '--no-warnings'])
  const tracks: SecondaryTrack[] = []
  for (const line of out.split('\n')) {
    if (!line.trim().startsWith('{')) continue
    let entry: YtEntry
    try {
      entry = JSON.parse(line) as YtEntry
    } catch {
      continue
    }
    if (!entry.id) continue
    tracks.push(toYtTrack(entry as YtEntry & { id: string }))
  }
  return tracks
}

/* ---------- SoundCloud ---------- */

const SC_API = 'https://api-v2.soundcloud.com'
let scClientId: string | null = null
let scClientIdPromise: Promise<string> | null = null

// the key of the SoundCloud web player, found in its scripts
const getScClientId = async(refresh = false): Promise<string> => {
  if (scClientId && !refresh) return scClientId
  if (scClientIdPromise) return scClientIdPromise
  scClientIdPromise = (async() => {
    const page = await getText('https://soundcloud.com')
    const scripts = page.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js/g) ?? []
    for (const script of scripts.reverse()) {
      const id = /[{,]client_id:"(\w+)"/.exec(await getText(script).catch(() => ''))?.[1]
      if (id) return (scClientId = id)
    }
    throw new Error('SoundCloud client id not found')
  })().finally(() => {
    scClientIdPromise = null
  })
  return scClientIdPromise
}

const scGet = async<T>(path: string, params: Record<string, string>): Promise<T> => {
  const request = async(refresh: boolean) => {
    const query = new URLSearchParams({ ...params, client_id: await getScClientId(refresh) }).toString()
    return http(`${SC_API}/${path}?${query}`, { headers: { 'User-Agent': UA } })
  }
  let res = await request(false)
  // the key changes from time to time
  if (res.status == 401 || res.status == 403) res = await request(true)
  if (res.status < 200 || res.status >= 300) throw new Error(`SoundCloud request failed: ${res.status}`)
  return JSON.parse(res.body) as T
}

interface ScTranscoding {
  url: string
  format: { protocol: string, mime_type: string }
}
interface ScTrack {
  id: number
  title: string
  duration: number
  artwork_url: string | null
  permalink_url: string
  policy?: string
  streamable?: boolean
  track_authorization?: string
  user: { username: string, avatar_url: string | null }
  publisher_metadata?: { artist?: string, album_title?: string } | null
  media?: { transcodings: ScTranscoding[] }
}

// previews only (paid songs) / blocked in the country
const isScPlayable = (t: ScTrack) => t.policy != 'SNIP' && t.policy != 'BLOCK' && t.streamable !== false
const scBigImg = (url: string | null | undefined) => url?.replace('-large', '-t500x500') ?? null
const toScTrack = (t: ScTrack): SecondaryTrack => ({
  source: 'sc',
  id: String(t.id),
  name: t.title,
  singer: t.publisher_metadata?.artist ?? t.user.username,
  albumName: t.publisher_metadata?.album_title ?? '',
  durationMs: t.duration,
  img: scBigImg(t.artwork_url ?? t.user.avatar_url),
  url: t.permalink_url,
})

const searchSoundcloud = async(query: string, limit: number): Promise<SecondaryTrack[]> => {
  const data = await scGet<{ collection: ScTrack[] }>('search/tracks', { q: query, limit: String(limit) })
  return data.collection.filter(isScPlayable).map(toScTrack)
}

/**
 * The parts of a SoundCloud HLS playlist (mp3 parts, joined they make the whole file)
 */
export const getHlsParts = async(playlistUrl: string): Promise<string[]> => {
  const playlist = await getText(playlistUrl)
  return playlist.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))
}

/* ---------- Bandcamp ---------- */

interface BcResult {
  type: string
  id: number
  name: string
  band_name: string
  album_name: string | null
  item_url_path: string
  art_id: number | null
}

const searchBandcamp = async(query: string, limit: number): Promise<SecondaryTrack[]> => {
  const data = await getJson<{ auto: { results: BcResult[] } }>('https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search_text: query, search_filter: 't', full_page: false, fan_id: null }),
  })
  return data.auto.results.filter(r => r.type == 't').slice(0, limit).map(r => ({
    source: 'bc',
    id: String(r.id),
    name: r.name,
    singer: r.band_name,
    albumName: r.album_name ?? '',
    durationMs: 0,
    img: r.art_id ? `https://f4.bcbits.com/img/a${r.art_id}_2.jpg` : null,
    url: r.item_url_path,
  }))
}

/* ---------- KHInsider (video game music) ---------- */

const KH_BASE = 'https://downloads.khinsider.com'
const KH_ALBUMS = 2

const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w)
const matchScore = (text: string, query: string) => {
  const textWords = new Set(words(text))
  const queryWords = words(query)
  if (!queryWords.length) return 0
  return queryWords.filter(w => textWords.has(w)).length / queryWords.length
}

interface KhAlbum {
  path: string
  name: string
  type: string
}

const searchKhAlbums = async(query: string): Promise<KhAlbum[]> => {
  const page = await getText(`${KH_BASE}/search?search=${encodeURIComponent(query)}`)
  const albums: KhAlbum[] = []
  const rowRxp = /<tr>\s*<td class="albumIcon">[\s\S]*?<\/tr>/g
  for (const row of page.match(rowRxp) ?? []) {
    const link = /<td>\s*<a href="(\/game-soundtracks\/album\/[^"]+)">([^<]+)<\/a>/.exec(row)
    if (!link) continue
    const cells = row.match(/<td>([^<]*)<\/td>/g) ?? []
    albums.push({ path: link[1], name: decodeHtml(link[2].trim()), type: (cells[0] ?? '').replace(/<\/?td>/g, '').trim() })
  }
  // the results are sorted by name: the albums that match the words of the search come first,
  // the soundtracks before the arrangements / remixes
  const typeScore = (type: string) => type == 'Soundtrack' ? 0.2 : type == 'Gamerip' ? 0.1 : 0
  return albums
    .map(album => ({ album, score: matchScore(album.name, query) + typeScore(album.type) }))
    .filter(({ score }) => score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map(({ album }) => album)
}

const parseDuration = (text: string) => {
  const parts = text.split(':').map(p => parseInt(p, 10))
  if (parts.some(p => isNaN(p))) return 0
  return parts.reduce((total, p) => total * 60 + p, 0) * 1000
}

const getKhAlbumTracks = async(album: KhAlbum): Promise<SecondaryTrack[]> => {
  const page = await getText(`${KH_BASE}${album.path}`)
  const img = /<img[^>]+src="(https:\/\/[^"]*vgmtreasurechest\.com\/[^"]+)"/.exec(page)?.[1] ?? null
  const composer = /Composed by:\s*<b>([^<]+)<\/b>/i.exec(page)?.[1]
  const list = page.slice(page.indexOf('id="songlist"'))
  const tracks: SecondaryTrack[] = []
  for (const row of list.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    const cells = [...row.matchAll(/<td class="clickable-row"[^>]*><a href="([^"]+)"[^>]*>([^<]*)<\/a><\/td>/g)]
    if (cells.length < 2) continue
    const path = cells[0][1]
    tracks.push({
      source: 'kh',
      id: path,
      name: decodeHtml(cells[0][2].trim()),
      singer: composer ? decodeHtml(composer.trim()) : album.name,
      albumName: album.name,
      durationMs: parseDuration(cells[1][2].trim()),
      img,
      url: `${KH_BASE}${path}`,
    })
  }
  return tracks
}

const searchKhinsider = async(query: string, limit: number): Promise<SecondaryTrack[]> => {
  const albums = (await searchKhAlbums(query)).slice(0, KH_ALBUMS)
  const lists = await Promise.all(albums.map(async album => getKhAlbumTracks(album).catch(() => [])))
  // the songs of the matching albums, the ones whose name matches the search first
  const tracks = lists.flat()
  return tracks
    .map((track, index) => ({ track, index, score: matchScore(track.name, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ track }) => track)
}

/* ---------- common ---------- */

/**
 * Search a secondary source, the songs are returned as music infos of the app
 */
export const searchSecondary = async(source: SecondarySource, query: string, limit = 10): Promise<LX.Music.MusicInfoOnline[]> => {
  let tracks: SecondaryTrack[]
  switch (source) {
    case 'yt': tracks = await searchYoutube(query, limit); break
    case 'sc': tracks = await searchSoundcloud(query, limit); break
    case 'bc': tracks = await searchBandcamp(query, limit); break
    case 'kh': tracks = await searchKhinsider(query, limit); break
  }
  return tracks.map(toMusicInfo)
}

const formatInterval = (ms: number) => {
  if (!ms) return null
  const seconds = Math.round(ms / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

export const toMusicInfo = (track: SecondaryTrack): LX.Music.MusicInfoOnline => {
  // the music info of the main sources, with the page of the song kept for its audio
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    id: `${track.source}_${track.id}`,
    name: track.name,
    singer: track.singer,
    source: track.source,
    interval: formatInterval(track.durationMs),
    meta: {
      songId: track.id,
      albumName: track.albumName,
      albumId: '',
      picUrl: track.img,
      qualitys: [{ type: '128k', size: null }],
      _qualitys: { '128k': true },
      secondaryUrl: track.url,
    },
  } as unknown as LX.Music.MusicInfoOnline
}

/* ---------- SoundCloud artist pages (utils/artistCombine.ts, like the SoundCloud plugin of Nuclear) ---------- */

interface ScUser {
  id: number
  username: string
  avatar_url: string | null
  description?: string | null
  followers_count?: number
  track_count?: number
  playlist_count?: number
  verified?: boolean
}
interface ScPlaylist {
  id: number
  title: string
  artwork_url: string | null
  track_count?: number
  release_date?: string | null
  display_date?: string | null
  user?: { username: string }
  tracks?: Array<ScTrack | { id: number, title?: undefined }>
}
interface ScPage<T> {
  collection: T[]
  next_href?: string | null
}

const SC_ARTIST_TRACK_PAGES = 5
// an account under this (not verified) may be a fan account: taken only when the main sources do not have the artist
const SC_TRUSTED_FOLLOWERS = 1000
const SC_IDS_PER_REQUEST = 50

/**
 * The SoundCloud account of an artist for the artist pages: an account with exactly the name of the artist
 * (the one with the most followers), never a similar one
 */
export const soundcloudSinger = {
  async search(name: string): Promise<string | null> {
    const data = await scGet<ScPage<ScUser>>('search/users', { q: name, limit: '10' })
    const target = words(name).join(' ')
    const user = data.collection
      .filter(u => words(u.username).join(' ') == target)
      .sort((a, b) => (b.followers_count ?? 0) - (a.followers_count ?? 0))[0]
    return user ? String(user.id) : null
  },
  async getInfo(id: string) {
    const user = await scGet<ScUser>(`users/${id}`, {})
    return {
      info: { name: user.username, desc: user.description?.trim() ?? '', avatar: scBigImg(user.avatar_url) },
      count: { music: user.track_count ?? 0, album: user.playlist_count ?? 0 },
      weak: !user.verified && (user.followers_count ?? 0) < SC_TRUSTED_FOLLOWERS,
    }
  },
  // every song on the first page (SoundCloud pages by a cursor)
  async getSongList(id: string, page: number) {
    if (page > 1) return { list: [], total: 0 }
    const tracks: ScTrack[] = []
    let data = await scGet<ScPage<ScTrack>>(`users/${id}/tracks`, { limit: '200' })
    tracks.push(...data.collection)
    for (let i = 1; i < SC_ARTIST_TRACK_PAGES && data.next_href; i++) {
      // (no URL.searchParams in React Native)
      const offsetParam = /[?&]offset=([^&]+)/.exec(data.next_href)?.[1]
      if (!offsetParam) break
      const offset = decodeURIComponent(offsetParam)
      data = await scGet<ScPage<ScTrack>>(`users/${id}/tracks`, { limit: '200', offset })
      tracks.push(...data.collection)
    }
    const list = tracks.filter(isScPlayable).map(t => toMusicInfo(toScTrack(t)))
    return { list, total: list.length }
  },
  // the albums, EPs and playlists of the account
  async getAlbumList(id: string, page: number, limit: number) {
    const data = await scGet<ScPage<ScPlaylist>>(`users/${id}/playlists`, { limit: String(limit), offset: String((page - 1) * limit) })
    const list = data.collection.map(p => ({
      id: String(p.id),
      count: p.track_count ?? null,
      info: {
        name: p.title,
        img: scBigImg(p.artwork_url ?? (p.tracks?.[0] as ScTrack | undefined)?.artwork_url),
        author: p.user?.username ?? '',
        time: (p.release_date ?? p.display_date ?? '').slice(0, 10) || null,
      },
    }))
    return { list, total: list.length }
  },
}

/**
 * A SoundCloud album (or playlist) with its songs
 */
export const getSoundcloudAlbum = async(id: string): Promise<{ name: string, author: string, img: string | null, list: LX.Music.MusicInfoOnline[] }> => {
  const data = await scGet<ScPlaylist>(`playlists/${id}`, {})
  const tracks = data.tracks ?? []
  // only the first songs come complete, the others are ids
  const byId = new Map<number, ScTrack>()
  for (const t of tracks) if (t.title) byId.set(t.id, t as ScTrack)
  const missing = tracks.filter(t => !t.title).map(t => t.id)
  for (let i = 0; i < missing.length; i += SC_IDS_PER_REQUEST) {
    const list = await scGet<ScTrack[]>('tracks', { ids: missing.slice(i, i + SC_IDS_PER_REQUEST).join(',') })
    for (const t of list) byId.set(t.id, t)
  }
  const list = tracks.map(t => byId.get(t.id)).filter((t): t is ScTrack => !!t && isScPlayable(t))
  return {
    name: data.title,
    author: data.user?.username ?? '',
    img: scBigImg(data.artwork_url ?? list[0]?.artwork_url),
    list: list.map(t => toMusicInfo(toScTrack(t))),
  }
}

/* ---------- the library of a SoundCloud account (utils/libraryImport.ts) ---------- */

/**
 * What a SoundCloud link is: an account, a playlist / album or a song
 */
export const resolveSoundcloudUrl = async(url: string): Promise<{ kind: 'user' | 'playlist' | 'track', id: string, name: string }> => {
  // (its likes page: the account)
  const clean = url.trim().replace(/[?#].*$/, '').replace(/\/(likes|tracks|sets|albums|popular-tracks|reposts|following|followers)\/?$/, '')
  const data = await scGet<{ kind: string, id: number, username?: string, title?: string }>('resolve', { url: clean })
  if (data.kind == 'user') return { kind: 'user', id: String(data.id), name: data.username ?? '' }
  if (data.kind == 'playlist') return { kind: 'playlist', id: String(data.id), name: data.title ?? '' }
  if (data.kind == 'track') return { kind: 'track', id: String(data.id), name: data.title ?? '' }
  throw new Error(`SoundCloud: not an account or a playlist (${data.kind})`)
}

// every page of a list of SoundCloud (by its cursor), to `max` items
const scAllPages = async<T>(path: string, max: number): Promise<T[]> => {
  const items: T[] = []
  let data = await scGet<ScPage<T>>(path, { limit: '200' })
  items.push(...data.collection)
  while (data.next_href && items.length < max) {
    const offsetParam = /[?&]offset=([^&]+)/.exec(data.next_href)?.[1]
    if (!offsetParam) break
    data = await scGet<ScPage<T>>(path, { limit: '200', offset: decodeURIComponent(offsetParam) })
    if (!data.collection.length) break
    items.push(...data.collection)
  }
  return items.slice(0, max)
}

const SC_LIBRARY_MAX = 5000

/**
 * The library of a SoundCloud account: its liked songs, its playlists (made / liked) and the accounts it follows
 */
export const getSoundcloudLibrary = async(userId: string) => {
  const [likes, playlists, likedPlaylists, followings] = await Promise.all([
    scAllPages<{ track?: ScTrack }>(`users/${userId}/track_likes`, SC_LIBRARY_MAX),
    scAllPages<ScPlaylist>(`users/${userId}/playlists`, 500).catch(() => []),
    scAllPages<{ playlist?: ScPlaylist }>(`users/${userId}/playlist_likes`, 500).catch(() => []),
    scAllPages<ScUser>(`users/${userId}/followings`, 2000).catch(() => []),
  ])
  return {
    liked: likes.map(item => item.track).filter((t): t is ScTrack => !!t?.title && isScPlayable(t)).map(t => toMusicInfo(toScTrack(t))),
    playlists: [...playlists, ...likedPlaylists.map(item => item.playlist)]
      .filter((p): p is ScPlaylist => !!p?.id)
      .map(p => ({ id: String(p.id), name: p.title, count: p.track_count ?? null, img: scBigImg(p.artwork_url) })),
    artists: followings.map(user => ({ name: user.username, img: scBigImg(user.avatar_url) })),
  }
}

/* ---------- albums of the secondary sources (search, album pages) ---------- */

export interface SecondaryAlbumResult {
  source: 'sc' | 'bc' | 'kh'
  /** SoundCloud: the playlist id, Bandcamp: the address of the album, KHInsider: the path of the album */
  id: string
  name: string
  artist: string
  img: string | null
  count: number | null
  time: string | null
}

export interface SecondaryArtistResult {
  name: string
  img: string | null
}

// a SoundCloud account under this (not verified) is left out of the artist search (fan accounts...)
const SC_SEARCH_MIN_FOLLOWERS = 1000

export const searchSoundcloudArtists = async(query: string, limit: number): Promise<SecondaryArtistResult[]> => {
  const data = await scGet<ScPage<ScUser>>('search/users', { q: query, limit: String(limit) })
  const target = words(query).join(' ')
  return data.collection
    .filter(u => u.verified || (u.followers_count ?? 0) >= SC_SEARCH_MIN_FOLLOWERS || words(u.username).join(' ') == target)
    .map(u => ({ name: u.username, img: scBigImg(u.avatar_url) }))
}

export const searchBandcampArtists = async(query: string, limit: number): Promise<SecondaryArtistResult[]> => {
  const data = await getJson<{ auto: { results: BcResult[] } }>('https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search_text: query, search_filter: 'b', full_page: false, fan_id: null }),
  })
  return data.auto.results.filter(r => r.type == 'b').slice(0, limit).map(r => ({ name: r.name, img: (r as BcResult & { img?: string | null }).img ?? null }))
}

export const searchSoundcloudAlbums = async(query: string, limit: number): Promise<SecondaryAlbumResult[]> => {
  const data = await scGet<ScPage<ScPlaylist>>('search/albums', { q: query, limit: String(limit) })
  return data.collection.map(p => ({
    source: 'sc',
    id: String(p.id),
    name: p.title,
    artist: p.user?.username ?? '',
    img: scBigImg(p.artwork_url),
    count: p.track_count ?? null,
    time: (p.release_date ?? p.display_date ?? '').slice(0, 10) || null,
  }))
}

export const searchBandcampAlbums = async(query: string, limit: number): Promise<SecondaryAlbumResult[]> => {
  const data = await getJson<{ auto: { results: BcResult[] } }>('https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search_text: query, search_filter: 'a', full_page: false, fan_id: null }),
  })
  return data.auto.results.filter(r => r.type == 'a').slice(0, limit).map(r => ({
    source: 'bc',
    id: r.item_url_path,
    name: r.name,
    artist: r.band_name,
    img: r.art_id ? `https://f4.bcbits.com/img/a${r.art_id}_2.jpg` : null,
    count: null,
    time: null,
  }))
}

export const searchKhinsiderAlbums = async(query: string, limit: number): Promise<SecondaryAlbumResult[]> => {
  const albums = await searchKhAlbums(query)
  return albums.slice(0, limit).map(album => ({
    source: 'kh',
    id: album.path,
    name: album.name,
    artist: album.type,
    img: null,
    count: null,
    time: null,
  }))
}

interface BcAlbumData {
  artist?: string
  art_id?: number | null
  current?: { title?: string }
  trackinfo?: Array<{ track_id?: number | null, id?: number | null, title?: string, duration?: number, title_link?: string | null }>
}

const getBandcampAlbum = async(url: string) => {
  const page = await getText(url)
  const raw = /data-tralbum="([^"]+)"/.exec(page)?.[1]
  if (!raw) throw new Error('Bandcamp: album data not found')
  const data = JSON.parse(decodeHtml(raw)) as BcAlbumData
  const origin = /^https?:\/\/[^/]+/.exec(url)?.[0] ?? ''
  const name = data.current?.title ?? ''
  const artist = data.artist ?? ''
  const img = data.art_id ? `https://f4.bcbits.com/img/a${data.art_id}_2.jpg` : null
  const list = (data.trackinfo ?? []).filter(t => t.title_link).map(t => toMusicInfo({
    source: 'bc',
    id: String(t.track_id ?? t.id ?? t.title_link),
    name: t.title ?? '',
    singer: artist,
    albumName: name,
    durationMs: Math.round((t.duration ?? 0) * 1000),
    img,
    url: `${origin}${t.title_link!}`,
  }))
  return { name, author: artist, img, list }
}

const getKhinsiderAlbum = async(path: string) => {
  const album: KhAlbum = { path, name: '', type: '' }
  const page = await getText(`${KH_BASE}${path}`)
  album.name = decodeHtml(/<h2>([^<]+)<\/h2>/.exec(page)?.[1]?.trim() ?? '')
  const tracks = await getKhAlbumTracks(album)
  return { name: album.name, author: tracks[0]?.singer ?? '', img: tracks[0]?.img ?? null, list: tracks.map(toMusicInfo) }
}

/* ---------- playlists of the secondary sources (playlist search, playlist pages) ---------- */

export interface SecondaryPlaylistResult {
  source: 'sc' | 'yt'
  id: string
  name: string
  author: string
  img: string | null
  total: number | null
}

// the playlists only (the albums are in the album search)
export const searchSoundcloudPlaylists = async(query: string, limit: number): Promise<SecondaryPlaylistResult[]> => {
  const data = await scGet<ScPage<ScPlaylist>>('search/playlists_without_albums', { q: query, limit: String(limit) })
  return data.collection.map(p => ({
    source: 'sc',
    id: String(p.id),
    name: p.title,
    author: p.user?.username ?? '',
    img: scBigImg(p.artwork_url ?? (p.tracks?.[0] as ScTrack | undefined)?.artwork_url),
    total: p.track_count ?? null,
  }))
}

interface YtPlaylistEntry {
  id?: string
  url?: string
  title?: string
  channel?: string | null
  uploader?: string | null
  thumbnails?: Array<{ url: string }>
}

// the search of YouTube with the filter of the playlists
const YT_PLAYLIST_FILTER = 'EgIQAw%253D%253D'

export const searchYoutubePlaylists = async(query: string, limit: number): Promise<SecondaryPlaylistResult[]> => {
  const out = await runYtdlp(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=${YT_PLAYLIST_FILTER}`, ['--flat-playlist', '--dump-json', '--no-warnings', '--playlist-end', String(limit)])
  // (the channels found are left out: playlists only)
  return ytLines<YtPlaylistEntry>(out).filter(p => p.id && p.url?.includes('list=')).map(p => ({
    source: 'yt',
    id: p.id!,
    name: p.title ?? '',
    author: p.channel ?? p.uploader ?? '',
    img: p.thumbnails?.[0]?.url ?? null,
    total: null,
  }))
}

interface YtPlaylistItem extends YtEntry {
  playlist_title?: string
  playlist_uploader?: string
}

/**
 * A playlist of a secondary source with its songs (playlist pages)
 */
export const getSecondaryPlaylist = async(source: string, id: string): Promise<{ name: string, author: string, img: string | null, list: LX.Music.MusicInfoOnline[] }> => {
  // a link (the playlists opened by their link)
  if (source == 'yt' && /^https?:/.test(id)) id = /[?&]list=([\w-]+)/.exec(id)?.[1] ?? id
  if (source == 'sc' && /^https?:/.test(id)) id = (await resolveSoundcloudUrl(id)).id
  if (source == 'yt') {
    const out = await runYtdlp(`https://www.youtube.com/playlist?list=${id}`, ['--flat-playlist', '--dump-json', '--no-warnings'])
    const entries = ytLines<YtPlaylistItem>(out).filter((e): e is YtPlaylistItem & { id: string } => !!e.id)
    const list = entries.map(e => toMusicInfo(toYtTrack(e)))
    return { name: entries[0]?.playlist_title ?? '', author: entries[0]?.playlist_uploader ?? '', img: list[0]?.meta.picUrl ?? null, list }
  }
  // SoundCloud: the same as its albums
  return getSecondaryAlbum(source, id)
}

/* ---------- Bandcamp / KHInsider artist pages (utils/artistCombine.ts) ---------- */

// the names of these sources are not unique (a band of Bandcamp / a publisher of KHInsider with the name of a
// known artist): their artist is only taken when the main sources do not have the artist
const ARTIST_SONG_ALBUMS = 8

interface BcBandResult {
  type: string
  name: string
  item_url_root?: string
  img?: string | null
}
interface BcClientItem {
  id: number
  type: string
  title: string
  artist?: string | null
  page_url: string
  art_id?: number | null
}

// a link of a page made absolute (no URL with a base in React Native)
const joinUrl = (path: string, base: string) => {
  if (/^https?:/.test(path)) return path
  const origin = /^https?:\/\/[^/]+/.exec(base)?.[0] ?? ''
  return `${origin}${path.startsWith('/') ? '' : '/'}${path}`
}

const bcArtUrl = (artId: number | null | undefined) => artId ? `https://f4.bcbits.com/img/a${artId}_2.jpg` : null

const getBandcampBandAlbums = async(root: string) => {
  const page = await getText(`${root}/music`)
  const albums: Array<{ id: string, count: null, info: { name: string, img: string | null, author: string, time: null } }> = []
  const raw = /data-client-items="([^"]+)"/.exec(page)?.[1]
  if (raw) {
    for (const item of JSON.parse(decodeHtml(raw)) as BcClientItem[]) {
      albums.push({ id: joinUrl(item.page_url, root), count: null, info: { name: item.title, img: bcArtUrl(item.art_id), author: item.artist ?? '', time: null } })
    }
  } else {
    for (const li of page.match(/<li[^>]+data-item-id="(?:album|track)-\d+"[\s\S]*?<\/li>/g) ?? []) {
      const href = /<a href="([^"]+)"/.exec(li)?.[1]
      if (!href) continue
      const img = /<img[^>]+(?:data-original|src)="([^"]+)"/.exec(li)?.[1] ?? null
      const name = decodeHtml((/<p class="title">\s*([^<]+)/.exec(li)?.[1] ?? '').trim())
      albums.push({ id: joinUrl(href, root), count: null, info: { name, img, author: '', time: null } })
    }
  }
  return { page, albums }
}

/**
 * The band of Bandcamp of an artist (the one with exactly the name of the artist), its id: the address of its site
 */
export const bandcampSinger = {
  async search(name: string): Promise<string | null> {
    const data = await getJson<{ auto: { results: BcBandResult[] } }>('https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_text: name, search_filter: 'b', full_page: false, fan_id: null }),
    })
    const target = words(name).join(' ')
    const band = data.auto.results.find(r => r.type == 'b' && r.item_url_root && words(r.name).join(' ') == target)
    return band?.item_url_root ?? null
  },
  async getInfo(id: string) {
    const page = await getText(`${id}/music`)
    // (the texts are encoded twice)
    const meta = (property: string) => decodeHtml(decodeHtml(new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`).exec(page)?.[1] ?? '')).trim()
    return {
      info: { name: meta('og:title'), desc: meta('description'), avatar: meta('og:image') || null },
      weak: true,
    }
  },
  // the songs of the first albums
  async getSongList(id: string, page: number) {
    if (page > 1) return { list: [], total: 0 }
    const { albums } = await getBandcampBandAlbums(id)
    const lists = await Promise.all(albums.slice(0, ARTIST_SONG_ALBUMS).map(async album => getBandcampAlbum(album.id).then(result => result.list).catch(() => [])))
    const list = lists.flat()
    return { list, total: list.length }
  },
  async getAlbumList(id: string) {
    const { albums } = await getBandcampBandAlbums(id)
    return { list: albums, total: albums.length }
  },
}

// KHInsider has no artist pages (the composers have none, the pages of the publishers / developers are behind
// a Cloudflare check): its "artist" is its search, the soundtracks with all the words of the name in their name
const KH_SEARCH_ID = 'search:'

const getKhAlbumRows = (page: string) => {
  const albums: Array<{ id: string, count: null, info: { name: string, img: string | null, author: string, time: string | null } }> = []
  for (const row of page.match(/<tr>\s*<td class="albumIcon">[\s\S]*?<\/tr>/g) ?? []) {
    const link = /<td>\s*<a href="(\/game-soundtracks\/album\/[^"]+)">([^<]+)<\/a>/.exec(row)
    if (!link) continue
    const img = /<img[^>]+src="([^"]+)"/.exec(row)?.[1] ?? null
    const cells = (row.match(/<td>([^<]*)<\/td>/g) ?? []).map(cell => cell.replace(/<\/?td>/g, '').trim())
    albums.push({ id: link[1], count: null, info: { name: decodeHtml(link[2].trim()), img, author: cells[0] ?? '', time: cells.find(cell => /^\d{4}$/.test(cell)) ?? null } })
  }
  return albums
}

const getKhArtistAlbums = async(id: string) => {
  const name = id.slice(KH_SEARCH_ID.length)
  const target = words(name)
  const albums = getKhAlbumRows(await getText(`${KH_BASE}/search?search=${encodeURIComponent(name)}`))
  return albums.filter(album => {
    const albumWords = new Set(words(album.info.name))
    return target.every(word => albumWords.has(word))
  })
}

/**
 * The soundtracks of KHInsider with the name of an artist (a series, a publisher...), its id: "search:<name>"
 */
export const khinsiderSinger = {
  async search(name: string): Promise<string | null> {
    if (!words(name).length) return null
    const id = `${KH_SEARCH_ID}${name}`
    return (await getKhArtistAlbums(id)).length ? id : null
  },
  async getInfo(id: string) {
    const albums = await getKhArtistAlbums(id)
    return {
      info: { name: id.slice(KH_SEARCH_ID.length), desc: '', avatar: albums.find(album => album.info.img)?.info.img ?? null },
      count: { album: albums.length },
      weak: true,
    }
  },
  // the songs of the first albums
  async getSongList(id: string, page: number) {
    if (page > 1) return { list: [], total: 0 }
    const albums = await getKhArtistAlbums(id)
    const lists = await Promise.all(albums.slice(0, ARTIST_SONG_ALBUMS).map(async album => getKhinsiderAlbum(album.id).then(result => result.list).catch(() => [])))
    const list = lists.flat()
    return { list, total: list.length }
  },
  async getAlbumList(id: string) {
    const albums = await getKhArtistAlbums(id)
    return { list: albums, total: albums.length }
  },
}

/* ---------- the album of a song (player: the title of the song) ---------- */

/**
 * The album of a song of a secondary source: KHInsider: the album of the song, Bandcamp: the album of the song
 * page (the song page for a single), SoundCloud: an album with the song (or a playlist of its uploader).
 * null: none (a SoundCloud single, YouTube...)
 */
export const getSecondarySongAlbum = async(musicInfo: LX.Music.MusicInfo): Promise<{ source: string, id: string, name: string } | null> => {
  const meta = musicInfo.meta as unknown as { songId: string, secondaryUrl?: string, albumName?: string }
  switch (musicInfo.source as string) {
    case 'kh': {
      const path = /^\/game-soundtracks\/album\/[^/]+/.exec(meta.songId)?.[0]
      return path ? { source: 'kh', id: path, name: meta.albumName ?? '' } : null
    }
    case 'bc': {
      if (!meta.secondaryUrl) return null
      const page = await getText(meta.secondaryUrl)
      const raw = /data-tralbum="([^"]+)"/.exec(page)?.[1]
      const data = raw ? JSON.parse(decodeHtml(raw)) as { album_url?: string | null, current?: { title?: string } } : null
      if (data?.album_url) return { source: 'bc', id: joinUrl(data.album_url, meta.secondaryUrl), name: meta.albumName || '' }
      return { source: 'bc', id: meta.secondaryUrl, name: data?.current?.title ?? musicInfo.name }
    }
    case 'sc': {
      // the releases of the uploader with the song (its albums first, then its playlists: they come with the ids
      // of their songs), else an album of another account with it; a single has none (its artist page is opened)
      const track = await scGet<ScTrack & { user: { id: number } }>(`tracks/${meta.songId}`, {})
      const own = await scGet<ScPage<ScPlaylist & { is_album?: boolean }>>(`users/${track.user.id}/playlists`, { limit: '50' }).catch(() => ({ collection: [] }))
      const id = Number(meta.songId)
      const releases = own.collection.filter(p => p.tracks?.some(t => t.id == id))
      let album: ScPlaylist | undefined = releases.find(p => p.is_album) ?? releases[0]
      album ??= (await scGet<ScPage<ScPlaylist>>(`tracks/${meta.songId}/albums`, { limit: '1' }).catch(() => ({ collection: [] }))).collection[0]
      return album ? { source: 'sc', id: String(album.id), name: album.title } : null
    }
  }
  return null
}

/* ---------- SoundCloud charts (the charts tab) ---------- */

interface ScSelection {
  urn?: string
  title?: string
  items?: { collection?: Array<{ kind?: string, id?: number, urn?: string, title?: string, artwork_url?: string | null, calculated_artwork_url?: string | null }> }
}

// its "Artists to watch out for": the "Buzzing" playlists (Buzzing Pop, Buzzing Hip Hop & Rap...), like the top
// playlists of SoundCloud in Nuclear
const SC_BUZZING_SELECTION = 'soundcloud:selections:buzzing'

/**
 * The charts of SoundCloud: its "trending by genre" lists (its charts of the most played songs were retired) and
 * its "Buzzing" playlists; the trending songs of all genres first, the buzzing playlists, the other genres
 */
export const getSoundcloudCharts = async(): Promise<Array<{ id: string, name: string, pic: string | null }>> => {
  const data = await scGet<ScPage<ScSelection>>('mixed-selections', { limit: '10' })
  const trending: Array<{ id: string, name: string, pic: string | null }> = []
  const buzzing: Array<{ id: string, name: string, pic: string | null }> = []
  for (const selection of data.collection) {
    for (const item of selection.items?.collection ?? []) {
      const pic = scBigImg(item.calculated_artwork_url ?? item.artwork_url)
      if (item.kind == 'system-playlist' && item.urn?.includes(':trending-by-genre:')) trending.push({ id: item.urn, name: item.title ?? '', pic })
      // (a playlist: its id)
      else if (selection.urn == SC_BUZZING_SELECTION && item.kind == 'playlist' && item.id) buzzing.push({ id: String(item.id), name: item.title ?? '', pic })
    }
  }
  const allGenres = trending.filter(chart => chart.id.endsWith(':all-genres'))
  return [...allGenres, ...buzzing, ...trending.filter(chart => !allGenres.includes(chart))]
}

/**
 * The playlists made by SoundCloud ("Curated by SoundCloud", "Artists to watch out for"...: the home page)
 */
export const getSoundcloudCuratedPlaylists = async(): Promise<Array<{ id: string, name: string, pic: string | null }>> => {
  const data = await scGet<ScPage<ScSelection>>('mixed-selections', { limit: '10' })
  const playlists: Array<{ id: string, name: string, pic: string | null }> = []
  for (const selection of data.collection) {
    for (const item of (selection.items?.collection ?? []) as Array<{ kind?: string, id?: number, title?: string, artwork_url?: string | null, calculated_artwork_url?: string | null }>) {
      if (item.kind != 'playlist' || !item.id) continue
      playlists.push({ id: String(item.id), name: item.title ?? '', pic: scBigImg(item.calculated_artwork_url ?? item.artwork_url) })
    }
  }
  return playlists
}

/**
 * The songs of a chart of SoundCloud
 */
export const getSoundcloudChart = async(urn: string): Promise<LX.Music.MusicInfoOnline[]> => {
  // a playlist (the "Buzzing" ones): its id
  if (/^\d+$/.test(urn)) return (await getSoundcloudAlbum(urn)).list
  const data = await scGet<ScPlaylist>(`system-playlists/${urn}`, {})
  const ids = (data.tracks ?? []).map(t => t.id)
  const byId = new Map<number, ScTrack>()
  for (const t of data.tracks ?? []) if (t.title) byId.set(t.id, t as ScTrack)
  const missing = ids.filter(id => !byId.has(id))
  for (let i = 0; i < missing.length; i += SC_IDS_PER_REQUEST) {
    const list = await scGet<ScTrack[]>('tracks', { ids: missing.slice(i, i + SC_IDS_PER_REQUEST).join(',') })
    for (const t of list) byId.set(t.id, t)
  }
  return ids.map(id => byId.get(id)).filter((t): t is ScTrack => !!t && isScPlayable(t)).map(t => toMusicInfo(toScTrack(t)))
}

/**
 * An album of a secondary source with its songs (album pages)
 */
export const getSecondaryAlbum = async(source: string, id: string): Promise<{ name: string, author: string, img: string | null, list: LX.Music.MusicInfoOnline[] }> => {
  switch (source) {
    case 'sc': return getSoundcloudAlbum(id)
    case 'bc': return getBandcampAlbum(id)
    case 'kh': return getKhinsiderAlbum(id)
  }
  throw new Error(`no albums for the source: ${source}`)
}

/**
 * The audio of a secondary source song
 */
/**
 * Key of a song to find it among the songs of the main sources (search results without the duplicates)
 */
export const songKey = (name: string, singer: string) => `${words(name).join(' ')}|${words(singer.split(/[、&,/，]/)[0] ?? '').join(' ')}`

/* ---------- one result per song (sources not shown) ---------- */

// the source a merged song plays from first, then the next one... (then the others, in the order of the search)
const MERGE_SOURCE_PRIORITY = ['wy', 'kw']
const MERGE_MAX_INTERVAL_DIFF = 3
const MERGED_COPIES_MAX = 3000
// the other copies of a merged song by its id, to play it from them when its source fails
const mergedCopies = new Map<string, LX.Music.MusicInfoOnline[]>()

// a source the music source (api) does not support comes after all the supported ones
const sourceRank = (source: string, isSupported: (source: string) => boolean) => {
  const index = MERGE_SOURCE_PRIORITY.indexOf(source)
  return (index < 0 ? MERGE_SOURCE_PRIORITY.length : index) + (isSupported(source) ? 0 : MERGE_SOURCE_PRIORITY.length + 1)
}
const intervalSeconds = (interval: string | null | undefined) => {
  if (!interval) return NaN
  return interval.split(':').reduce((total, part) => total * 60 + parseInt(part), 0)
}

// a source marks the explicit version of a song, another one does not ("as if" / "as if (Explicit)"): the same
// song (a clean version is another one)
const EXPLICIT_RXP = /\s*[([（【［]\s*explicit(?:\s+version)?\s*[)\]）】］]/gi
export const mergeNameKey = (name: string) => words(name.replace(EXPLICIT_RXP, ' ')).join(' ')
/** whether a name is the one of the explicit version of a song ("Song (Explicit)") */
export const isExplicitName = (name: string) => /[([（【［]\s*explicit\b/i.test(name)
const singerKeys = (singer: string) => singer.split(/[、&,/，;]|\s+(?:feat\.?|ft\.?|x)\s+/i).map(s => words(s).join(' ')).filter(s => s)

/**
 * The other copies of a merged search result (the same song on other main sources), in the order to try them
 */
export const getMergedCopies = (id: string) => mergedCopies.get(id)

/**
 * One result per song: the copies of the same song on several main sources (same name, apart from an
 * "(Explicit)" tag, a singer in common, durations 3 s apart at most) become one, at the place of the best
 * ranked copy. It is the NetEase copy, else the Kuwo
 * one, else the best ranked (the sources the music source supports first); the others are kept to play the
 * song from when its source fails
 */
export const mergeSameSongs = <T extends LX.Music.MusicInfo>(list: T[], isSupported: (source: string) => boolean = () => true): T[] => {
  const groupsByKey = new Map<string, T[][]>()
  const groups: T[][] = []
  for (const musicInfo of list) {
    if (musicInfo.source == 'local' || isSecondarySource(musicInfo.source)) {
      groups.push([musicInfo])
      continue
    }
    const key = mergeNameKey(musicInfo.name)
    const seconds = intervalSeconds(musicInfo.interval)
    const singers = singerKeys(musicInfo.singer)
    let keyGroups = groupsByKey.get(key)
    if (!keyGroups) groupsByKey.set(key, keyGroups = [])
    const group = keyGroups.find(g => {
      const groupSeconds = intervalSeconds(g[0].interval)
      if (!Number.isNaN(seconds) && !Number.isNaN(groupSeconds) && Math.abs(groupSeconds - seconds) > MERGE_MAX_INTERVAL_DIFF) return false
      // the sources list the singers of a song in different orders: one singer in common
      const groupSingers = singerKeys(g[0].singer)
      return !singers.length || !groupSingers.length || singers.some(singer => groupSingers.includes(singer))
    })
    if (group) group.push(musicInfo)
    else {
      const newGroup = [musicInfo]
      keyGroups.push(newGroup)
      groups.push(newGroup)
    }
  }
  if (mergedCopies.size > MERGED_COPIES_MAX) mergedCopies.clear()
  return groups.map(group => {
    if (group.length == 1) return group[0]
    // stable: the same rank keeps the order of the search
    // the explicit version first when a source has both ("Song (Explicit)" and "Song"), the platform order kept
    const sorted = [...group].sort((a, b) => sourceRank(a.source, isSupported) - sourceRank(b.source, isSupported) || Number(isExplicitName(b.name)) - Number(isExplicitName(a.name)))
    const copies = sorted.slice(1) as unknown as LX.Music.MusicInfoOnline[]
    // the results merged before (next page) keep their copies
    const ids = new Set(group.map(m => m.id))
    for (const m of group) {
      for (const copy of mergedCopies.get(m.id) ?? []) {
        if (ids.has(copy.id)) continue
        ids.add(copy.id)
        copies.push(copy)
      }
    }
    copies.sort((a, b) => sourceRank(a.source, isSupported) - sourceRank(b.source, isSupported))
    mergedCopies.set(sorted[0].id, copies)
    return sorted[0]
  })
}

/**
 * Name and singer of a secondary source song to find it on the main sources (lyrics): an upload named
 * "Artist - Title (Official Video)" is the song "Title" of "Artist"
 */
export const secondaryLookupInfo = (name: string, singer: string) => {
  const clean = name.replace(/[([【［][^)\]】］]*[)\]】］]/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = clean.split(/\s+[-–—|]\s+/)
  if (parts.length == 2 && parts[0] && parts[1]) return { name: parts[1].trim(), singer: parts[0].trim() }
  return { name: clean || name, singer }
}

/**
 * All the words of the search are in the song (name + singer), whatever their order
 */
export const coversAllWords = (query: string, name: string, singer: string) => {
  const queryWords = words(query)
  if (!queryWords.length) return false
  const songText = words(`${name} ${singer}`).join(' ')
  return queryWords.every(w => songText.includes(w))
}

/**
 * Other orders of the words of the search for the main sources: their search depends on the order
 * ("glaive the prom" does not find the song "the prom glaive" finds). The "Artist - Title" split of an
 * upload with the same words first, then the first word last
 */
export const reorderedQueries = (query: string, secondaryList: LX.Music.MusicInfoOnline[]): string[] => {
  const queryWords = words(query)
  if (queryWords.length < 2) return []
  const original = queryWords.join(' ')
  const sortedWords = [...queryWords].sort().join(' ')
  const result: string[] = []
  for (const m of secondaryList) {
    const parts = m.name.replace(/[([【［].*?[)\]】］]/g, ' ').split(/\s+[-–—|]\s+/)
    if (parts.length != 2) continue
    const [artist, title] = parts.map(p => words(p).join(' '))
    if (!artist || !title) continue
    const reordered = `${title} ${artist}`
    if (reordered.split(' ').sort().join(' ') != sortedWords) continue
    if (reordered != original) result.push(reordered)
    break
  }
  const rotated = [...queryWords.slice(1), queryWords[0]].join(' ')
  if (!result.includes(rotated)) result.push(rotated)
  return result
}

// words of an upload title that say nothing about the song
const NEUTRAL_WORDS = new Set(['official', 'audio', 'video', 'music', 'lyric', 'lyrics', 'visualizer', 'visualiser', 'mv', 'hd', 'hq', '4k', 'topic', 'ft', 'feat', 'prod', 'x', 'by', 'full', 'version', 'song'])
// versions of the song that are not the song (unless searched for)
const ALTERED_WORDS = ['slowed', 'sped', 'reverb', 'nightcore', 'hour', 'hours', 'loop', 'cover', 'remix', 'karaoke', 'instrumental', '8d', 'boosted', 'reaction', 'tutorial', 'live', 'mashup', 'edit']
// a main source song ahead of an upload that matches as well (main songs are exact, good quality)
const MAIN_BONUS = 2

/**
 * How well a song matches the search, whatever the order of the words: the words of the search found
 * in the song, then the words of the song that are not in the search (upload channel, extra title words),
 * less for an altered version (slowed, cover, 1 hour...) of an upload
 */
export const relevanceScore = (query: string, name: string, singer: string, secondary: boolean) => {
  const queryWords = words(query)
  if (!queryWords.length) return 0
  const queryText = queryWords.join(' ')
  const songText = words(`${name} ${singer}`).join(' ')
  // substring: a search without spaces (chinese) is one word
  const coverage = queryWords.filter(w => songText.includes(w)).length / queryWords.length
  const querySet = new Set(queryWords)
  const songWords = words(`${name} ${singer}`).filter(w => !NEUTRAL_WORDS.has(w) || querySet.has(w))
  const precision = songWords.length ? songWords.filter(w => querySet.has(w) || queryText.includes(w)).length / songWords.length : 0
  let score = coverage * 10 + precision * 3
  if (secondary) {
    if (ALTERED_WORDS.some(w => songWords.includes(w) && !querySet.has(w))) score -= 4
  } else score += MAIN_BONUS
  return score
}
