import { normalizeArtistName, isSameArtist } from '@renderer/utils/artistName'
import { reactive } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { toNewMusicInfo } from '@common/utils/tools'
import musicSdk from '@renderer/utils/musicSdk'
import { getSimilarArtists, getSimilarTracks } from '@renderer/utils/discovery'
import { matchTracks } from '@renderer/utils/chartSources'
import { deduplicationList } from '@renderer/utils'
import { getListMusics, setTempList } from '@renderer/store/list/action'
import { tempListMeta } from '@renderer/store/list/state'
import { getListDetail as getPlaylistDetail } from '@renderer/store/songList/action'
import { playMusicInfo, playInfo } from '@renderer/store/player/state'
import { hasDislike } from '@renderer/core/dislikeList'
import { assertApiSupport } from '@renderer/store/utils'
import { playList } from '@renderer/core/player/action'
import { RADIO_LIST_ID } from '@renderer/core/player/playMethod'

// Local recommendations: no account involved.
// A taste profile is built from the loved list, the play history and a local play log,
// candidates come from two routes:
//  - popular songs of the artists the user listens to
//  - playlists that contain a song the user likes (brings in artists the user doesn't know yet)

type Music = LX.Music.MusicInfoOnline

const SPLIT_RXP = /\s*(?:、|&|;|；|\/|,|，|\|)\s*/
const getArtists = (singer: string) => (singer ?? '').split(SPLIT_RXP).map(n => n.trim()).filter(n => n)
const getKey = (m: LX.Music.MusicInfo) => `${m.name}|${m.singer}`.toLowerCase()

/* ---------- play log ---------- */

const LOG_KEY = 'lx_recommend_play_log_v1'
const MAX_LOG_ARTISTS = 1500
interface ArtistLog { p: number, s: number, t: number }
let playLog: Record<string, ArtistLog> = {}
try {
  playLog = JSON.parse(localStorage.getItem(LOG_KEY) ?? '{}')
} catch {}

let saveLogTimer: ReturnType<typeof setTimeout> | null = null
const saveLog = () => {
  if (saveLogTimer) return
  saveLogTimer = setTimeout(() => {
    saveLogTimer = null
    const entries = Object.entries(playLog)
    if (entries.length > MAX_LOG_ARTISTS) {
      entries.sort((a, b) => b[1].t - a[1].t)
      playLog = Object.fromEntries(entries.slice(0, MAX_LOG_ARTISTS))
    }
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(playLog))
    } catch {}
  }, 3000)
}

/**
 * Remember that a song was listened to or skipped, per artist
 */
export const recordPlay = (musicInfo: LX.Music.MusicInfo, type: 'play' | 'skip') => {
  for (const name of getArtists(musicInfo.singer)) {
    const log = playLog[name] ??= { p: 0, s: 0, t: 0 }
    if (type == 'play') log.p++
    else log.s++
    log.t = Date.now()
  }
  saveLog()
}

/* ---------- taste profile ---------- */

interface Weighted<T> { item: T, weight: number }
interface Profile {
  artists: Array<Weighted<string>>
  affinity: Map<string, number> // 0 - 1
  seeds: Array<Weighted<Music>>
  // songs of every source, for the similar songs (Last.fm / Deezer)
  songSeeds: Array<Weighted<LX.Music.MusicInfo>>
  knownIds: Set<string>
  knownKeys: Set<string>
}

const LOVE_WEIGHT = 3
const HISTORY_WEIGHT = 2
const HISTORY_DECAY = 60

