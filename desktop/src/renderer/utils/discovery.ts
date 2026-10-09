import { normalizeArtistName } from './artistName'
import { getSimilarArtists as getLastfmSimilarArtists, getSimilarTracks as getLastfmSimilarTracks, isLastfmEnabled } from './lastfm'
import { secondaryGetJson } from './secondarySources'
import { type ChartTrack } from './chartSources'

// Discovery (the same file in the desktop and the mobile app): the artists / songs similar to the ones the user
// likes, for the recommendations, the radio and the home page. From Last.fm when its key is set (its data is the
// best for it, like Nuclear), else from Deezer (its related artists / artist radio, no account).

export interface SimilarArtist {
  name: string
  /** 0 - 1 */
  match: number
  img: string | null
}

export interface SimilarTrack extends ChartTrack {
  /** 0 - 1 */
  match: number
}

const DEEZER_API = 'https://api.deezer.com'
const CACHE_TIME = 6 * 60 * 60 * 1000
const cache = new Map<string, { time: number, data: unknown }>()
const cached = async<T>(key: string, load: () => Promise<T>): Promise<T> => {
  const item = cache.get(key)
  if (item && Date.now() - item.time < CACHE_TIME) return item.data as T
  const data = await load()
  if (cache.size > 300) cache.clear()
  cache.set(key, { time: Date.now(), data })
  return data
}

const nameKey = (name: string) => normalizeArtistName(name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/* ---------- Deezer ---------- */

interface DeezerArtist { id: number, name: string, nb_fan?: number, picture_xl?: string | null, picture_big?: string | null }
interface DeezerTrack { title?: string, duration?: number, artist?: { name?: string } }

/**
 * The artist of Deezer with this name (the one with the most fans)
 */
const getDeezerArtist = async(name: string): Promise<DeezerArtist | null> => cached(`dz_artist_${nameKey(name)}`, async() => {
  const data = await secondaryGetJson<{ data?: DeezerArtist[] }>(`${DEEZER_API}/search/artist?q=${encodeURIComponent(name)}&limit=10`)
  const target = nameKey(name)
  return (data.data ?? []).filter(artist => nameKey(artist.name) == target).sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0] ?? null
})

const deezerImg = (artist: DeezerArtist) => artist.picture_xl ?? artist.picture_big ?? null

const getDeezerSimilarArtists = async(name: string, limit: number): Promise<SimilarArtist[]> => {
  const artist = await getDeezerArtist(name)
  if (!artist) return []
  const data = await secondaryGetJson<{ data?: DeezerArtist[] }>(`${DEEZER_API}/artist/${artist.id}/related?limit=${limit}`)
  const list = data.data ?? []
  // in the order of Deezer, the first ones the closest
  return list.map((item, index) => ({ name: item.name, match: 1 - index / Math.max(1, list.length), img: deezerImg(item) }))
}

// the radio of the artist of the song (songs of the artist and of similar ones)
const getDeezerSimilarTracks = async(artistName: string, limit: number): Promise<SimilarTrack[]> => {
  const artist = await getDeezerArtist(artistName)
  if (!artist) return []
  const data = await secondaryGetJson<{ data?: DeezerTrack[] }>(`${DEEZER_API}/artist/${artist.id}/radio?limit=${limit}`)
  const list = (data.data ?? []).filter(track => track.title && track.artist?.name)
  return list.map((track, index) => ({ name: track.title!, singer: track.artist!.name!, durationMs: (track.duration ?? 0) * 1000, match: 1 - index / Math.max(1, list.length) }))
}

/**
 * The picture of an artist (Deezer)
 */
export const getArtistPicture = async(name: string): Promise<string | null> => {
  const artist = await getDeezerArtist(name).catch(() => null)
  return artist ? deezerImg(artist) : null
}

/* ---------- discovery ---------- */

/**
 * The artists similar to an artist
 */
export const getSimilarArtists = async(name: string, limit = 20): Promise<SimilarArtist[]> => cached(`similar_artists_${isLastfmEnabled() ? 'lfm' : 'dz'}_${nameKey(name)}_${limit}`, async() => {
  if (isLastfmEnabled()) {
    try {
      const list = await getLastfmSimilarArtists(name, limit)
      // (Last.fm lists collaborations as artists: "A, B")
      const artists = list.filter(item => !/,|&| x | feat\.? /i.test(item.name))
      if (artists.length) return artists.map(item => ({ ...item, img: null }))
    } catch (err) {
      console.log(err)
    }
  }
  return getDeezerSimilarArtists(name, limit)
})

/**
 * The songs similar to a song (other songs of the artist too)
 */
export const getSimilarTracks = async(name: string, artist: string, limit = 20): Promise<SimilarTrack[]> => cached(`similar_tracks_${isLastfmEnabled() ? 'lfm' : 'dz'}_${nameKey(artist)}_${name.toLowerCase()}_${limit}`, async() => {
  if (isLastfmEnabled()) {
    try {
      const list = await getLastfmSimilarTracks(artist, name, limit)
      if (list.length) return list.map(item => ({ name: item.name, singer: item.artist, durationMs: item.durationMs, match: item.match }))
    } catch (err) {
      console.log(err)
    }
  }
  return getDeezerSimilarTracks(artist, limit)
})
