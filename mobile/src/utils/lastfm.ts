import { secondaryRequest } from './secondarySources'

// Last.fm (the same file in the desktop and the mobile app), the similar
// songs / artists for the recommendations and the radio, the scrobbles of the songs listened.
// The key of an API account of the user (free: https://www.last.fm/api/account/create), else the key of LX Music+;
// the scrobbles need the account of the user connected (a session).

const API_URL = 'https://ws.audioscrobbler.com/2.0/'
export const LASTFM_AUTH_URL = 'https://www.last.fm/api/auth/'
export const LASTFM_CREATE_KEY_URL = 'https://www.last.fm/api/account/create'

export interface LastfmConfig {
  apiKey: string
  apiSecret: string
  sessionKey: string
  /** the songs listened are scrobbled */
  scrobble: boolean
}

// the API account of LX Music+ (base64): used when the user has no key of their own (the page of Last.fm
// that connects the account names LX Music+ then)
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const decodeBase64 = (text: string) => {
  let bits = 0
  let value = 0
  let result = ''
  for (const char of text.replace(/=+$/, '')) {
    value = (value << 6) | BASE64.indexOf(char)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      result += String.fromCharCode((value >> bits) & 0xff)
    }
  }
  return result
}
export const LASTFM_DEFAULT_API_KEY = decodeBase64('MzcxNTRmZjkwY2U0ODUzMTJjZjc4MDJmZjJmZTE1YTA=')
const LASTFM_DEFAULT_API_SECRET = decodeBase64('ZGM2MDVmMWU2NTM3MDNlNjc3MjM5MzE4MDliZTIyOTA=')

let getUserConfig: () => LastfmConfig = () => ({ apiKey: '', apiSecret: '', sessionKey: '', scrobble: false })
// the key of the user, else the default one (a key without its secret: the default one)
const getConfig = (): LastfmConfig => {
  const config = getUserConfig()
  if (config.apiKey.trim() && config.apiSecret.trim()) return config
  return { ...config, apiKey: LASTFM_DEFAULT_API_KEY, apiSecret: LASTFM_DEFAULT_API_SECRET }
}
/**
 * Whether the default key is used (the user has none)
 */
export const isLastfmDefaultKey = () => getConfig().apiKey == LASTFM_DEFAULT_API_KEY
let md5: (text: string) => string = () => { throw new Error('md5 not set') }
/**
 * Set by the app at its start: the settings of Last.fm, a md5 function (the signature of the requests)
 */
export const setLastfmEnv = (config: () => LastfmConfig, md5Fn: (text: string) => string) => {
  getUserConfig = config
  md5 = md5Fn
}

export const isLastfmEnabled = () => !!getConfig().apiKey.trim()
export const isLastfmConnected = () => {
  const config = getConfig()
  return !!(config.apiKey.trim() && config.apiSecret.trim() && config.sessionKey)
}

class LastfmError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(`Last.fm: ${message}`)
    this.code = code
  }
}

// the signature: md5 of the parameters sorted by name ("namevalue"...) and the secret
const sign = (params: Record<string, string>, secret: string) => {
  const text = Object.keys(params).filter(key => key != 'format' && key != 'callback').sort().map(key => `${key}${params[key]}`).join('')
  return md5(`${text}${secret}`)
}

const encode = (params: Record<string, string>) => Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')

const call = async<T>(method: string, params: Record<string, string>, options: { signed?: boolean, post?: boolean } = {}): Promise<T> => {
  const config = getConfig()
  if (!config.apiKey.trim()) throw new LastfmError(10, 'no API key')
  const all: Record<string, string> = { ...params, method, api_key: config.apiKey.trim() }
  if (options.signed) all.api_sig = sign(all, config.apiSecret.trim())
  all.format = 'json'
  const res = options.post
    ? await secondaryRequest(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: encode(all) })
    : await secondaryRequest(`${API_URL}?${encode(all)}`)
  // the errors come with an error status and their message
  let data: T & { error?: number, message?: string }
  try {
    data = JSON.parse(res.body)
  } catch {
    throw new LastfmError(0, `request failed: ${res.status}`)
  }
  if (data.error) throw new LastfmError(data.error, data.message ?? 'error')
  return data
}