const buildProfile = async(): Promise<Profile> => {
  const [loved, history] = await Promise.all([getListMusics(LIST_IDS.LOVE), getListMusics(LIST_IDS.DEFAULT)])
  const weights = new Map<string, number>()
  const seeds: Array<Weighted<Music>> = []
  const songSeeds: Array<Weighted<LX.Music.MusicInfo>> = []
  const knownIds = new Set<string>()
  const knownKeys = new Set<string>()

  const add = (m: LX.Music.MusicInfo, weight: number) => {
    knownIds.add(m.id)
    knownKeys.add(getKey(m))
    for (const name of getArtists(m.singer)) weights.set(name, (weights.get(name) ?? 0) + weight)
    if (m.source == 'wy') seeds.push({ item: m as Music, weight })
    if (m.source != 'local') songSeeds.push({ item: m, weight })
  }
  for (const m of loved) add(m, LOVE_WEIGHT)
  history.forEach((m, index) => {
    add(m, HISTORY_WEIGHT * Math.exp(-index / HISTORY_DECAY))
  })

  // the play log sharpens it: replayed artists go up, skipped ones go down
  for (const [name, weight] of weights) {
    const log = playLog[name]
    if (!log) continue
    const skipRate = log.s / (log.p + log.s + 3)
    weights.set(name, (weight + 0.5 * Math.min(log.p, 10)) * (1 - Math.min(0.6, skipRate)))
  }

  const artists = Array.from(weights, ([item, weight]) => ({ item, weight })).sort((a, b) => b.weight - a.weight)
  const max = artists[0]?.weight ?? 1
  const affinity = new Map(artists.map(a => [a.item, a.weight / max]))
  return { artists, affinity, seeds, songSeeds, knownIds, knownKeys }
}

const weightedSample = <T>(list: Array<Weighted<T>>, count: number): Array<Weighted<T>> => {
  const pool = [...list]
  const result: Array<Weighted<T>> = []
  while (result.length < count && pool.length) {
    let target = Math.random() * pool.reduce((sum, i) => sum + i.weight, 0)
    let index = pool.findIndex(i => (target -= i.weight) <= 0)
    if (index < 0) index = pool.length - 1
    result.push(pool.splice(index, 1)[0])
  }
  return result
}

/* ---------- candidates ---------- */

const ARTIST_SOURCES = ['wy', 'kw'] as const
const ARTIST_ID_KEY = 'lx_recommend_artist_ids_v1'
const ARTIST_SONG_COUNT = 50
let artistIds: Record<string, { source: string, id: string } | null> = {}
try {
  artistIds = JSON.parse(localStorage.getItem(ARTIST_ID_KEY) ?? '{}')
} catch {}
const artistSongsCache = new Map<string, Music[]>()

const toList = (list: any[]) => deduplicationList(list.map(m => toNewMusicInfo(m))) as Music[]

const resolveArtist = async(name: string) => {
  if (name in artistIds) return artistIds[name]
  let result: { source: string, id: string } | null = null
  const target = normalizeArtistName(name)
  for (const source of ARTIST_SOURCES) {
    try {
      const sdk = musicSdk[source].singer
      const id = await sdk.search(target)
      if (!id) continue
      // sources fall back to a similar looking artist when the exact one is missing
      const { info } = await sdk.getInfo(id)
      if (info?.name && !isSameArtist(info.name, target)) continue
      result = { source, id: String(id) }
      break
    } catch (err) {
      console.log(err)
    }
  }
  artistIds[name] = result
  try {
    localStorage.setItem(ARTIST_ID_KEY, JSON.stringify(artistIds))
  } catch {}
  return result
}

const getArtistSongs = async(name: string): Promise<Music[]> => {
  const cached = artistSongsCache.get(name)
  if (cached) return cached
  const artist = await resolveArtist(name)
  if (!artist) return []
  // @ts-expect-error the sdk is not typed
  const { list } = await musicSdk[artist.source].singer.getSongList(artist.id, 1, ARTIST_SONG_COUNT)
  const songs = toList(list)
  artistSongsCache.set(name, songs)
  return songs
}

const RELATED_PLAYLIST_COUNT = 2
const getRelatedSongs = async(seed: Music): Promise<Music[]> => {
  const playlists: Array<{ id: string }> = await musicSdk.wy.home.getRelatedPlaylists(String(seed.meta.songId))
  const lists = await Promise.all(playlists.slice(0, RELATED_PLAYLIST_COUNT).map(async p => {
    return getPlaylistDetail(p.id, 'wy', 1).then(detail => detail.list).catch(() => [] as Music[])
  }))
  return lists.flat()
}

/* ---------- ranking ---------- */

// the songs found by name (Last.fm / Deezer) are looked for on these sources
const MATCH_SOURCES = ['wy', 'kw']
const matchSearch = async(source: string, text: string) => {
  const result = await (musicSdk as any)[source]?.musicSearch.search(text, 1, 10)
  return toList((result?.list ?? []) as any[])
}
const SIMILAR_TRACKS_PER_SEED = 10
const SIMILAR_ARTIST_SONGS = 8

