import { normalizeArtistName } from './artistName'
import { CHART_SOURCE_NAMES, DEEZER_ALBUM_PREFIX, DEEZER_WORLDWIDE_ID, getChartBoards } from './chartSources'
import { getArtistPicture, getSimilarArtists } from './discovery'
import { getSoundcloudCuratedPlaylists, secondaryGetJson } from './secondarySources'

// The home page (the same file in the desktop and the mobile app): the sections of every source mixed (the
// first ones of each source in turns), and the artists for the user (similar to the ones they listen to).

/** the page that opens a card: a playlist (its source: NetEase / SoundCloud), a chart (Spotify / Deezer), an album */
export type HomeOpen = 'songlist' | 'chart' | 'album'

export interface HomePlaylist {
  id: string
  name: string
  img: string | null
  source: string
  /** the name of the source shown on the card */
  sourceName: string
  open: HomeOpen
}

export interface HomeAlbum {
  id: string
  name: string
  artist: string
  img: string | null
  source: string
  sourceName: string
  open: HomeOpen
}

export interface HomeArtist {
  name: string
  img: string | null
  source: string
}

const DEEZER_API = 'https://api.deezer.com'

// the songs of the worldwide chart of Deezer (its "/chart/0" answers are the ones of the country of the user):
// its albums and artists for the home page
interface DeezerChartTrack {
  album?: { id: number, title: string, cover_xl?: string | null }
  artist?: { id: number, name: string, picture_xl?: string | null }
}
let worldwideTask: Promise<DeezerChartTrack[]> | null = null
const getWorldwideTracks = async() => {
  worldwideTask ??= secondaryGetJson<{ data?: DeezerChartTrack[] }>(`${DEEZER_API}/playlist/${DEEZER_WORLDWIDE_ID}/tracks?limit=100`).then(data => data.data ?? []).catch(err => {
    worldwideTask = null
    throw err
  })
  return worldwideTask
}

// the items of each list in turns, the same key once
export const interleave = <T>(lists: T[][], key: (item: T) => string, limit: number): T[] => {
  const result: T[] = []
  const keys = new Set<string>()
  const longest = Math.max(0, ...lists.map(list => list.length))
  for (let i = 0; i < longest && result.length < limit; i++) {
    for (const list of lists) {
      const item = list[i]
      if (!item) continue
      const itemKey = key(item)
      if (keys.has(itemKey)) continue
      keys.add(itemKey)
      result.push(item)
      if (result.length >= limit) break
    }
  }
  return result
}

const settle = async<T>(task: Promise<T[]>): Promise<T[]> => task.catch((err: unknown) => {
  console.log(err)
  return []
})

/**
 * The playlists of NetEase (given), Deezer (its worldwide / country charts), SoundCloud (made by it) and Spotify (its charts)
 */
export const getMixedPlaylists = async(netease: HomePlaylist[], limit = 18): Promise<HomePlaylist[]> => {
  const [deezer, soundcloud, spotify] = await Promise.all([
    settle(getChartBoards('dz').then(boards => boards.map(board => ({ id: board.id, name: board.name, img: board.pic, source: 'dz', sourceName: CHART_SOURCE_NAMES.dz, open: 'chart' as const })))),
    settle(getSoundcloudCuratedPlaylists().then(list => list.map(item => ({ id: item.id, name: item.name, img: item.pic, source: 'sc', sourceName: 'SoundCloud', open: 'songlist' as const })))),
    settle(getChartBoards('sp').then(boards => boards.map(board => ({ id: board.id, name: board.name, img: board.pic, source: 'sp', sourceName: CHART_SOURCE_NAMES.sp, open: 'chart' as const })))),
  ])
  return interleave([netease, deezer, soundcloud, spotify], item => `${item.source}_${item.id}`, limit)
}

/**
 * The new albums of NetEase (given) and the albums of the worldwide chart of Deezer (their songs found on the main sources)
 */
