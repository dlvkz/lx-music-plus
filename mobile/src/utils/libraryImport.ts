import { deezerToChartTrack, getSpotifyEntity, isTrackMatch, matchTrack, SPOTIFY_ALBUM_PREFIX, type ChartSearch, type ChartTrack, type DeezerTrack } from './chartSources'
import { getArtistPicture } from './discovery'
import { searchAlbums } from './entitySearch'
import { getLovedTracks } from './lastfm'
import {
  decodeHtml,
  getSecondaryPlaylist,
  getSoundcloudAlbum,
  getSoundcloudLibrary,
  mergeNameKey,
  resolveSoundcloudUrl,
  searchSecondary,
  secondaryGetJson,
  secondaryGetText,
  toMusicInfo,
} from './secondarySources'

// Import of a library from another platform (the same file in the desktop and the mobile app): the liked songs,
// playlists, followed artists and saved albums of an account (SoundCloud, Last.fm, Deezer, NetEase), of a link
// (a playlist / album of Spotify, Deezer, YouTube, SoundCloud, Apple Music or a main source) or of files (CSV / TXT,
// the data exports of Spotify / Apple Music, Google Takeout). The songs are looked for on the main sources (like
// the charts of Spotify, chartSources.ts), then on SoundCloud / YouTube; the import runs in the background (it
// goes on when its page is left, and after a restart), its results are checked before they are written.

/* ---------- what is imported ---------- */

export interface ImportTrack extends ChartTrack {
  /** a song played as it is (SoundCloud likes, the songs of the main sources): not looked for */
  musicInfo?: LX.Music.MusicInfoOnline
  /** taken when the song is found on no main source (the video of a YouTube playlist) */
  fallback?: LX.Music.MusicInfoOnline
  /** YouTube (Google Takeout: the ids only): its title is asked for */
  ytId?: string
}

export interface ImportList {
  key: string
  name: string
  img?: string | null
  /** null: not known before it is loaded */
  count: number | null
  tracks?: ImportTrack[]
  /** loaded only when it is chosen (the playlists of an account) */
  load?: () => Promise<ImportTrack[]>
  /** not chosen at first (the playlist of an album link) */
  defaultOff?: boolean
}

export interface ImportArtist {
  name: string
  img?: string | null
}

export interface ImportAlbum {
  name: string
  artist: string
  img?: string | null
}

export interface ImportSource {
  /** where it comes from: "SoundCloud: name", the name of a file... */
  title: string
  liked: ImportList | null
  playlists: ImportList[]
  artists: ImportArtist[]
  albums: ImportAlbum[]
  /** shown with it (Spotify links: their first 100 songs only) */
  note?: string
}

export interface ImportSelection {
  liked: boolean
  /** the keys of the playlists */
  playlists: string[]
  artists: boolean
  albums: boolean
}

/* ---------- the app ---------- */

export interface ImportWriter {
  /** the songs of the loved list (the songs already there are not added again) */
  getLoved: () => Promise<LX.Music.MusicInfo[]>
  addLoved: (list: LX.Music.MusicInfoOnline[]) => Promise<void>
  createPlaylist: (name: string, list: LX.Music.MusicInfoOnline[]) => Promise<void>
  addArtist: (name: string, img: string | null) => void
  addAlbum: (album: { source: string, id: string, name: string, img: string | null }) => void
}

export interface ImportEnv {
  /** the search of a main source */
  search: ChartSearch
  /** the main sources the songs are looked for on, the first one first */
  sources: readonly string[]
  isSupported?: (source: string) => boolean
  /** the sources the albums are looked for on */
  albumSources: readonly string[]
  /** a playlist of a main source (its id or its link) with all its songs */
  getMainPlaylist: (source: string, id: string) => Promise<{ name: string, img: string | null, list: LX.Music.MusicInfoOnline[] }>
  storage: {
    load: () => Promise<ImportJob | null>
    save: (job: ImportJob | null) => Promise<void>
  }
  writer: ImportWriter
}

let env: ImportEnv | null = null
export const setImportEnv = (importEnv: ImportEnv) => {
  env = importEnv
}
const getEnv = () => {
  if (!env) throw new Error('import: no env')
  return env
}

/* ---------- files ---------- */

const LIKED_RXP = /liked|loved|favou?rites?|喜欢|收藏|最爱|library/i

// "A, B" / "A; B" / "A & B" → "A、B"
const joinSingers = (text: string) => text.split(/\s*;\s*|\s*,\s+|\s+&\s+|\s*、\s*/).map(s => s.trim()).filter(s => s).join('、')

const parseDuration = (value: string, isMs: boolean) => {
  const text = value.trim()
  if (!text) return 0
  if (text.includes(':')) return text.split(':').reduce((total, part) => total * 60 + (parseInt(part) || 0), 0) * 1000
  const number = parseFloat(text)
  if (!number) return 0
  // (a number this big is in milliseconds)
  return isMs || number > 10000 ? Math.round(number) : Math.round(number * 1000)
}