interface Options {
  /** songs whose similar songs are looked for (the radio: the song playing) */
  seedSongs?: LX.Music.MusicInfo[]
  /** how many songs of the user give their similar songs, how many of its artists give similar artists */
  discoverySeedCount?: number
  similarArtistCount?: number
  count: number
  artistCount: number
  seedCount: number
  maxPerArtist: number
  exclude?: Set<string>
}

const generate = async({ count, artistCount, seedCount, maxPerArtist, exclude, seedSongs = [], discoverySeedCount = 0, similarArtistCount = 0 }: Options): Promise<Music[]> => {
  const profile = await buildProfile()
  if (!profile.artists.length) return []

  const scores = new Map<string, { music: Music, score: number }>()
  const addCandidate = (music: Music, score: number) => {
    if (profile.knownIds.has(music.id) || exclude?.has(music.id)) return
    const key = getKey(music)
    if (profile.knownKeys.has(key) || hasDislike(music)) return
    // songs of a source the music api can't play need a match on another source, which can fail
    if (!assertApiSupport(music.source)) score *= 0.6
    const prev = scores.get(key)
    // a song suggested by several routes is a better guess
    if (prev) prev.score += score * 0.4
    else scores.set(key, { music, score })
  }
  const getAffinity = (music: Music) => Math.max(0, ...getArtists(music.singer).map(n => profile.affinity.get(n) ?? 0))

  // picked among the top artists so the result isn't the same every time
  const artists = weightedSample(profile.artists.slice(0, Math.max(artistCount * 3, 12)), artistCount)
  const seeds = weightedSample(profile.seeds, seedCount)
  await Promise.all([
    ...artists.map(async({ item: name }) => getArtistSongs(name).then(list => {
      const affinity = profile.affinity.get(name) ?? 0
      list.forEach((music, index) => {
        // the songs of an artist are ordered by popularity
        addCandidate(music, (0.5 + 0.5 * affinity) * (1 - 0.4 * index / list.length))
      })
    }).catch(err => {
      console.log(err)
    })),
    ...seeds.map(async({ item: seed }) => getRelatedSongs(seed).then(list => {
      for (const music of list) addCandidate(music, 0.45 + 0.5 * getAffinity(music))
    }).catch(err => {
      console.log(err)
    })),
    // the songs similar to songs of the user (Last.fm, else Deezer), found on the main sources
    ...[...seedSongs, ...weightedSample(profile.songSeeds, discoverySeedCount).map(seed => seed.item)].map(async seed => {
      const similar = await getSimilarTracks(seed.name, getArtists(seed.singer)[0] ?? seed.singer, SIMILAR_TRACKS_PER_SEED * 2)
      // the most similar ones, a few others for variety
      const picked = [...similar.slice(0, SIMILAR_TRACKS_PER_SEED), ...weightedSample(similar.slice(SIMILAR_TRACKS_PER_SEED).map(item => ({ item, weight: item.match + 0.05 })), 3).map(i => i.item)]
      const songs = await matchTracks(picked, matchSearch, MATCH_SOURCES, s => assertApiSupport(s as LX.Source))
      for (const music of songs) {
        const match = picked.find(track => track.name.toLowerCase() == music.name.toLowerCase())?.match ?? 0.5
        addCandidate(music, 0.5 + 0.35 * match + 0.2 * getAffinity(music))
      }
    }).map(async task => task.catch((err: unknown) => {
      console.log(err)
    })),
    // the artists similar to artists of the user: their best songs
    ...weightedSample(profile.artists.slice(0, 12), similarArtistCount).map(async({ item: name }) => {
      const similar = (await getSimilarArtists(name, 15)).filter(artist => !profile.affinity.has(artist.name))
      const chosen = weightedSample(similar.map(artist => ({ item: artist, weight: artist.match + 0.1 })), 2)
      await Promise.all(chosen.map(async({ item: artist }) => {
        const songs = (await getArtistSongs(artist.name)).slice(0, SIMILAR_ARTIST_SONGS)
        songs.forEach((music, index) => {
          addCandidate(music, (0.3 + 0.35 * artist.match) * (1 - 0.3 * index / songs.length))
        })
      }))
    }).map(async task => task.catch((err: unknown) => {
      console.log(err)
    })),
  ])

  const ranked = Array.from(scores.values())
  for (const item of ranked) item.score *= 0.75 + Math.random() * 0.5
  ranked.sort((a, b) => b.score - a.score)

  const result: Music[] = []
  const artistCounts = new Map<string, number>()
  for (const { music } of ranked) {
    // featured artists count too, otherwise one artist fills the list through collaborations
    const names = getArtists(music.singer)
    if (names.some(name => (artistCounts.get(name) ?? 0) >= maxPerArtist)) continue
    for (const name of names) artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1)
    result.push(music)
    if (result.length >= count) break
  }
  // strongest guesses are spread out instead of being played first
  return result.sort(() => Math.random() - 0.5)
}

