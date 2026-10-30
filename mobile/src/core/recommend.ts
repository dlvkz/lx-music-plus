import { normalizeArtistName, isSameArtist } from '@/utils/artistName'
import { LIST_IDS } from '@/config/constant'
import { toNewMusicInfo, deduplicationList } from '@/utils'
import { assertApiSupport } from '@/utils/tools'
import musicSdk from '@/utils/musicSdk'
import { getSimilarArtists, getSimilarTracks } from '@/utils/discovery'
import { matchTracks } from '@/utils/chartSources'
import { getData, saveData } from '@/plugins/storage'
import { getListMusics, setTempList } from '@/core/list'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import { getListDetail as getPlaylistDetail } from '@/core/songlist'
import { hasDislike } from '@/core/dislikeList'
import { playList } from '@/core/player/player'
import { RADIO_LIST_ID } from '@/core/player/playMethod'
import { setPlayingFrom, type PlayingFromTarget } from '@/core/playingFrom'
import settingState from '@/store/setting/state'

// Local recommendations: no account involved (same logic as the desktop app, core/recommend.ts).
// A taste profile is built from the loved list, the play history and a local play log,
// candidates come from two routes:
//  - popular songs of the artists the user listens to
//  - playlists that contain a song the user likes (brings in artists the user doesn't know yet)

type Music = LX.Music.MusicInfoOnline

const SPLIT_RXP = /\s*(?:、|&|;|；|\/|,|，|\|)\s*/
const getArtists = (singer: string) => (singer ?? '').split(SPLIT_RXP).map(n => n.trim()).filter(n => n)
const getKey = (m: LX.Music.MusicInfo) => `${m.name}|${m.singer}`.toLowerCase()

const STORAGE_KEYS = {
  playLog: '@recommend_play_log_v1',
  artistIds: '@recommend_artist_ids_v1',
  dailyMix: '@recommend_daily_mix_v1',
}

/* ---------- play log ---------- */

const MAX_LOG_ARTISTS = 1500
interface ArtistLog { p: number, s: number, t: number }
let playLog: Record<string, ArtistLog> = {}
let artistIds: Record<string, { source: string, id: string } | null> = {}
const initPromise = Promise.all([
  getData<typeof playLog>(STORAGE_KEYS.playLog).then(data => { if (data) playLog = { ...data, ...playLog } }),
  getData<typeof artistIds>(STORAGE_KEYS.artistIds).then(data => { if (data) artistIds = data }),
]).catch(err => {
  console.log(err)
})