// a CSV file (quoted fields, "," / ";" / tab)
const parseCsv = (text: string): string[][] => {
  const firstLine = text.slice(0, text.includes('\n') ? text.indexOf('\n') : undefined)
  const delimiter = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char == '"') {
        if (text[i + 1] == '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += char
    } else if (char == '"' && !field) quoted = true
    else if (char == delimiter) {
      row.push(field)
      field = ''
    } else if (char == '\n' || char == '\r') {
      if (char == '\r' && text[i + 1] == '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter(r => r.some(cell => cell.trim()))
}

// the columns of a list of songs (CSV of Exportify / TuneMyMusic / Soundiiz, Apple Music, Google Takeout...)
const COLUMNS = {
  name: ['track name', 'title', 'song', 'song name', 'track', 'track title', 'name', 'trackname', '歌曲名', '歌名', '标题'],
  singer: ['artist name(s)', 'artist names', 'artist name', 'artist', 'artists', 'album artist', 'artistname', '歌手', '艺人'],
  album: ['album name', 'album', 'album title', 'albumname', '专辑'],
  duration: ['duration (ms)', 'duration_ms', 'track duration', 'duration', 'length', 'time', '时长'],
  ytId: ['video id', 'videoid', 'video_id'],
}
const findColumn = (header: string[], names: string[]) => {
  const cells = header.map(cell => cell.trim().toLowerCase().replace(/^\ufeff/, ''))
  for (const name of names) {
    const index = cells.indexOf(name)
    if (index > -1) return index
  }
  return -1
}

const rowsToTracks = (header: string[], rows: string[][]): ImportTrack[] => {
  const index = {
    name: findColumn(header, COLUMNS.name),
    singer: findColumn(header, COLUMNS.singer),
    album: findColumn(header, COLUMNS.album),
    duration: findColumn(header, COLUMNS.duration),
    ytId: findColumn(header, COLUMNS.ytId),
  }
  const durationIsMs = index.duration > -1 && /ms|milli/i.test(header[index.duration])
  const tracks: ImportTrack[] = []
  for (const row of rows) {
    const cell = (i: number) => (i > -1 ? row[i] ?? '' : '').trim()
    const ytId = cell(index.ytId)
    if (ytId) {
      tracks.push({ name: '', singer: '', durationMs: 0, ytId })
      continue
    }
    const name = cell(index.name)
    if (!name) continue
    tracks.push({
      name,
      singer: joinSingers(cell(index.singer)),
      album: cell(index.album) || undefined,
      durationMs: parseDuration(cell(index.duration), durationIsMs),
    })
  }
  return tracks
}

const parseCsvTracks = (text: string): ImportTrack[] => {
  const rows = parseCsv(text)
  // (Google Takeout: lines about the playlist before the songs)
  const headerIndex = rows.slice(0, 15).findIndex(row => findColumn(row, COLUMNS.ytId) > -1 || (findColumn(row, COLUMNS.name) > -1 && findColumn(row, COLUMNS.singer) > -1))
  if (headerIndex < 0) throw new Error('no columns of songs (title, artist) found')
  return rowsToTracks(rows[headerIndex], rows.slice(headerIndex + 1))
}

// one song a line: "Artist - Title"
const parseTextTracks = (text: string): ImportTrack[] => text.split(/\r?\n/).map(line => line.trim()).filter(line => line).map(line => {
  const separator = line.indexOf(' - ')
  if (separator < 0) return { name: line, singer: '', durationMs: 0 }
  return { name: line.slice(separator + 3).trim(), singer: joinSingers(line.slice(0, separator)), durationMs: 0 }
})

const objectsToTracks = (list: Array<Record<string, unknown>>): ImportTrack[] => {
  const keys = Array.from(new Set(list.flatMap(item => Object.keys(item))))
  return rowsToTracks(keys, list.map(item => keys.map(key => {
    const value = item[key]
    return typeof value == 'string' || typeof value == 'number' ? String(value) : ''
  })))
}

interface SpotifyLibraryJson {
  tracks?: Array<{ artist?: string, album?: string, track?: string }>
  albums?: Array<{ artist?: string, album?: string }>
  artists?: Array<{ name?: string }>
}
interface SpotifyPlaylistJson {
  playlists?: Array<{ name?: string, items?: Array<{ track?: { trackName?: string, artistName?: string, albumName?: string } | null }> }>
}

export interface ImportFile {
  name: string
  text: string
}

const fileTitle = (name: string) => name.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')

/**
 * What files have (CSV / TXT lists of songs, the data exports of Spotify / Apple Music, Google Takeout): the files
 * named like "Liked songs" are the liked songs, the others playlists
 */
export const parseImportFiles = (files: ImportFile[]): ImportSource => {
  const source: ImportSource = { title: files.map(file => fileTitle(file.name)).join(', '), liked: null, playlists: [], artists: [], albums: [] }
  const likedTracks: ImportTrack[] = []
  const addList = (name: string, tracks: ImportTrack[]) => {
    if (!tracks.length) return
    if (LIKED_RXP.test(name)) likedTracks.push(...tracks)
    else source.playlists.push({ key: `file_${source.playlists.length}`, name, count: tracks.length, tracks })
  }
  for (const file of files) {
    const text = file.text.replace(/^\ufeff/, '')
    const name = fileTitle(file.name)
    const trimmed = text.trim()
    if (/\.json$/i.test(file.name) || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      let data: unknown
      try {
        data = JSON.parse(trimmed)
      } catch {
        throw new Error(`${file.name}: not a JSON file`)
      }
      const library = data as SpotifyLibraryJson & SpotifyPlaylistJson
      if (!Array.isArray(data) && (Array.isArray(library.tracks) || Array.isArray(library.albums) || Array.isArray(library.artists))) {
        // Spotify: YourLibrary.json (the liked songs, saved albums, followed artists)
        likedTracks.push(...(library.tracks ?? []).filter(t => t.track).map(t => ({ name: t.track!, singer: joinSingers(t.artist ?? ''), album: t.album, durationMs: 0 })))
        source.albums.push(...(library.albums ?? []).filter(a => a.album).map(a => ({ name: a.album!, artist: a.artist ?? '' })))
        source.artists.push(...(library.artists ?? []).filter(a => a.name).map(a => ({ name: a.name! })))
      } else if (!Array.isArray(data) && Array.isArray(library.playlists)) {
        // Spotify: Playlist1.json...
        for (const playlist of library.playlists) {
          addList(playlist.name ?? name, (playlist.items ?? []).map(item => item.track).filter(t => t?.trackName).map(t => ({ name: t!.trackName!, singer: joinSingers(t!.artistName ?? ''), album: t!.albumName, durationMs: 0 })))
        }
      } else if (Array.isArray(data)) {
        // Apple Music (Apple Music Library Tracks.json...), lists of songs
        addList(name, objectsToTracks(data.filter(item => item && typeof item == 'object') as Array<Record<string, unknown>>))
      } else throw new Error(`${file.name}: no songs found`)
    } else if (/\.(csv|tsv)$/i.test(file.name) || /^[^\n]*[,;\t]/.test(trimmed)) {
      addList(name, parseCsvTracks(text))
    } else addList(name, parseTextTracks(text))
  }
  if (likedTracks.length) source.liked = { key: 'liked', name: 'liked', count: likedTracks.length, tracks: likedTracks }
  if (!source.liked && !source.playlists.length && !source.artists.length && !source.albums.length) throw new Error('no songs found')
  return source
}

/* ---------- links / accounts ---------- */

export type ImportAccountPlatform = 'soundcloud' | 'lastfm' | 'deezer' | 'netease'

const DEEZER_API = 'https://api.deezer.com'
const ACCOUNT_MAX = 5000

const direct = (musicInfo: LX.Music.MusicInfoOnline): ImportTrack => ({
  name: musicInfo.name,
  singer: musicInfo.singer,
  durationMs: 0,
  musicInfo,
})

// every page of a list of the Deezer API
const getDeezerAll = async<T>(url: string, max = ACCOUNT_MAX): Promise<T[]> => {
  const items: T[] = []
  let next: string | undefined = `${url}${url.includes('?') ? '&' : '?'}limit=100`
  while (next && items.length < max) {
    const data: { data?: T[], next?: string, error?: { message?: string } } = await secondaryGetJson(next)
    if (data.error) throw new Error(`Deezer: ${data.error.message ?? 'error'}`)
    items.push(...(data.data ?? []))
    next = data.data?.length ? data.next : undefined
  }
  return items.slice(0, max)
}

const getDeezerTracks = async(path: string) => (await getDeezerAll<DeezerTrack>(`${DEEZER_API}/${path}`)).filter(track => track.title).map(deezerToChartTrack)

const getDeezerAccount = async(userId: string): Promise<ImportSource> => {
  const user = await secondaryGetJson<{ name?: string, error?: { message?: string } }>(`${DEEZER_API}/user/${userId}`)
  if (user.error) throw new Error(`Deezer: ${user.error.message ?? 'account not found'}`)
  const [playlists, artists, albums] = await Promise.all([
    getDeezerAll<{ id: number, title: string, nb_tracks?: number, picture_xl?: string | null, is_loved_track?: boolean }>(`${DEEZER_API}/user/${userId}/playlists`),
    getDeezerAll<{ name: string, picture_xl?: string | null }>(`${DEEZER_API}/user/${userId}/artists`),
    getDeezerAll<{ title: string, cover_xl?: string | null, artist?: { name?: string } }>(`${DEEZER_API}/user/${userId}/albums`),
  ])
  return {
    title: `Deezer: ${user.name ?? userId}`,
    liked: { key: 'liked', name: 'liked', count: null, load: async() => getDeezerTracks(`user/${userId}/tracks`) },
    // (its "loved tracks" playlist: the liked songs)
    playlists: playlists.filter(p => !p.is_loved_track).map(p => ({ key: `dz_${p.id}`, name: p.title, img: p.picture_xl ?? null, count: p.nb_tracks ?? null, load: async() => getDeezerTracks(`playlist/${p.id}/tracks`) })),
    artists: artists.map(a => ({ name: a.name, img: a.picture_xl ?? null })),
    albums: albums.map(a => ({ name: a.title, artist: a.artist?.name ?? '', img: a.cover_xl ?? null })),
  }
}

const getSoundcloudAccount = async(userId: string, name: string): Promise<ImportSource> => {
  const library = await getSoundcloudLibrary(userId)
  return {
    title: `SoundCloud: ${name}`,
    liked: { key: 'liked', name: 'liked', count: library.liked.length, tracks: library.liked.map(direct) },
    playlists: library.playlists.map(p => ({ key: `sc_${p.id}`, name: p.name, img: p.img, count: p.count, load: async() => (await getSoundcloudAlbum(p.id)).list.map(direct) })),
    artists: library.artists,
    albums: [],
  }
}

const getLastfmAccount = async(user: string): Promise<ImportSource> => {
  const loved = await getLovedTracks(user)
  return {
    title: `Last.fm: ${user}`,
    liked: { key: 'liked', name: 'liked', count: loved.length, tracks: loved.map(t => ({ name: t.name, singer: t.artist, durationMs: 0 })) },
    playlists: [],
    artists: [],
    albums: [],
  }
}

const getNeteaseAccount = async(uid: string): Promise<ImportSource> => {
  const data = await secondaryGetJson<{ playlist?: Array<{ id: number, name: string, trackCount?: number, coverImgUrl?: string, specialType?: number, creator?: { userId?: number, nickname?: string } }> }>(`https://music.163.com/api/user/playlist?uid=${uid}&limit=1000&offset=0`)
  const lists = data.playlist ?? []
  if (!lists.length) throw new Error('NetEase: no playlists found (the account may be private)')
  // its first list: the liked songs ("…喜欢的音乐")
  const liked = lists.find(p => p.specialType == 5) ?? lists[0]
  const load = (id: number) => async() => (await getEnv().getMainPlaylist('wy', String(id))).list.map(direct)
  return {
    title: `NetEase: ${liked.creator?.nickname ?? uid}`,
    liked: { key: 'liked', name: 'liked', count: liked.trackCount ?? null, load: load(liked.id) },
    playlists: lists.filter(p => p != liked).map(p => ({ key: `wy_${p.id}`, name: p.name, img: p.coverImgUrl ?? null, count: p.trackCount ?? null, load: load(p.id) })),
    artists: [],
    albums: [],
  }
}

/**
 * The library of an account (a username / a link of its profile)
 */
export const getImportFromAccount = async(platform: ImportAccountPlatform, input: string): Promise<ImportSource> => {
  const text = input.trim()
  if (!text) throw new Error('empty')
  switch (platform) {
    case 'soundcloud': {
      const url = /^https?:/.test(text) ? text : `https://soundcloud.com/${text.replace(/^@/, '')}`
      const user = await resolveSoundcloudUrl(url)
      if (user.kind != 'user') throw new Error('SoundCloud: not an account')
      return getSoundcloudAccount(user.id, user.name)
    }
    case 'lastfm':
      return getLastfmAccount(/last\.fm\/(?:[a-z]{2}\/)?user\/([^/?#]+)/i.exec(text)?.[1] ?? text)
    case 'deezer': {
      const id = /deezer\.com\/(?:[a-z]{2}\/)?profile\/(\d+)/i.exec(text)?.[1] ?? (/^\d+$/.test(text) ? text : null)
      if (!id) throw new Error('Deezer: paste the link of the profile (deezer.com/profile/…)')
      return getDeezerAccount(id)
    }
    case 'netease': {
      const id = /[?&]id=(\d+)/.exec(text)?.[1] ?? (/^\d+$/.test(text) ? text : null)
      if (!id) throw new Error('NetEase: paste the link of the profile (music.163.com/#/user/home?id=…)')
      return getNeteaseAccount(id)
    }
  }
}

// "Artist - Title (Official Video)" → the title and the artist
const YT_NOISE_RXP = /\s*[([](?:official|lyrics?|audio|video|visuali[sz]er|music video|mv|hd|hq|4k|remaster(?:ed)?)[^)\]]*[)\]]/gi
export const splitYoutubeTitle = (title: string, channel: string) => {
  const clean = title.replace(YT_NOISE_RXP, '').trim()
  const artist = channel.replace(/ - Topic$/, '').replace(/VEVO$/i, '').trim()
  const separator = clean.indexOf(' - ')
  if (separator > 0 && !/ - Topic$/.test(channel)) return { name: clean.slice(separator + 3).trim(), singer: joinSingers(clean.slice(0, separator)) }
  return { name: clean, singer: artist }
}

const getYoutubeList = async(listId: string): Promise<ImportSource> => {
  const playlist = await getSecondaryPlaylist('yt', listId)
  return {
    title: `YouTube: ${playlist.name}`,
    liked: null,
    playlists: [{
      key: `yt_${listId}`,
      name: playlist.name || 'YouTube',
      img: playlist.img,
      count: playlist.list.length,
      // looked for on the main sources first, the video else
      tracks: playlist.list.map(musicInfo => {
        const { name, singer } = splitYoutubeTitle(musicInfo.name, musicInfo.singer)
        return { name, singer, durationMs: 0, fallback: musicInfo }
      }),
    }],
    artists: [],
    albums: [],
  }
}

interface AppleItem { id?: string, title?: string, artistName?: string, duration?: number }
const getApplePage = async(url: string, isAlbum: boolean): Promise<ImportSource> => {
  const page = await secondaryGetText(url)
  const json = /<script type="application\/json" id="serialized-server-data">([\s\S]*?)<\/script>/.exec(page)?.[1]
  if (!json) throw new Error('Apple Music: playlist data not found')
  const items: AppleItem[] = []
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item)
    } else if (value && typeof value == 'object') {
      const item = value as AppleItem
      if (typeof item.id == 'string' && item.id.startsWith('track-lockup') && item.title) items.push(item)
      else for (const child of Object.values(value)) walk(child)
    }
  }
  walk(JSON.parse(json))
  const title = decodeHtml(/<meta property="og:title" content="([^"]*)"/.exec(page)?.[1] ?? 'Apple Music')
  const img = /<meta property="og:image" content="([^"]*)"/.exec(page)?.[1] ?? null
  // (the songs of an album: its artist)
  const albumArtist = decodeHtml(/"byArtist":\s*\[?\s*\{[^}]*"name":\s*"([^"]+)"/.exec(page)?.[1] ?? '')
  const name = title.replace(/ (?:by|par|von|de) .*$/, '').replace(/ on Apple Music$/, '')
  const tracks = items.map(item => ({ name: item.title!, singer: joinSingers(item.artistName ?? albumArtist), durationMs: item.duration ?? 0, pic: img }))
  return {
    title: `Apple Music: ${name}`,
    liked: null,
    playlists: [{ key: 'am', name, img, count: tracks.length, tracks, defaultOff: isAlbum }],
    artists: [],
    albums: isAlbum ? [{ name, artist: albumArtist, img }] : [],
  }
}

