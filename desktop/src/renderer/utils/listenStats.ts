import { normalizeArtistName } from './artistName'

// Listening stats (the same file in the desktop and the mobile app), like the stats of the history of Nuclear:
// the time each song is really listened (the player playing) is recorded by play, the stats are made from it:
// the top artists / albums / songs of a time range, the listening by hour of the day / day of the week, and
// the listening of each day of the last year.

/* ---------- storage ---------- */

export interface ListenStatsStorage {
  load: () => Promise<string | null>
  save: (data: string) => Promise<void>
}
let storage: ListenStatsStorage | null = null
/**
 * Where the log is kept (a file of the app), set by the app at its start
 */
export const setListenStatsStorage = (value: ListenStatsStorage) => {
  storage = value
}

// a play: [start (s), listened (s), song key]
type Play = [number, number, string]
interface StatsData {
  v: 1
  // the songs played, by key: their music info (to play / open them from the stats)
  songs: Record<string, LX.Music.MusicInfo>
  plays: Play[]
}

let data: StatsData | null = null
let loadPromise: Promise<StatsData> | null = null
const loadData = async(): Promise<StatsData> => {
  if (data) return data
  loadPromise ??= (async() => {
    let loaded: StatsData | null = null
    try {
      const text = await storage?.load()
      if (text) loaded = JSON.parse(text) as StatsData
    } catch (err) {
      console.log(err)
    }
    data = loaded?.v == 1 ? loaded : { v: 1, songs: {}, plays: [] }
    return data
  })()
  return loadPromise
}

/* ---------- sync (the log of every device of the user, merged) ---------- */

// the plays recorded / updated here since the last save: sent to the other devices
const changedPlays = new Set<Play>()
const changeListeners = new Set<(delta: string) => void>()
/**
 * The plays recorded here (as a log of their own, JSON), given when the log is saved: for the sync
 */
export const onListenStatsChanged = (listener: (delta: string) => void) => {
  changeListeners.add(listener)
  return () => { changeListeners.delete(listener) }
}

const playKey = (play: Play) => `${play[0]}|${play[2]}`
const parseData = (json: string | null | undefined): StatsData | null => {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as StatsData
    return parsed?.v == 1 && Array.isArray(parsed.plays) ? parsed : null
  } catch {
    return null
  }
}
// the plays of `other` put in `target`: the same play (start, song) once, with the longest time listened
const mergeInto = (target: StatsData, other: StatsData) => {
  const plays = new Map(target.plays.map(play => [playKey(play), play]))
  for (const play of other.plays) {
    const current = plays.get(playKey(play))
    if (current) {
      if (play[1] > current[1]) current[1] = play[1]
      continue
    }
    const added: Play = [play[0], play[1], play[2]]
    target.plays.push(added)
    plays.set(playKey(added), added)
  }
  for (const [key, musicInfo] of Object.entries(other.songs)) target.songs[key] ??= musicInfo
  target.plays.sort((a, b) => a[0] - b[0])
}

/**
 * Two logs (JSON) merged into one (JSON)
 */
export const mergeListenStatsData = (a: string | null, b: string | null): string => {
  const merged: StatsData = parseData(a) ?? { v: 1, songs: {}, plays: [] }
  const other = parseData(b)
  if (other) mergeInto(merged, other)
  return JSON.stringify(merged)
}

/**
 * The log of this device (JSON), for the sync
 */
export const getListenStatsData = async(): Promise<string> => JSON.stringify(await loadData())

/**
 * The log (JSON) of another device merged into the one of this device
 */
export const mergeListenStats = async(json: string) => {
  const other = parseData(json)
  if (!other) return
  mergeInto(await loadData(), other)
  scheduleSave()
}

const SAVE_DELAY = 30_000
let saveTimer: ReturnType<typeof setTimeout> | null = null
const saveNow = async() => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (data && changedPlays.size) {
    const plays = [...changedPlays]
    changedPlays.clear()
    if (changeListeners.size) {
      const songs: StatsData['songs'] = {}
      for (const play of plays) if (data.songs[play[2]]) songs[play[2]] = data.songs[play[2]]
      const delta = JSON.stringify({ v: 1, songs, plays } satisfies StatsData)
      for (const listener of changeListeners) listener(delta)
    }
  }
  if (!data || !storage) return
  await storage.save(JSON.stringify(data)).catch((err: unknown) => {
    console.log(err)
  })
}
const scheduleSave = () => {
  saveTimer ??= setTimeout(() => { void saveNow() }, SAVE_DELAY)
}