/* ---------- discovery ---------- */

export interface LastfmTrack {
  name: string
  artist: string
  /** 0 - 1, how similar (similar songs) */
  match: number
  durationMs: number
}

const toArray = <T>(value: T | T[] | undefined | null): T[] => value == null ? [] : Array.isArray(value) ? value : [value]

/**
 * The songs similar to a song
 */
export const getSimilarTracks = async(artist: string, track: string, limit = 50): Promise<LastfmTrack[]> => {
  const data = await call<{ similartracks?: { track?: Array<{ name: string, match?: number | string, duration?: number | string, artist?: { name?: string } }> } }>('track.getSimilar', { artist, track, limit: String(limit), autocorrect: '1' })
  return toArray(data.similartracks?.track).map(item => ({
    name: item.name,
    artist: item.artist?.name ?? '',
    match: Number(item.match) || 0,
    durationMs: (Number(item.duration) || 0) * 1000,
  })).filter(item => item.name && item.artist)
}

/**
 * The artists similar to an artist (`match`: 0 - 1)
 */
export const getSimilarArtists = async(artist: string, limit = 30): Promise<Array<{ name: string, match: number }>> => {
  const data = await call<{ similarartists?: { artist?: Array<{ name: string, match?: number | string }> } }>('artist.getSimilar', { artist, limit: String(limit), autocorrect: '1' })
  return toArray(data.similarartists?.artist).map(item => ({ name: item.name, match: Number(item.match) || 0 })).filter(item => item.name)
}

/**
 * The most played songs of an artist
 */
export const getArtistTopTracks = async(artist: string, limit = 20): Promise<LastfmTrack[]> => {
  const data = await call<{ toptracks?: { track?: Array<{ name: string, duration?: number | string, artist?: { name?: string } }> } }>('artist.getTopTracks', { artist, limit: String(limit), autocorrect: '1' })
  return toArray(data.toptracks?.track).map(item => ({ name: item.name, artist: item.artist?.name ?? artist, match: 1, durationMs: (Number(item.duration) || 0) * 1000 }))
}

/**
 * The tags (genres...) of an artist, the most used first
 */
/**
 * The songs a user loves (their profile is public), every page
 */
export const getLovedTracks = async(user: string, max = 5000): Promise<Array<{ name: string, artist: string }>> => {
  const tracks: Array<{ name: string, artist: string }> = []
  for (let page = 1; tracks.length < max; page++) {
    const data = await call<{ lovedtracks?: { track?: Array<{ name: string, artist?: { name?: string } }>, '@attr'?: { totalPages?: string } } }>('user.getLovedTracks', { user, limit: '1000', page: String(page) })
    const list = toArray(data.lovedtracks?.track)
    tracks.push(...list.map(item => ({ name: item.name, artist: item.artist?.name ?? '' })).filter(item => item.name))
    if (!list.length || page >= (Number(data.lovedtracks?.['@attr']?.totalPages) || 1)) break
  }
  return tracks.slice(0, max)
}

export const getArtistTags = async(artist: string, limit = 5): Promise<string[]> => {
  const data = await call<{ toptags?: { tag?: Array<{ name: string }> } }>('artist.getTopTags', { artist, autocorrect: '1' })
  return toArray(data.toptags?.tag).map(tag => tag.name).filter(name => name).slice(0, limit)
}

/* ---------- account ---------- */

/**
 * The first step of the connection: a token, to approve on the page of Last.fm (`getLastfmAuthUrl`)
 */