const MAIN_HOSTS: Array<[RegExp, string]> = [
  [/163\.com|163cn\.tv/, 'wy'],
  [/qq\.com/, 'tx'],
  [/kuwo\.cn/, 'kw'],
  [/kugou\.com/, 'kg'],
  [/migu\.cn/, 'mg'],
]

/**
 * A link that opens as a page of the app (the box that opens a playlist by its link): a chart (Spotify / Deezer
 * playlists and albums, their songs found on the main sources) or a playlist of a source
 */
export const detectPlaylistLink = (text: string): { kind: 'chart', source: 'sp' | 'dz', id: string } | { kind: 'songlist', source: string, id: string } | null => {
  const link = text.trim()
  let match = /open\.spotify\.com\/(?:intl-[\w-]+\/)?(playlist|album)\/(\w+)/.exec(link)
  if (match) return { kind: 'chart', source: 'sp', id: match[1] == 'album' ? `${SPOTIFY_ALBUM_PREFIX}${match[2]}` : match[2] }
  match = /deezer\.com\/(?:[a-z]{2}\/)?(playlist|album)\/(\d+)/.exec(link)
  if (match) return { kind: 'chart', source: 'dz', id: match[1] == 'album' ? `album:${match[2]}` : match[2] }
  match = /youtube\.com\/.*[?&]list=([\w-]+)/.exec(link)
  if (match) return { kind: 'songlist', source: 'yt', id: match[1] }
  if (/soundcloud\.com\/[^/]+\/sets\//.test(link)) return { kind: 'songlist', source: 'sc', id: link }
  if (/^https?:/.test(link)) {
    for (const [rxp, source] of MAIN_HOSTS) if (rxp.test(link)) return { kind: 'songlist', source, id: link }
  }
  return null
}

/**
 * What a link has: a playlist / album (Spotify, Deezer, YouTube, SoundCloud, Apple Music, the main sources) or an
 * account (SoundCloud, Deezer, Last.fm, NetEase)
 */
export const getImportFromLink = async(input: string): Promise<ImportSource> => {
  const link = input.trim()
  let match = /open\.spotify\.com\/(?:intl-[\w-]+\/)?(playlist|album)\/(\w+)/.exec(link)
  if (match) {
    const isAlbum = match[1] == 'album'
    const entity = await getSpotifyEntity(isAlbum ? 'album' : 'playlist', match[2])
    return {
      title: `Spotify: ${entity.name}`,
      liked: null,
      playlists: [{ key: `sp_${match[2]}`, name: entity.name, img: entity.img, count: entity.tracks.length, tracks: entity.tracks, defaultOff: isAlbum }],
      artists: [],
      albums: isAlbum ? [{ name: entity.name, artist: entity.tracks[0]?.singer.split('、')[0] ?? '', img: entity.img }] : [],
      // (its public page has the first 100 songs only)
      note: entity.tracks.length >= 100 ? 'spotify_limit' : undefined,
    }
  }
  match = /deezer\.com\/(?:[a-z]{2}\/)?(playlist|album|profile)\/(\d+)/.exec(link)
  if (match) {
    if (match[1] == 'profile') return getDeezerAccount(match[2])
    const isAlbum = match[1] == 'album'
    const info = await secondaryGetJson<{ title?: string, picture_xl?: string | null, cover_xl?: string | null, artist?: { name?: string }, error?: { message?: string } }>(`${DEEZER_API}/${match[1]}/${match[2]}`)
    if (info.error) throw new Error(`Deezer: ${info.error.message ?? 'not found'}`)
    const tracks = await getDeezerTracks(`${match[1]}/${match[2]}/tracks`)
    const name = info.title ?? 'Deezer'
    const img = info.picture_xl ?? info.cover_xl ?? null
    return {
      title: `Deezer: ${name}`,
      liked: null,
      playlists: [{ key: `dz_${match[2]}`, name, img, count: tracks.length, tracks, defaultOff: isAlbum }],
      artists: [],
      albums: isAlbum ? [{ name, artist: info.artist?.name ?? '', img }] : [],
    }
  }
  match = /youtube\.com\/.*[?&]list=([\w-]+)/.exec(link)
  if (match) return getYoutubeList(match[1])
  if (link.includes('soundcloud.com/')) {
    const target = await resolveSoundcloudUrl(link)
    if (target.kind == 'user') return getSoundcloudAccount(target.id, target.name)
    if (target.kind != 'playlist') throw new Error('SoundCloud: not an account or a playlist')
    const playlist = await getSoundcloudAlbum(target.id)
    return { title: `SoundCloud: ${playlist.name}`, liked: null, playlists: [{ key: `sc_${target.id}`, name: playlist.name, img: playlist.img, count: playlist.list.length, tracks: playlist.list.map(direct) }], artists: [], albums: [] }
  }
  match = /music\.apple\.com\/.*\/(playlist|album)\//.exec(link)
  if (match) return getApplePage(link, match[1] == 'album')
  match = /last\.fm\/(?:[a-z]{2}\/)?user\/([^/?#]+)/i.exec(link)
  if (match) return getLastfmAccount(decodeURIComponent(match[1]))
  if (/music\.163\.com\/.*user\/home\?id=\d+/.test(link)) return getNeteaseAccount(/[?&]id=(\d+)/.exec(link)![1])
  for (const [rxp, source] of MAIN_HOSTS) {
    if (!rxp.test(link)) continue
    const playlist = await getEnv().getMainPlaylist(source, link)
    return { title: playlist.name, liked: null, playlists: [{ key: `${source}_list`, name: playlist.name, img: playlist.img, count: playlist.list.length, tracks: playlist.list.map(direct) }], artists: [], albums: [] }
  }
  throw new Error('unsupported link')
}

/* ---------- the import ---------- */

export type ImportTrackStatus = 'pending' | 'found' | 'direct' | 'fallback' | 'notFound'

export interface ImportJobTrack {
  track: ImportTrack
  status: ImportTrackStatus
  musicInfo: LX.Music.MusicInfoOnline | null
  include: boolean
}

export interface ImportJobGroup {
  kind: 'liked' | 'playlist'
  name: string
  /** the indexes of its songs in `tracks` */
  tracks: number[]
}

export interface ImportJobAlbum {
  album: ImportAlbum
  status: 'pending' | 'found' | 'notFound'
  result: { source: string, id: string, name: string, img: string | null } | null
  include: boolean
}

export interface ImportJob {
  id: string
  title: string
  stage: 'loading' | 'matching' | 'review' | 'importing' | 'done' | 'failed'
  error?: string
  tracks: ImportJobTrack[]
  groups: ImportJobGroup[]
  artists: Array<{ artist: ImportArtist, include: boolean }>
  albums: ImportJobAlbum[]
  done: number
  total: number
  result?: { loved: number, playlists: number, songs: number, artists: number, albums: number, skipped: number }
}

let job: ImportJob | null = null
let running = false
let runId = 0
const listeners = new Set<(job: ImportJob | null) => void>()

export const getImportJob = () => job
export const onImportJobChange = (listener: (job: ImportJob | null) => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// the pages get a new object (their lists are kept: new ones when they change)
let notifyTimeout: ReturnType<typeof setTimeout> | null = null
const notify = (now = false) => {
  const send = () => {
    notifyTimeout = null
    const snapshot = job ? { ...job } : null
    for (const listener of listeners) listener(snapshot)
  }
  if (now) {
    if (notifyTimeout) clearTimeout(notifyTimeout)
    send()
  } else notifyTimeout ??= setTimeout(send, 250)
}
const save = async() => getEnv().storage.save(job).catch((err: unknown) => { console.log(err) })

const trackKey = (track: ImportTrack) => {
  if (track.musicInfo) return `id:${track.musicInfo.id}`
  if (track.ytId) return `yt:${track.ytId}`
  return `${mergeNameKey(track.name)}|${mergeNameKey(track.singer.split('、')[0] ?? '')}`
}

/**
 * Start the import of what was chosen: the songs are loaded, then looked for (in the background)
 */
export const startImport = async(source: ImportSource, selection: ImportSelection) => {
  if (running) throw new Error('an import is running')
  const id = ++runId
  job = { id: String(Date.now()), title: source.title, stage: 'loading', tracks: [], groups: [], artists: [], albums: [], done: 0, total: 0 }
  notify(true)
  try {
    const lists: Array<{ kind: ImportJobGroup['kind'], list: ImportList }> = []
    if (selection.liked && source.liked) lists.push({ kind: 'liked', list: source.liked })
    for (const playlist of source.playlists) if (selection.playlists.includes(playlist.key)) lists.push({ kind: 'playlist', list: playlist })
    const keys = new Map<string, number>()
    for (const { kind, list } of lists) {
      const tracks = list.tracks ?? (await list.load?.()) ?? []
      if (id != runId || !job) return
      const group: ImportJobGroup = { kind, name: list.name, tracks: [] }
      for (const track of tracks) {
        const key = trackKey(track)
        let index = keys.get(key)
        if (index == null) {
          index = job.tracks.length
          keys.set(key, index)
          job.tracks.push({ track, status: track.musicInfo ? 'direct' : 'pending', musicInfo: track.musicInfo ?? null, include: true })
        }
        if (!group.tracks.includes(index)) group.tracks.push(index)
      }
      job.groups.push(group)
      notify()
    }
    if (selection.artists) job.artists = source.artists.map(artist => ({ artist, include: true }))
    if (selection.albums) job.albums = source.albums.map(album => ({ album, status: 'pending', result: null, include: true }))
    job.total = job.tracks.length + job.albums.length + job.artists.length
    job.done = job.tracks.filter(t => t.status != 'pending').length
    job.stage = 'matching'
    notify(true)
    void save()
  } catch (err) {
    if (id != runId || !job) return
    job.stage = 'failed'
    job.error = (err as Error).message
    notify(true)
    return
  }
  void runMatching()
}

const SEARCH_CONCURRENCY = 4
const SAVE_EVERY = 25
const SECONDARY_FALLBACKS = ['sc', 'yt'] as const

// the title of a video of Google Takeout (ids only)
const getYoutubeTitle = async(ytId: string) => {
  const data = await secondaryGetJson<{ title?: string, author_name?: string }>(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`)}&format=json`)
  return { title: data.title ?? '', channel: data.author_name ?? '' }
}

const findTrack = async(item: ImportJobTrack) => {
  const importEnv = getEnv()
  const track = item.track
  if (track.ytId && !track.name) {
    const info = await getYoutubeTitle(track.ytId).catch(() => null)
    if (info?.title) {
      Object.assign(track, splitYoutubeTitle(info.title, info.channel))
      track.fallback = toMusicInfo({ source: 'yt', id: track.ytId, name: info.title, singer: info.channel.replace(/ - Topic$/, ''), albumName: '', durationMs: 0, img: `https://i.ytimg.com/vi/${track.ytId}/mqdefault.jpg`, url: `https://www.youtube.com/watch?v=${track.ytId}` })
    }
  }
  if (!track.name) return { status: 'notFound' as const, musicInfo: null }
  const found = await matchTrack(track, importEnv.search, importEnv.sources, importEnv.isSupported).catch(() => null)
  if (found) return { status: 'found' as const, musicInfo: found }
  if (track.fallback) return { status: 'fallback' as const, musicInfo: track.fallback }
  // SoundCloud, YouTube (a video can be longer than the song)
  const seconds = Math.round(track.durationMs / 1000)
  for (const source of SECONDARY_FALLBACKS) {
    const list = await searchSecondary(source, `${track.name} ${track.singer.split('、')[0] ?? ''}`, 5).catch(() => [])
    const match = list.find(musicInfo => isTrackMatch(musicInfo, track.name, track.singer, seconds, source == 'yt' ? 20 : 5))
    if (match) return { status: 'fallback' as const, musicInfo: match }
  }
  return { status: 'notFound' as const, musicInfo: null }
}

const findAlbum = async(item: ImportJobAlbum) => {
  const { name, artist } = item.album
  const list = await searchAlbums(`${name} ${artist}`.trim(), getEnv().albumSources, 10).catch(() => [])
  const nameKey = mergeNameKey(name)
  const artistKey = mergeNameKey(artist)
  const isArtist = (a: { artist: string }) => !artistKey || mergeNameKey(a.artist).includes(artistKey) || artistKey.includes(mergeNameKey(a.artist))
  // the album of the same name first (not its "Deluxe Version"), else one whose name starts with the other
  const album = list.find(a => mergeNameKey(a.name) == nameKey && isArtist(a)) ?? list.find(a => {
    const key = mergeNameKey(a.name)
    return (key.startsWith(nameKey) || nameKey.startsWith(key)) && isArtist(a)
  })
  return album ? { source: album.source, id: album.id, name: album.name, img: album.img ?? item.album.img ?? null } : null
}

const runMatching = async() => {
  if (running || !job || job.stage != 'matching') return
  running = true
  const id = runId
  const current = job
  let sinceSave = 0
  const step = () => {
    current.done++
    notify()
    if (++sinceSave >= SAVE_EVERY) {
      sinceSave = 0
      void save()
    }
  }
  try {
    let next = 0
    const worker = async() => {
      while (next < current.tracks.length) {
        if (id != runId) return
        const index = next++
        const item = current.tracks[index]
        if (item.status != 'pending') continue
        const result = await findTrack(item)
        if (id != runId) return
        current.tracks[index] = { ...item, ...result, include: result.status != 'notFound' }
        current.tracks = [...current.tracks]
        step()
      }
    }
    await Promise.all(Array.from({ length: SEARCH_CONCURRENCY }, worker))
    for (const [index, item] of current.albums.entries()) {
      if (id != runId) return
      if (item.status != 'pending') continue
      const result = await findAlbum(item)
      current.albums[index] = { ...item, status: result ? 'found' : 'notFound', result, include: !!result }
      current.albums = [...current.albums]
      step()
    }
    // the pictures of the artists (Deezer), a few at a time
    let nextArtist = 0
    const artistWorker = async() => {
      while (nextArtist < current.artists.length) {
        if (id != runId) return
        const index = nextArtist++
        const item = current.artists[index]
        if (!item.artist.img) {
          const img = await getArtistPicture(item.artist.name).catch(() => null)
          if (id != runId) return
          current.artists[index] = { ...item, artist: { ...item.artist, img } }
        }
        step()
      }
    }
    await Promise.all(Array.from({ length: SEARCH_CONCURRENCY }, artistWorker))
    if (id != runId) return
    current.artists = [...current.artists]
    current.done = current.total
    current.stage = 'review'
    notify(true)
    void save()
  } finally {
    // eslint-disable-next-line require-atomic-updates
    running = false
  }
}

/**
 * The import saved before (the app closed while it was running): it goes on
 */
export const resumeImport = async() => {
  if (!job) {
    const saved = await getEnv().storage.load().catch(() => null)
    // (an import started in the meantime)
    if (!saved || job) return
    // (loading: its lists are not known any more)
    if (saved.stage == 'loading' || saved.stage == 'importing') saved.stage = saved.stage == 'loading' ? 'failed' : 'review'
    job = saved
    notify(true)
  }
  if (job.stage == 'matching') void runMatching()
}

export const setImportTrackIncluded = (index: number, include: boolean) => {
  if (!job?.tracks[index]?.musicInfo) return
  job.tracks[index] = { ...job.tracks[index], include }
  job.tracks = [...job.tracks]
  notify(true)
  void save()
}
export const setImportGroupIncluded = (groupIndex: number, include: boolean) => {
  if (!job?.groups[groupIndex]) return
  for (const index of job.groups[groupIndex].tracks) if (job.tracks[index].musicInfo) job.tracks[index] = { ...job.tracks[index], include }
  job.tracks = [...job.tracks]
  notify(true)
  void save()
}
export const setImportArtistIncluded = (index: number, include: boolean) => {
  if (!job?.artists[index]) return
  job.artists[index] = { ...job.artists[index], include }
  job.artists = [...job.artists]
  notify(true)
  void save()
}
export const setImportAlbumIncluded = (index: number, include: boolean) => {
  if (!job?.albums[index]?.result) return
  job.albums[index] = { ...job.albums[index], include }
  job.albums = [...job.albums]
  notify(true)
  void save()
}

/**
 * Look for a song again with another name / artist (the songs not found)
 */
export const retryImportTrack = async(index: number, name: string, singer: string) => {
  const item = job?.tracks[index]
  if (!job || !item) return
  const current = job
  // (looked for by hand: its length is not checked, another version of it is fine)
  const retry: ImportJobTrack = { ...item, track: { ...item.track, name: name.trim(), singer: joinSingers(singer), durationMs: 0, ytId: undefined }, status: 'pending' }
  const result = await findTrack(retry)
  current.tracks[index] = { ...retry, ...result, include: result.status != 'notFound' }
  current.tracks = [...current.tracks]
  notify(true)
  void save()
  return result.status
}

const songKey = (musicInfo: LX.Music.MusicInfo) => `${mergeNameKey(musicInfo.name)}|${mergeNameKey(musicInfo.singer.split(/[、&,/，]/)[0] ?? '')}`

/**
 * Write what was found: the liked songs into the loved list (the ones there already left out), the playlists as
 * new lists, the artists / albums into the library
 */
export const finishImport = async() => {
  if (!job || job.stage != 'review') return
  const current = job
  const writer = getEnv().writer
  current.stage = 'importing'
  notify(true)
  const result = { loved: 0, playlists: 0, songs: 0, artists: 0, albums: 0, skipped: 0 }
  try {
    for (const group of current.groups) {
      const seen = new Set<string>()
      const list: LX.Music.MusicInfoOnline[] = []
      for (const index of group.tracks) {
        const item = current.tracks[index]
        if (!item.include || !item.musicInfo || seen.has(item.musicInfo.id)) continue
        seen.add(item.musicInfo.id)
        list.push(item.musicInfo)
      }
      if (group.kind == 'liked') {
        const loved = await writer.getLoved()
        const ids = new Set(loved.map(m => m.id))
        const keys = new Set(loved.map(songKey))
        const added = list.filter(m => !ids.has(m.id) && !keys.has(songKey(m)))
        result.skipped += list.length - added.length
        if (added.length) await writer.addLoved(added)
        result.loved += added.length
      } else if (list.length) {
        await writer.createPlaylist(group.name, list)
        result.playlists++
        result.songs += list.length
      }
    }
    for (const item of current.artists) {
      if (!item.include) continue
      writer.addArtist(item.artist.name, item.artist.img ?? null)
      result.artists++
    }
    for (const item of current.albums) {
      if (!item.include || !item.result) continue
      writer.addAlbum(item.result)
      result.albums++
    }
    current.result = result
    current.stage = 'done'
  } catch (err) {
    current.stage = 'review'
    current.error = (err as Error).message
  }
  notify(true)
  await getEnv().storage.save(current.stage == 'done' ? null : current).catch(() => {})
}

/**
 * Stop the import / close the finished one
 */
export const clearImport = () => {
  runId++
  job = null
  notify(true)
  void getEnv().storage.save(null).catch(() => {})
}

/**
 * The songs of each kind of a group (the review)
 */
export const countImportGroup = (current: ImportJob, group: ImportJobGroup) => {
  const count = { found: 0, fallback: 0, notFound: 0, pending: 0, included: 0 }
  for (const index of group.tracks) {
    const item = current.tracks[index]
    if (item.status == 'found' || item.status == 'direct') count.found++
    else if (item.status == 'fallback') count.fallback++
    else if (item.status == 'notFound') count.notFound++
    else count.pending++
    if (item.include && item.musicInfo) count.included++
  }
  return count
}