let saveLogTimer: NodeJS.Timeout | null = null
const saveLog = () => {
  if (saveLogTimer) return
  saveLogTimer = setTimeout(() => {
    saveLogTimer = null
    const entries = Object.entries(playLog)
    if (entries.length > MAX_LOG_ARTISTS) {
      entries.sort((a, b) => b[1].t - a[1].t)
      playLog = Object.fromEntries(entries.slice(0, MAX_LOG_ARTISTS))
    }
    void saveData(STORAGE_KEYS.playLog, playLog)
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
  handleRadioFeedback(musicInfo, type)
}

/* ---------- the radio right now: skips ---------- */

// A song skipped in the radio says the user doesn't want that right now: its artist, the artists like it (Last.fm) and
// the way it was found (the songs like the same song, the artists like the same artist...) come less for a while, the
// songs of its artist already in the queue are taken out. A song listened to takes some of it back.
const SKIP_HALF_LIFE = 45 * 60000
const MAX_PENALTY = 4
interface Penalty { value: number, time: number }
const artistPenalties = new Map<string, Penalty>()
const originPenalties = new Map<string, Penalty>()
// how the songs of the radio were found
const songOrigins = new Map<string, string>()
const MAX_SONG_ORIGINS = 3000
const rememberOrigin = (music: LX.Music.MusicInfo, origin: string | undefined) => {
  if (!origin) return
  if (songOrigins.size > MAX_SONG_ORIGINS) songOrigins.clear()
  songOrigins.set(getKey(music), origin)
}
const toArtistKey = (name: string) => normalizeArtistName(name).toLowerCase()
const getPenaltyValue = (penalty: Penalty | undefined, now = Date.now()) => {
  return penalty ? penalty.value * Math.pow(0.5, (now - penalty.time) / SKIP_HALF_LIFE) : 0
}
const changePenalty = (map: Map<string, Penalty>, key: string, change: (value: number) => number) => {
  const now = Date.now()
  const value = Math.min(MAX_PENALTY, change(getPenaltyValue(map.get(key), now)))
  if (value < 0.01) map.delete(key)
  else map.set(key, { value, time: now })
}
const getArtistPenalty = (singer: string) => Math.max(0, ...getArtists(singer).map(name => getPenaltyValue(artistPenalties.get(toArtistKey(name)))))
const getOriginPenalty = (music: LX.Music.MusicInfo) => {
  const origin = songOrigins.get(getKey(music))
  return origin ? getPenaltyValue(originPenalties.get(origin)) : 0
}
/**
 * How much a song is wanted right now (0 - 1): its artist, the way it was found skipped lately
 */
const getSkipFactor = (singer: string, origin?: string) => {
  return Math.exp(-(getArtistPenalty(singer) + (origin ? 0.6 * getPenaltyValue(originPenalties.get(origin)) : 0)))
}

// the artists of the songs of the radio around the one playing (heard lately, coming next) are less likely again,
// half as likely for every song of them
const FATIGUE_WINDOW = 20
const getArtistCounts = (songs: LX.Music.MusicInfo[]) => {
  const counts = new Map<string, number>()
  for (const music of songs) {
    for (const name of getArtists(music.singer)) counts.set(toArtistKey(name), (counts.get(toArtistKey(name)) ?? 0) + 1)
  }
  return counts
}
const getFatigue = (singer: string, counts: Map<string, number>) => {
  return Math.pow(0.5, Math.max(0, ...getArtists(singer).map(name => counts.get(toArtistKey(name)) ?? 0)))
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
  /** the songs the user knows (loved / played), the recent ones weigh more */
  familiar: Array<Weighted<LX.Music.MusicInfo>>
}

const LOVE_WEIGHT = 3
const HISTORY_WEIGHT = 2
const HISTORY_DECAY = 60
// the songs the user knows: weight of the recent ones, how fast it goes down with the age (songs), the songs
// just played that are left out
const FAMILIAR_DECAY = 40
const FAMILIAR_MIN_WEIGHT = 0.02
const FAMILIAR_SKIP_RECENT = 5

const buildProfile = async(): Promise<Profile> => {
  await initPromise
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
  // a lot of one artist lately counts less than its plays: after hours of one artist the recommendations and the radio
  // still reach the others
  for (const [name, weight] of weights) weights.set(name, Math.sqrt(weight))

  // the play history is newest first, the loved list in the order songs are added to it
  const familiarMap = new Map<string, Weighted<LX.Music.MusicInfo>>()
  const justPlayed = new Set(history.slice(0, FAMILIAR_SKIP_RECENT).map(getKey))
  const addFamiliar = (m: LX.Music.MusicInfo, weight: number) => {
    const key = getKey(m)
    if (justPlayed.has(key)) return
    const prev = familiarMap.get(key)
    if (prev) prev.weight += weight
    else familiarMap.set(key, { item: m, weight })
  }
  history.forEach((m, index) => {
    addFamiliar(m, Math.max(FAMILIAR_MIN_WEIGHT, Math.exp(-index / FAMILIAR_DECAY)))
  })
  const lovedNewestFirst = settingState.setting['list.addMusicLocationType'] == 'bottom' ? [...loved].reverse() : loved
  lovedNewestFirst.forEach((m, index) => {
    addFamiliar(m, 0.8 * Math.max(FAMILIAR_MIN_WEIGHT, Math.exp(-index / (FAMILIAR_DECAY * 2))))
  })
  const familiar = Array.from(familiarMap.values())

  const artists = Array.from(weights, ([item, weight]) => ({ item, weight })).sort((a, b) => b.weight - a.weight)
  const max = artists[0]?.weight ?? 1
  const affinity = new Map(artists.map(a => [a.item, a.weight / max]))
  return { artists, affinity, seeds, songSeeds, knownIds, knownKeys, familiar }
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
const ARTIST_SONG_COUNT = 50
const artistSongsCache = new Map<string, Music[]>()

const toList = (list: any[]) => deduplicationList(list.map(m => toNewMusicInfo(m))) as Music[]

/**
 * Find an artist by name on the sources that have artist pages
 */
export const resolveArtist = async(name: string) => {
  await initPromise
  if (name in artistIds) return artistIds[name]
  let result: { source: string, id: string } | null = null
  const target = normalizeArtistName(name)
  for (const source of ARTIST_SOURCES) {
    try {
      const sdk = (musicSdk as any)[source].singer
      const id = await sdk.search(target)
      if (!id) continue
      // sources fall back to a similar looking artist when the exact one is missing
      const { info } = await sdk.getInfo(id)
      if (info?.name && !isSameArtist(String(info.name), target)) continue
      result = { source, id: String(id) }
      break
    } catch (err) {
      console.log(err)
    }
  }
  artistIds[name] = result
  void saveData(STORAGE_KEYS.artistIds, artistIds)
  return result
}

const getArtistSongs = async(name: string): Promise<Music[]> => {
  const cached = artistSongsCache.get(name)
  if (cached) return cached
  const artist = await resolveArtist(name)
  if (!artist) return []
  const { list } = await (musicSdk as any)[artist.source].singer.getSongList(artist.id, 1, ARTIST_SONG_COUNT)
  const songs = toList(list as any[])
  artistSongsCache.set(name, songs)
  return songs
}

const RELATED_PLAYLIST_COUNT = 2
const getRelatedSongs = async(seed: Music): Promise<Music[]> => {
  const playlists: Array<{ id: string }> = await (musicSdk as any).wy.home.getRelatedPlaylists(String(seed.meta.songId))
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
  /** songs the user knows added to the new ones (the radio) */
  familiarCount?: number
  count: number
  artistCount: number
  seedCount: number
  maxPerArtist: number
  exclude?: Set<string>
  /** the radio: its songs around the one playing (their artists are less likely again), the skips count */
  radio?: { recent: LX.Music.MusicInfo[] }
}

const generate = async({ count, artistCount, seedCount, maxPerArtist, exclude, seedSongs = [], discoverySeedCount = 0, similarArtistCount = 0, familiarCount = 0, radio }: Options): Promise<Music[]> => {
  const profile = await buildProfile()
  if (!profile.artists.length) return []

  // the radio: what the user skipped lately, the artists heard lately in it come less
  const counts = radio ? getArtistCounts(radio.recent) : null
  const getWanted = (singer: string, origin?: string) => counts ? getSkipFactor(singer, origin) * getFatigue(singer, counts) : 1
  const scores = new Map<string, { music: Music, score: number }>()
  // how each song was found
  const origins = new Map<string, string>()
  const addCandidate = (music: Music, score: number, origin: string) => {
    if (profile.knownIds.has(music.id) || exclude?.has(music.id)) return
    const key = getKey(music)
    if (profile.knownKeys.has(key) || hasDislike(music)) return
    // songs of a source the music api can't play need a match on another source, which can fail
    if (!assertApiSupport(music.source)) score *= 0.6
    score *= getWanted(music.singer, origin)
    const prev = scores.get(key)
    // a song suggested by several routes is a better guess
    if (prev) prev.score += score * 0.4
    else {
      scores.set(key, { music, score })
      origins.set(key, origin)
    }
  }
  const getAffinity = (music: Music) => Math.max(0, ...getArtists(music.singer).map(n => profile.affinity.get(n) ?? 0))
  const wanted = <T>(list: Array<Weighted<T>>, getSinger: (item: T) => string) => counts ? list.map(({ item, weight }) => ({ item, weight: weight * getWanted(getSinger(item)) })) : list

  // picked among the top artists so the result isn't the same every time
  const artists = weightedSample(wanted(profile.artists.slice(0, Math.max(artistCount * 3, 12)), name => name), artistCount)
  const seeds = weightedSample(wanted(profile.seeds, music => music.singer), seedCount)
  await Promise.all([
    ...artists.map(async({ item: name }) => getArtistSongs(name).then(list => {
      const affinity = profile.affinity.get(name) ?? 0
      list.forEach((music, index) => {
        // the songs of an artist are ordered by popularity
        addCandidate(music, (0.5 + 0.5 * affinity) * (1 - 0.4 * index / list.length), `artist:${toArtistKey(name)}`)
      })
    }).catch(err => {
      console.log(err)
    })),
    ...seeds.map(async({ item: seed }) => getRelatedSongs(seed).then(list => {
      for (const music of list) addCandidate(music, 0.45 + 0.5 * getAffinity(music), `related:${getKey(seed)}`)
    }).catch(err => {
      console.log(err)
    })),
    // the songs similar to songs of the user (Last.fm, else Deezer), found on the main sources
    ...[...seedSongs, ...weightedSample(wanted(profile.songSeeds, music => music.singer), discoverySeedCount).map(seed => seed.item)].map(async seed => {
      const similar = await getSimilarTracks(seed.name, getArtists(seed.singer)[0] ?? seed.singer, SIMILAR_TRACKS_PER_SEED * 2)
      // the most similar ones, a few others for variety
      const picked = [...similar.slice(0, SIMILAR_TRACKS_PER_SEED), ...weightedSample(similar.slice(SIMILAR_TRACKS_PER_SEED).map(item => ({ item, weight: item.match + 0.05 })), 3).map(i => i.item)]
      const songs = await matchTracks(picked, matchSearch, MATCH_SOURCES, s => assertApiSupport(s as LX.Source))
      for (const music of songs) {
        const match = picked.find(track => track.name.toLowerCase() == music.name.toLowerCase())?.match ?? 0.5
        addCandidate(music, 0.5 + 0.35 * match + 0.2 * getAffinity(music), `similar:${getKey(seed)}`)
      }
    }).map(async task => task.catch((err: unknown) => {
      console.log(err)
    })),
    // the artists similar to artists of the user: their best songs
    ...weightedSample(wanted(profile.artists.slice(0, 12), name => name), similarArtistCount).map(async({ item: name }) => {
      const similar = (await getSimilarArtists(name, 15)).filter(artist => !profile.affinity.has(artist.name))
      const chosen = weightedSample(similar.map(artist => ({ item: artist, weight: (artist.match + 0.1) * getWanted(artist.name) })), 2)
      await Promise.all(chosen.map(async({ item: artist }) => {
        const songs = (await getArtistSongs(artist.name)).slice(0, SIMILAR_ARTIST_SONGS)
        songs.forEach((music, index) => {
          addCandidate(music, (0.3 + 0.35 * artist.match) * (1 - 0.3 * index / songs.length), `like:${toArtistKey(name)}`)
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
  // some songs the user knows, the recent ones more likely, one of an artist at most
  if (familiarCount) {
    const familiar = profile.familiar
      .filter(({ item }) => !exclude?.has(item.id) && !hasDislike(item))
      .map(({ item, weight }) => ({ item, weight: weight * getWanted(item.singer, 'familiar') }))
    const familiarArtists = new Set<string>()
    let added = 0
    for (const { item } of weightedSample(familiar, familiarCount * 4)) {
      const names = getArtists(item.singer).map(toArtistKey)
      if (names.some(name => familiarArtists.has(name))) continue
      for (const name of names) familiarArtists.add(name)
      result.push(item as Music)
      origins.set(getKey(item), 'familiar')
      if (++added >= familiarCount) break
    }
  }
  if (radio) for (const music of result) rememberOrigin(music, origins.get(getKey(music)))
  // strongest guesses are spread out instead of being played first
  return result.sort(() => Math.random() - 0.5)
}

/* ---------- radio of an artist / a list / a song ---------- */

// The radio of an artist (its page), a playlist or an album: their songs mixed with the songs like them (Last.fm, else
// the artist radio of Deezer) and the best songs of the similar artists; after that the song playing leads it too.
// The radio of a song: the song first, then mostly the songs like it, a few of its artist, the similar artists
export interface RadioSeed {
  type: 'artist' | 'list' | 'song'
  /** the artist, the name of the list, the name of the song */
  name: string
  /** the songs of the artist page / of the list (an artist without them: the ones of the main sources), the song */
  songs: Music[]
}
const SEED_RADIO_COUNT = 10
const SEED_RADIO_OWN = 4
// the radio of a song: a few songs of its artist, mostly the songs like it
const SONG_RADIO_OWN = 2
const SEED_RADIO_SEEDS = 2
const SEED_RADIO_SIMILAR_ARTISTS = 3
const SEED_RADIO_MAX_SONGS = 300

// the artist of the radio of an artist / of a song
const getSeedArtist = (seed: RadioSeed) => {
  if (seed.type == 'artist') return seed.name
  if (seed.type == 'song') return getArtists(seed.songs[0]?.singer ?? '')[0] ?? ''
  return ''
}

/**
 * Whether a song is one of the artist / of the list of the radio (a song with the artist featured too)
 */
const getSeedOwnCheck = (seed: RadioSeed) => {
  if (seed.type == 'list') {
    const listKeys = new Set(seed.songs.map(getKey))
    return (music: LX.Music.MusicInfo) => listKeys.has(getKey(music))
  }
  const artist = getSeedArtist(seed)
  return (music: LX.Music.MusicInfo) => !!artist && getArtists(music.singer).some(name => isSameArtist(name, artist))
}

const shuffle = <T>(list: T[]) => list.sort(() => Math.random() - 0.5)

/**
 * @param exclude the songs of the radio already
 * @param seedSongs the song playing
 * @param recent the songs of the radio around the one playing
 */
const generateSeedRadio = async(seed: RadioSeed, exclude: Music[], seedSongs: LX.Music.MusicInfo[] = [], recent: LX.Music.MusicInfo[] = []): Promise<Music[]> => {
  const excludeIds = new Set(exclude.map(m => m.id))
  const excludeKeys = new Set(exclude.map(getKey))
  const isList = seed.type == 'list'
  const isSong = seed.type == 'song'
  const seedArtist = getSeedArtist(seed)
  const isOwn = getSeedOwnCheck(seed)
  // what the user skipped lately, the artists heard lately in the radio come less (not the artist / the list of it)
  const counts = getArtistCounts(recent)

  const scores = new Map<string, { music: Music, score: number }>()
  const origins = new Map<string, string>()
  const addCandidate = (music: Music, score: number, origin: string) => {
    const key = getKey(music)
    if (excludeIds.has(music.id) || excludeKeys.has(key) || hasDislike(music)) return
    // songs of a source the music api can't play need a match on another source, which can fail
    if (!assertApiSupport(music.source)) score *= 0.6
    if (!isOwn(music)) score *= getSkipFactor(music.singer, origin) * getFatigue(music.singer, counts)
    const prev = scores.get(key)
    if (prev) prev.score += score * 0.4
    else {
      scores.set(key, { music, score })
      origins.set(key, origin)
    }
  }

  // the songs of the list, of the artist (of the song)
  const own = isList || (seed.type == 'artist' && seed.songs.length > 0)
    ? seed.songs.slice(0, SEED_RADIO_MAX_SONGS)
    : seedArtist ? await getArtistSongs(seedArtist).catch(() => [] as Music[]) : []
  // the songs of an artist are ordered by popularity, the ones of a list are all alike
  const popular = isList ? own : own.slice(0, 60)
  popular.forEach((music, index) => {
    addCandidate(music, isList ? 0.6 : 0.7 * (1 - 0.5 * index / popular.length), 'own')
  })
  const seeds = new Map<string, LX.Music.MusicInfo>()
  for (const music of [
    // the song of the radio leads it all along
    ...(isSong ? seed.songs.slice(0, 1) : []),
    ...seedSongs,
    ...weightedSample(popular.slice(0, isList ? popular.length : 15).map((item, index) => ({ item, weight: isList ? 1 : 1 - index / 20 })), isSong ? 1 : SEED_RADIO_SEEDS).map(i => i.item),
  ]) seeds.set(getKey(music), music)
  // the artists the similar ones are looked for from: the artist, the artists of the list (the most present ones
  // more likely)
  const listArtists = new Map<string, number>()
  if (isList) for (const music of own) for (const name of getArtists(music.singer)) listArtists.set(name, (listArtists.get(name) ?? 0) + 1)
  const fromArtists = isList
    ? weightedSample(Array.from(listArtists, ([item, weight]) => ({ item, weight })).sort((a, b) => b.weight - a.weight).slice(0, 12), 2).map(i => i.item)
    : seedArtist ? [seedArtist] : []
  await Promise.all([
    // the songs similar to the songs of the artist / of the list, found on the main sources
    ...Array.from(seeds.values()).map(async seedSong => {
      const similar = await getSimilarTracks(seedSong.name, getArtists(seedSong.singer)[0] ?? seed.name, SIMILAR_TRACKS_PER_SEED * 2)
      const picked = [...similar.slice(0, SIMILAR_TRACKS_PER_SEED), ...weightedSample(similar.slice(SIMILAR_TRACKS_PER_SEED).map(item => ({ item, weight: item.match + 0.05 })), 3).map(i => i.item)]
      const songs = await matchTracks(picked, matchSearch, MATCH_SOURCES, s => assertApiSupport(s as LX.Source))
      for (const music of songs) {
        const match = picked.find(track => track.name.toLowerCase() == music.name.toLowerCase())?.match ?? 0.5
        addCandidate(music, 0.5 + 0.4 * match, `similar:${getKey(seedSong)}`)
      }
    }).map(async task => task.catch((err: unknown) => {
      console.log(err)
    })),
    // the best songs of the similar artists
    ...fromArtists.map(async name => {
      const similar = (await getSimilarArtists(name, 15)).filter(artist => !listArtists.has(artist.name))
      const chosen = weightedSample(similar.map(artist => ({ item: artist, weight: (artist.match + 0.1) * getSkipFactor(artist.name) * getFatigue(artist.name, counts) })), isList ? 2 : SEED_RADIO_SIMILAR_ARTISTS)
      await Promise.all(chosen.map(async({ item: artist }) => {
        const songs = (await getArtistSongs(artist.name)).slice(0, SIMILAR_ARTIST_SONGS)
        songs.forEach((music, index) => {
          addCandidate(music, (0.35 + 0.35 * artist.match) * (1 - 0.3 * index / songs.length), `like:${toArtistKey(name)}`)
        })
      }))
    }).map(async task => task.catch((err: unknown) => {
      console.log(err)
    })),
    // a list: other songs of its artists
    ...(isList ? fromArtists.slice(0, 1) : []).map(async name => {
      const songs = (await getArtistSongs(name)).slice(0, SIMILAR_ARTIST_SONGS)
      songs.forEach((music, index) => {
        addCandidate(music, 0.45 * (1 - 0.3 * index / songs.length), `artist:${toArtistKey(name)}`)
      })
    }).map(async task => task.catch((err: unknown) => {
      console.log(err)
    })),
  ])

  const ranked = Array.from(scores.values())
  for (const item of ranked) item.score *= 0.75 + Math.random() * 0.5
  ranked.sort((a, b) => b.score - a.score)

  const ownCount = isSong ? SONG_RADIO_OWN : SEED_RADIO_OWN
  const ownPicked: Music[] = []
  const others: Music[] = []
  const artistCounts = new Map<string, number>()
  for (const { music } of ranked) {
    if (isOwn(music)) {
      if (ownPicked.length < ownCount) ownPicked.push(music)
      continue
    }
    if (others.length >= SEED_RADIO_COUNT - ownCount) continue
    const names = getArtists(music.singer)
    if (names.some(name => (artistCounts.get(name) ?? 0) >= 2)) continue
    for (const name of names) artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1)
    others.push(music)
  }
  // not enough similar songs found: more of the artist / of the list
  const missing = SEED_RADIO_COUNT - ownPicked.length - others.length
  if (missing > 0) ownPicked.push(...ranked.filter(({ music }) => isOwn(music) && !ownPicked.includes(music)).slice(0, missing).map(i => i.music))
  for (const music of [...ownPicked, ...others]) rememberOrigin(music, origins.get(getKey(music)))
  // the radio of a song: its song is put first when it starts (startSeedRadio)
  if (!ownPicked.length || isSong) return shuffle([...ownPicked, ...others])
  // a song of the artist / of the list first, the rest spread out
  return [ownPicked[0], ...shuffle([...ownPicked.slice(1), ...others])]
}

/* ---------- daily mix ---------- */

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
    const cached = await getData<{ date: string, list: Music[] }>(STORAGE_KEYS.dailyMix).catch(() => null)
    if (cached?.date == today && cached.list?.length) return cached.list
  }
  const list = await generate({ count: DAILY_COUNT, artistCount: 8, seedCount: 4, maxPerArtist: 2, discoverySeedCount: 4, similarArtistCount: 3 })
  if (list.length) void saveData(STORAGE_KEYS.dailyMix, { date: today, list })
  return list
}

export const DAILY_MIX_LIST_ID = 'recommend_daily_mix'
export const playDailyMix = async(list: Music[], index = 0) => {
  if (!list.length) return
  await setTempList(DAILY_MIX_LIST_ID, [...list])
  void playList(LIST_IDS.TEMP, index)
}

/* ---------- radio ---------- */

// (the radio plays in order: core/player/playMethod.ts)
const FM_LIST_ID = RADIO_LIST_ID
// mostly new songs, some the user knows
const FM_BATCH = { count: 7, familiarCount: 3, artistCount: 3, seedCount: 2, maxPerArtist: 1, discoverySeedCount: 1, similarArtistCount: 1 }
const FM_REFILL_REMAINING = 3

export const fmState = {
  active: false,
  loading: false,
  /** what the radio is made from (an artist, a playlist, an album), empty: the radio of the user */
  seed: '',
}
type FmListener = (state: typeof fmState) => void
const fmListeners = new Set<FmListener>()
export const onFmStateChanged = (listener: FmListener) => {
  fmListeners.add(listener)
  return () => {
    fmListeners.delete(listener)
  }
}
const setFmState = (state: Partial<typeof fmState>) => {
  const active = state.active ?? fmState.active
  const loading = state.loading ?? fmState.loading
  const seed = state.seed ?? fmState.seed
  if (active == fmState.active && loading == fmState.loading && seed == fmState.seed) return
  fmState.active = active
  fmState.loading = loading
  fmState.seed = seed
  for (const listener of fmListeners) listener({ ...fmState })
}

let fmQueue: Music[] = []
let isFilling = false
const RADIO_SEED_KEY = '@radio_seed'
let fmSeed: RadioSeed | null = null
const radioSeedPromise = getData<RadioSeed>(RADIO_SEED_KEY).then(seed => {
  if (!seed || fmSeed) return
  fmSeed = seed
  setFmState({ seed: seed.name })
}).catch(() => {})
const setFmSeed = (seed: RadioSeed | null) => {
  fmSeed = seed
  setFmState({ seed: seed?.name ?? '' })
  // (the songs of a list / the song are kept for the radio after a restart, an artist finds its own again)
  void saveData(RADIO_SEED_KEY, seed ? { ...seed, songs: seed.type == 'artist' ? [] : seed.songs.slice(0, SEED_RADIO_MAX_SONGS) } : null)
}

const isFmList = () => playerState.playMusicInfo.listId == LIST_IDS.TEMP && listState.tempListMeta.id == FM_LIST_ID
const getPlayingMusic = () => {
  const info = playerState.playMusicInfo.musicInfo
  return info ? 'progress' in info ? info.metadata.musicInfo : info : null
}

// songs taken out of the radio after a skip (they don't come back)
let fmDropped: Music[] = []
// the skips that take the songs of the artist out of the queue, the ones of the way they were found
const PRUNE_ARTIST_PENALTY = 0.9
const PRUNE_ORIGIN_PENALTY = 1.5

// the songs of the radio around the one playing
const getRecentRadioSongs = () => {
  const playing = getPlayingMusic()
  const index = playing ? fmQueue.findIndex(m => m.id == playing.id) : -1
  return index < 0 ? fmQueue.slice(-FATIGUE_WINDOW) : fmQueue.slice(Math.max(0, index - FATIGUE_WINDOW))
}

/**
 * The songs coming in the radio: the ones the last skips say the user doesn't want now are taken out
 */
const pruneRadioQueue = () => {
  const playing = getPlayingMusic()
  const index = playing ? fmQueue.findIndex(m => m.id == playing.id) : -1
  if (index < 0) return
  const isOwn = fmSeed ? getSeedOwnCheck(fmSeed) : null
  const upcoming = fmQueue.slice(index + 1)
  const kept = upcoming.filter(music => {
    if (isOwn?.(music)) return true
    if (getArtistPenalty(music.singer) >= PRUNE_ARTIST_PENALTY) return false
    return songOrigins.get(getKey(music)) == 'familiar' || getOriginPenalty(music) < PRUNE_ORIGIN_PENALTY
  })
  if (kept.length == upcoming.length) return
  fmDropped = [...fmDropped, ...upcoming.filter(music => !kept.includes(music))].slice(-200)
  fmQueue = [...fmQueue.slice(0, index + 1), ...kept]
  void setTempList(FM_LIST_ID, [...fmQueue])
}

/**
 * A song of the radio listened to or skipped
 */
const handleRadioFeedback = (musicInfo: LX.Music.MusicInfo, type: 'play' | 'skip') => {
  if (!isFmList() || !fmQueue.some(m => m.id == musicInfo.id)) return
  const origin = songOrigins.get(getKey(musicInfo))
  if (type == 'play') {
    // listened to: the skips of its artist, of the way it was found count less
    for (const name of getArtists(musicInfo.singer)) changePenalty(artistPenalties, toArtistKey(name), value => value * 0.5)
    if (origin) changePenalty(originPenalties, origin, value => value * 0.5)
    return
  }
  // a song of the artist / of the list of the radio skipped: the radio is still what it is made of
  if (fmSeed && getSeedOwnCheck(fmSeed)(musicInfo)) return
  for (const name of getArtists(musicInfo.singer)) changePenalty(artistPenalties, toArtistKey(name), value => value + 1)
  if (origin) changePenalty(originPenalties, origin, value => value + 1)
  pruneRadioQueue()
  // the artists like it (the same kind of music) a little less too
  const artist = getArtists(musicInfo.singer)[0]
  if (!artist) return
  void getSimilarArtists(artist, 10).then(similar => {
    for (const { name, match } of similar) changePenalty(artistPenalties, toArtistKey(name), value => value + 0.4 * match)
  }).catch(() => {})
}

/**
 * Start the endless radio, returns false when there is nothing to base it on yet
 */
export const startFm = async(): Promise<boolean> => {
  if (fmState.loading) return true
  setFmState({ loading: true })
  try {
    const list = await generate(FM_BATCH)
    if (!list.length) return false
    await playRadio(list, null)
    return true
  } finally {
    setFmState({ loading: false })
  }
}

/**
 * Start the radio of an artist (its page), a playlist or an album, from their songs; returns false when nothing was found
 * @param target the page it is started from (tapped in the player: it opens)
 */
export const startSeedRadio = async(seed: RadioSeed, target?: PlayingFromTarget): Promise<boolean> => {
  if (fmState.loading) return true
  setFmState({ loading: true })
  try {
    let list = await generateSeedRadio(seed, [])
    // the radio of a song starts with it
    if (seed.type == 'song' && seed.songs.length) list = [seed.songs[0], ...list.filter(m => getKey(m) != getKey(seed.songs[0]))]
    if (!list.length) return false
    await playRadio(list, seed, target)
    return true
  } finally {
    setFmState({ loading: false })
  }
}

/**
 * Start the radio of a song (the menu of a song)
 */
export const startSongRadio = async(musicInfo: LX.Music.MusicInfo) => {
  return startSeedRadio({ type: 'song', name: musicInfo.name, songs: [musicInfo as Music] })
}

const playRadio = async(list: Music[], seed: RadioSeed | null, target?: PlayingFromTarget) => {
  fmQueue = list
  fmDropped = []
  setFmSeed(seed)
  // (the player shows what is playing: the radio, or the radio of an artist / a list with a link to its page)
  setPlayingFrom(FM_LIST_ID, 'radio', seed?.name ?? '', target)
  await setTempList(FM_LIST_ID, [...list])
  void playList(LIST_IDS.TEMP, 0)
  setFmState({ active: true })
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
    const playing = getPlayingMusic()
    await radioSeedPromise
    const recent = getRecentRadioSongs()
    const list = fmSeed
      ? await generateSeedRadio(fmSeed, [...fmQueue, ...fmDropped], playing ? [playing] : [], recent)
      : await generate({ ...FM_BATCH, exclude: new Set([...fmQueue, ...fmDropped].map(m => m.id)), seedSongs: playing ? [playing] : [], radio: { recent } })
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
  const active = isFmList()
  setFmState({ active })
  if (active && playerState.playInfo.playIndex >= fmQueue.length - FM_REFILL_REMAINING) void fillFm()
}