export const getLastfmToken = async(): Promise<string> => {
  const data = await call<{ token: string }>('auth.getToken', {}, { signed: true })
  return data.token
}
export const getLastfmAuthUrl = (token: string) => `${LASTFM_AUTH_URL}?api_key=${encodeURIComponent(getConfig().apiKey.trim())}&token=${encodeURIComponent(token)}`

/**
 * The second step: the session of the token approved (its key is kept by the app)
 */
export const getLastfmSession = async(token: string): Promise<{ key: string, name: string }> => {
  const data = await call<{ session: { key: string, name: string } }>('auth.getSession', { token }, { signed: true })
  return { key: data.session.key, name: data.session.name }
}

const firstArtist = (singer: string) => (singer ?? '').split(/\s*(?:、|&|;|；|\/|,|，|\|)\s*/)[0]?.trim() ?? ''

/**
 * The song that starts playing
 */
export const updateNowPlaying = async(musicInfo: LX.Music.MusicInfo, durationS: number) => {
  if (!isLastfmConnected()) return
  const params: Record<string, string> = { artist: firstArtist(musicInfo.singer), track: musicInfo.name, sk: getConfig().sessionKey }
  const album = (musicInfo.meta as { albumName?: string }).albumName
  if (album) params.album = album
  if (durationS > 0) params.duration = String(Math.round(durationS))
  await call('track.updateNowPlaying', params, { signed: true, post: true })
}

/**
 * A song listened (more than half of it, or 4 minutes)
 * @param timestamp when it started (s)
 */
export const scrobble = async(musicInfo: LX.Music.MusicInfo, timestamp: number, durationS: number) => {
  if (!isLastfmConnected()) return
  const params: Record<string, string> = { artist: firstArtist(musicInfo.singer), track: musicInfo.name, timestamp: String(Math.floor(timestamp)), sk: getConfig().sessionKey }
  const album = (musicInfo.meta as { albumName?: string }).albumName
  if (album) params.album = album
  if (durationS > 0) params.duration = String(Math.round(durationS))
  await call('track.scrobble', params, { signed: true, post: true })
}

/**
 * The rule of Last.fm: a song is scrobbled once it is played for half its length or 4 minutes (songs over 30 s)
 */
export const shouldScrobble = (listenedS: number, durationS: number) => {
  if (durationS > 0 && durationS < 30) return false
  return listenedS >= 240 || (durationS > 0 && listenedS >= durationS / 2)
}

/* ---------- the songs played (called by the listening recorder of the app) ---------- */

// the play of the song (its "now playing" sent, scrobbled or not)
let current: { id: string, start: number, listened: number, position: number, nowPlaying: boolean, scrobbled: boolean } | null = null

/**
 * Called every few seconds while a song is playing: "now playing" when it starts, the scrobble once it is
 * listened enough (a song played again from its start is a new play)
 * @param elapsedMs the time played since the last call
 * @param position the position in the song (s)
 * @param durationS the length of the song (s, 0: unknown)
 */
export const trackListening = (musicInfo: LX.Music.MusicInfo, elapsedMs: number, position: number, durationS: number) => {
  if (!isLastfmConnected() || !getConfig().scrobble) return
  if (!current || current.id != musicInfo.id || (position < 3 && current.position > position + 3)) {
    current = { id: musicInfo.id, start: Date.now() / 1000 - elapsedMs / 1000, listened: 0, position, nowPlaying: false, scrobbled: false }
  }
  const play = current
  play.position = position
  play.listened += elapsedMs / 1000
  if (!play.nowPlaying) {
    play.nowPlaying = true
    void updateNowPlaying(musicInfo, durationS).catch((err: unknown) => { console.log(err) })
  }
  if (!play.scrobbled && shouldScrobble(play.listened, durationS)) {
    play.scrobbled = true
    void scrobble(musicInfo, play.start, durationS).catch((err: unknown) => {
      console.log(err)
    })
  }
}