/* ---------- daily mix ---------- */

const DAILY_KEY = 'lx_recommend_daily_mix_v1'
const DAILY_COUNT = 30
const getToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

/**
 * Songs picked for today, the same list is returned for the rest of the day
 */
export const getDailyMix = async(isRefresh = false): Promise<Music[]> => {
  const today = getToday()
  if (!isRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(DAILY_KEY) ?? 'null')
      if (cached?.date == today && cached.list?.length) return cached.list
    } catch {}
  }
  const list = await generate({ count: DAILY_COUNT, artistCount: 8, seedCount: 4, maxPerArtist: 2, discoverySeedCount: 4, similarArtistCount: 3 })
  if (list.length) {
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify({ date: today, list }))
    } catch {}
  }
  return list
}

export const DAILY_MIX_LIST_ID = 'recommend_daily_mix'
export const playDailyMix = async(list: Music[], index = 0) => {
  if (!list.length) return
  await setTempList(DAILY_MIX_LIST_ID, [...list])
  playList(LIST_IDS.TEMP, index)
}

/* ---------- fm ---------- */

// (the radio plays in order: core/player/playMethod.ts)
const FM_LIST_ID = RADIO_LIST_ID
const FM_BATCH = { count: 8, artistCount: 3, seedCount: 2, maxPerArtist: 2, discoverySeedCount: 1, similarArtistCount: 1 }
const FM_REFILL_REMAINING = 3

export const fmState = reactive({
  active: false,
  loading: false,
})
let fmQueue: Music[] = []
let isFilling = false

const isFmList = () => playMusicInfo.listId == LIST_IDS.TEMP && tempListMeta.id == FM_LIST_ID

/**
 * Start the endless radio, returns false when there is nothing to base it on yet
 */
export const startFm = async(): Promise<boolean> => {
  if (fmState.loading) return true
  fmState.loading = true
  try {
    const list = await generate(FM_BATCH)
    if (!list.length) return false
    fmQueue = list
    await setTempList(FM_LIST_ID, [...list])
    playList(LIST_IDS.TEMP, 0)
    fmState.active = true
    return true
  } finally {
    // eslint-disable-next-line require-atomic-updates
    fmState.loading = false
  }
}

const fillFm = async() => {
  if (isFilling) return
  isFilling = true
  try {
    // (after a restart: the queue of the radio is the one restored, it is added to, not replaced)
    if (!fmQueue.length) {
      const restored = [...await getListMusics(LIST_IDS.TEMP)] as Music[]
      // (a radio started in the meantime keeps its queue)
      if (!fmQueue.length) fmQueue = restored
    }
    // the song playing leads the radio (its similar songs), like the radio of Nuclear
    const playing = (() => { const info = playMusicInfo.musicInfo; return info ? 'progress' in info ? info.metadata.musicInfo : info : null })()
    const list = await generate({ ...FM_BATCH, exclude: new Set(fmQueue.map(m => m.id)), seedSongs: playing ? [playing] : [] })
    if (!list.length || !isFmList()) return
    fmQueue = [...fmQueue, ...list]
    await setTempList(FM_LIST_ID, [...fmQueue])
  } finally {
    // eslint-disable-next-line require-atomic-updates
    isFilling = false
  }
}

/**
 * Called when the playing song changes: keeps the radio queue filled
 */
export const handleFmMusicToggled = () => {
  fmState.active = isFmList()
  if (fmState.active && playInfo.playIndex >= fmQueue.length - FM_REFILL_REMAINING) void fillFm()
}