/* ---------- recording ---------- */

// a play shorter than this is not counted (a song skipped)
const MIN_PLAY_SECONDS = 5
// the position of the song went back to its start: it is played again (repeat)
const RESTART_POSITION = 3

// (the ids have their source already: "kw_123")
const songKey = (musicInfo: LX.Music.MusicInfo) => musicInfo.id

let current: { key: string, musicInfo: LX.Music.MusicInfo, start: number, listened: number, position: number, saved: Play | null } | null = null

const closeCurrent = () => {
  current = null
}

/**
 * Called by the app every few seconds while a song is playing: the time listened since the last call is
 * added to the play of the song (a new play when the song changes or starts again)
 * @param musicInfo the song played
 * @param elapsedMs the time played since the last call
 * @param position the position in the song (s)
 */
export const recordListening = async(musicInfo: LX.Music.MusicInfo, elapsedMs: number, position: number) => {
  const stats = await loadData()
  const key = songKey(musicInfo)
  if (!current || current.key != key || (position < RESTART_POSITION && current.position > position + RESTART_POSITION)) {
    closeCurrent()
    current = { key, musicInfo, start: Math.floor(Date.now() / 1000 - elapsedMs / 1000), listened: 0, position, saved: null }
  }
  current.position = position
  current.listened += elapsedMs / 1000
  if (current.listened < MIN_PLAY_SECONDS) return
  // the play is in the log from now on, updated while it goes on
  if (!current.saved) {
    stats.songs[key] = musicInfo
    current.saved = [current.start, 0, key]
    stats.plays.push(current.saved)
  }
  current.saved[1] = Math.round(current.listened)
  changedPlays.add(current.saved)
  scheduleSave()
}

/**
 * The player stopped playing the song (paused, closed...): the log is saved
 */
export const flushListening = async() => {
  await saveNow()
}

/* ---------- stats ---------- */

export type StatsRangeId = 'last7Days' | 'last30Days' | 'last90Days' | 'last12Months' | 'allTime'
export const STATS_RANGE_IDS: StatsRangeId[] = ['last7Days', 'last30Days', 'last90Days', 'last12Months', 'allTime']

const DAY = 24 * 60 * 60
export const getRangeFrom = (id: StatsRangeId, now = Date.now()): number => {
  const nowS = Math.floor(now / 1000)
  switch (id) {
    case 'last7Days': return nowS - 7 * DAY
    case 'last30Days': return nowS - 30 * DAY
    case 'last90Days': return nowS - 90 * DAY
    case 'last12Months': return nowS - 365 * DAY
    case 'allTime': return 0
  }
}

export interface StatsTopEntry {
  key: string
  name: string
  /** the artist of an album / a song */
  subtitle: string
  img: string | null
  /** listened (s) */
  seconds: number
  plays: number
  /** a song of the entry: to play it / open its album / artist */
  musicInfo: LX.Music.MusicInfo
}

export interface ListenStats {
  /** start of the range (s) */
  from: number
  to: number
  /** listened in the range (s) */
  seconds: number
  plays: number
  topArtists: StatsTopEntry[]
  topAlbums: StatsTopEntry[]
  topTracks: StatsTopEntry[]
  /** listened (s) by hour of the day (0 - 23) */
  hours: number[]
  /** listened (s) by day of the week (0: Monday - 6: Sunday) */
  weekdays: number[]
  /** listened (s) by day (YYYY-MM-DD, local time) of the last year, whatever the range */
  days: Record<string, number>
  /** the first play logged (s), null: none */
  firstPlay: number | null
}

const ARTIST_SPLIT_RXP = /\s*(?:、|&|;|；|\/|,|，|\|)\s*/
const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

const songImg = (musicInfo: LX.Music.MusicInfo) => (musicInfo.meta as { picUrl?: string | null }).picUrl ?? null

const top = (map: Map<string, StatsTopEntry>, limit: number) => [...map.values()]
  .sort((a, b) => b.seconds - a.seconds || b.plays - a.plays)
  .slice(0, limit)

/**
 * The stats of the plays from `from` (s) to now
 */