export const getMixedAlbums = async(netease: HomeAlbum[], limit = 18): Promise<HomeAlbum[]> => {
  const deezer = await settle(getWorldwideTracks().then(tracks => {
    const albums = new Map<number, HomeAlbum>()
    for (const track of tracks) {
      if (!track.album || albums.has(track.album.id)) continue
      albums.set(track.album.id, {
        id: `dz__${DEEZER_ALBUM_PREFIX}${track.album.id}`,
        name: track.album.title,
        artist: track.artist?.name ?? '',
        img: track.album.cover_xl ?? null,
        source: 'dz',
        sourceName: CHART_SOURCE_NAMES.dz,
        open: 'chart',
      })
    }
    return Array.from(albums.values()).slice(0, 12)
  }))
  return interleave([netease, deezer], item => `${item.name}|${item.artist}`.toLowerCase(), limit)
}

/**
 * The popular artists of NetEase (given) and of the worldwide chart of Deezer
 */
export const getMixedArtists = async(netease: HomeArtist[], limit = 16): Promise<HomeArtist[]> => {
  const deezer = await settle(getWorldwideTracks().then(tracks => {
    const artists = new Map<number, HomeArtist>()
    for (const track of tracks) {
      if (!track.artist || artists.has(track.artist.id)) continue
      artists.set(track.artist.id, { name: track.artist.name, img: track.artist.picture_xl ?? null, source: 'dz' })
    }
    return Array.from(artists.values()).slice(0, 12)
  }))
  return interleave([netease, deezer], item => normalizeArtistName(item.name).toLowerCase(), limit)
}

/**
 * Artists for the user: the ones similar to the artists they listen to the most (Last.fm, else Deezer), the
 * ones similar to several of them first, without the ones they already listen to
 * @param topArtists the artists the user listens to the most, the first ones first
 */
export const getArtistsForYou = async(topArtists: string[], limit = 14): Promise<{ seeds: string[], list: HomeArtist[] }> => {
  const seeds = topArtists.slice(0, 4)
  const keyOf = (name: string) => normalizeArtistName(name).toLowerCase()
  const known = new Set(topArtists.map(keyOf))
  const lists = await Promise.all(seeds.map(async name => settle(getSimilarArtists(name, 20))))
  // a seed whose similar artists have nothing in common with the ones of the others (or with the artists of the
  // user) is likely another artist of the same name: its artists come last
  const keysOf = lists.map(list => new Set(list.map(artist => keyOf(artist.name))))
  const isConsistent = lists.map((list, index) => {
    if (seeds.length < 2) return true
    return list.some(artist => {
      const key = keyOf(artist.name)
      return known.has(key) || keysOf.some((keys, other) => other != index && keys.has(key))
    })
  })
  const seedCount = new Map<string, number>()
  for (const keys of keysOf) for (const key of keys) seedCount.set(key, (seedCount.get(key) ?? 0) + 1)

  const result: Array<{ name: string, img: string | null }> = []
  const added = new Set<string>()
  const add = (artist: { name: string, img: string | null }) => {
    const key = keyOf(artist.name)
    if (known.has(key) || added.has(key) || result.length >= limit) return
    added.add(key)
    result.push({ name: artist.name, img: artist.img })
  }
  // the artists similar to several of the artists of the user first, then the ones of each artist in turns
  const all = lists.flatMap((list, index) => isConsistent[index] ? list : [])
  for (const artist of all.filter(artist => (seedCount.get(keyOf(artist.name)) ?? 0) > 1).sort((a, b) => b.match - a.match)) add(artist)
  for (const artist of interleave(lists.filter((_, index) => isConsistent[index]), artist => keyOf(artist.name), limit * 2)) add(artist)
  for (const artist of interleave(lists.filter((_, index) => !isConsistent[index]), artist => keyOf(artist.name), limit)) add(artist)
  // the pictures (Last.fm has none): Deezer
  await Promise.all(result.map(async item => {
    if (!item.img) item.img = await getArtistPicture(item.name)
  }))
  return { seeds: seeds.filter((_, index) => isConsistent[index]), list: result.map(item => ({ name: item.name, img: item.img, source: '' })) }
}