export const getListenStats = async(from: number, limit = 10): Promise<ListenStats> => {
  const stats = await loadData()
  const to = Math.floor(Date.now() / 1000)
  const artists = new Map<string, StatsTopEntry>()
  const albums = new Map<string, StatsTopEntry>()
  const tracks = new Map<string, StatsTopEntry>()
  const hours = Array<number>(24).fill(0)
  const weekdays = Array<number>(7).fill(0)
  const days: Record<string, number> = {}
  const yearAgo = to - 366 * DAY
  let seconds = 0
  let plays = 0
  const add = (map: Map<string, StatsTopEntry>, key: string, entry: Omit<StatsTopEntry, 'seconds' | 'plays' | 'key'>, listened: number) => {
    let item = map.get(key)
    if (!item) map.set(key, item = { ...entry, key, seconds: 0, plays: 0 })
    // the picture of a later play when the first one had none
    item.img ??= entry.img
    item.seconds += listened
    item.plays++
  }
  for (const [start, listened, key] of stats.plays) {
    const musicInfo = stats.songs[key]
    if (!musicInfo) continue
    const date = new Date(start * 1000)
    if (start >= yearAgo) days[dayKey(date)] = (days[dayKey(date)] ?? 0) + listened
    if (start < from) continue
    seconds += listened
    plays++
    hours[date.getHours()] += listened
    weekdays[(date.getDay() + 6) % 7] += listened
    const img = songImg(musicInfo)
    const artistNames = (musicInfo.singer ?? '').split(ARTIST_SPLIT_RXP).map(name => normalizeArtistName(name.trim())).filter(name => name)
    for (const name of artistNames) add(artists, name.toLowerCase(), { name, subtitle: '', img, musicInfo }, listened)
    const albumName = (musicInfo.meta as { albumName?: string | null }).albumName ?? ''
    if (albumName) add(albums, `${albumName.toLowerCase()}|${(artistNames[0] ?? '').toLowerCase()}`, { name: albumName, subtitle: artistNames[0] ?? '', img, musicInfo }, listened)
    add(tracks, key, { name: musicInfo.name, subtitle: musicInfo.singer ?? '', img, musicInfo }, listened)
  }
  return {
    from,
    to,
    seconds,
    plays,
    topArtists: top(artists, limit),
    topAlbums: top(albums, limit),
    topTracks: top(tracks, limit),
    hours,
    weekdays,
    days,
    firstPlay: stats.plays[0]?.[0] ?? null,
  }
}

/**
 * A time listened, "2 h 05 min", "12 min", "40 s"
 */
export const formatListened = (seconds: number) => {
  const total = Math.round(seconds)
  if (total < 60) return `${total} s`
  const minutes = Math.round(total / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)} min`
}

/**
 * The days of the calendar of the last year: weeks (Monday first) of days, the newest week last
 */
export const getCalendarWeeks = (now = new Date()) => {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // the Monday 52 weeks before the Monday of this week
  const start = new Date(end)
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 52 * 7)
  const weeks: Array<Array<{ key: string, date: Date } | null>> = []
  // eslint-disable-next-line no-unmodified-loop-condition -- the date is changed by setDate
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 7)) {
    const week: Array<{ key: string, date: Date } | null> = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(date)
      day.setDate(day.getDate() + i)
      week.push(day <= end ? { key: dayKey(day), date: day } : null)
    }
    weeks.push(week)
  }
  return weeks
}

/**
 * The listening clock: 24 pieces of a ring (the hour h from h:00 to h+1:00, clockwise from the top), each one
 * filled from the inside as much as it is listened (SVG paths, center 0 0)
 * @param hours listened (s) by hour
 * @param inner radius of the inside of the ring
 * @param outer radius of the outside of the ring
 * @param gap space between the pieces (degrees)
 */
export const getClockPieces = (hours: number[], inner: number, outer: number, gap = 1.6) => {
  const max = Math.max(0, ...hours)
  const point = (radius: number, angle: number) => {
    const rad = angle * Math.PI / 180
    return `${(Math.sin(rad) * radius).toFixed(2)} ${(-Math.cos(rad) * radius).toFixed(2)}`
  }
  const piece = (from: number, to: number, r0: number, r1: number) => {
    return `M${point(r0, from)}L${point(r1, from)}A${r1} ${r1} 0 0 1 ${point(r1, to)}L${point(r0, to)}A${r0} ${r0} 0 0 0 ${point(r0, from)}Z`
  }
  return hours.map((value, hour) => {
    const from = hour * 15 + gap / 2
    const to = (hour + 1) * 15 - gap / 2
    const filled = max ? value / max : 0
    return {
      hour,
      value,
      outline: piece(from, to, inner, outer),
      fill: filled ? piece(from, to, inner, inner + (outer - inner) * filled) : null,
    }
  })
}

/**
 * The time of an hour of the clock, "06:00 - 07:00"
 */
export const formatClockHour = (hour: number) => `${pad(hour)}:00 - ${pad((hour + 1) % 24)}:00`
