import { isSameArtist, normalizeArtistName } from './artistName'
import { isSecondarySource, mergeNameKey, mergeSameSongs } from './secondarySources'

// Artist pages from all the sources at once (the same file in the desktop and the mobile app): the artist is
// looked up by its name on each source, the songs and the albums of all of them are shown together (the same
// song / album once), the picture and the bio are the first ones found in the order of the sources
// (NetEase, then Kuwo, then the others)

export interface SingerApi {
  search: (name: string) => Promise<string | number | null>
  getInfo: (id: string) => Promise<{
    info?: { name?: string | null, desc?: string | null, avatar?: string | null }
    count?: { music?: number | null, album?: number | null }
    /** a match that only counts when no other source has the artist (a small account of the same name) */
    weak?: boolean
  }>
  getSongList: (id: string, page: number, limit: number) => Promise<{ list: any[], total?: number | null }>
  getAlbumList: (id: string, page: number, limit: number) => Promise<{ list: any[], total?: number | null }>
}

export interface ArtistMatch {
  source: string
  id: string
}

export interface CombinedArtist {
  /** the artist on each source that has it, in the order of the sources */
  matches: ArtistMatch[]
  info: {
    name: string
    desc: string
    avatar: string | null
    count: { music: number, album: number }
  }
}

export interface CombinedAlbum {
  id: string
  source: string
  count?: number | null
  info: { name: string, img?: string | null, author?: string | null, desc?: string | null, time?: string | null }
}

type FoundArtist = ArtistMatch & {
  result: Awaited<ReturnType<SingerApi['getInfo']>>
  exact: boolean
}

/**
 * The artist on every source that has an artist of this name. A source that only has a similar looking artist
 * is left out, unless no source has the exact one: then the similar one of `fallbackSource` is taken.
 * `fallbackSource`: the source of the song the page is opened from, its artist is kept even when it is a weak
 * match (a Bandcamp band) and its picture / bio come first
 */
export const findArtist = async(name: string, singers: Partial<Record<string, SingerApi>>, sources: readonly string[], fallbackSource?: string): Promise<CombinedArtist | null> => {
  const target = normalizeArtistName(name)
  const results = await Promise.all(sources.map(async(source): Promise<FoundArtist | null> => {
    const singer = singers[source]
    if (!singer) return null
    try {
      const id = await singer.search(target)
      if (!id) return null
      const result = await singer.getInfo(String(id))
      // sources fall back to a similar looking artist when the exact one is missing
      const exact = !result.info?.name || isSameArtist(String(result.info.name), target)
      return { source, id: String(id), result, exact }
    } catch (err) {
      console.log(err)
      return null
    }
  }))
  let found = results.filter((r): r is FoundArtist => !!r?.exact)
  if (found.some(r => !r.result.weak)) found = found.filter(r => !r.result.weak || r.source == fallbackSource)
  const clicked = found.find(r => r.source == fallbackSource && r.result.weak)
  if (clicked) found = [clicked, ...found.filter(r => r != clicked)]
  if (!found.length) {
    const fallback = results.find(r => r && r.source == fallbackSource)
    if (fallback) found = [fallback]
  }
  if (!found.length) return null

  // each piece of the profile: the first source that has it
  const first = <T>(get: (r: FoundArtist) => T | null | undefined | ''): T | null => {
    for (const r of found) {
      const value = get(r)
      if (value) return value
    }
    return null
  }
  const most = (get: (r: FoundArtist) => number | null | undefined) => Math.max(0, ...found.map(r => Number(get(r)) || 0))
  return {
    matches: found.map(r => ({ source: r.source, id: r.id })),
    info: {
      name: first(r => r.result.info?.name) ?? target,
      desc: first(r => r.result.info?.desc?.trim()) ?? '',
      avatar: first(r => r.result.info?.avatar) ?? null,
      count: {
        music: most(r => r.result.count?.music),
        album: most(r => r.result.count?.album),
      },
    },
  }
}

const ARTIST_PAGE_LIMIT = 100
const ARTIST_MAX_PAGES = 20

// every song of the artist on a source (the pages after the first one at once)
const getAllSongs = async(singer: SingerApi, id: string): Promise<any[]> => {
  const first = await singer.getSongList(id, 1, ARTIST_PAGE_LIMIT)
  const pageCount = Math.min(ARTIST_MAX_PAGES, Math.ceil((Number(first.total) || 0) / ARTIST_PAGE_LIMIT))
  const others = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, async(_, i) => {
    return singer.getSongList(id, i + 2, ARTIST_PAGE_LIMIT).then(result => result.list).catch((err: unknown) => {
      console.log(err)
      return []
    })
  }))
  return [first.list, ...others].flat()
}

/**
 * Every song of the artist on all its sources: the songs of the main sources in turns (their most popular
 * first), then the ones of the secondary sources (SoundCloud) the main sources do not have. The same song is
 * there once, played from NetEase, then Kuwo, then the others (`mergeSameSongs`)
 */
export const getCombinedSongs = async<T extends LX.Music.MusicInfo>(
  matches: ArtistMatch[],
  singers: Partial<Record<string, SingerApi>>,
  toMusicInfo: (raw: any) => T,
  isSupported?: (source: string) => boolean,
): Promise<T[]> => {
  const results = await Promise.all(matches.map(async({ source, id }) => {
    try {
      const list = await getAllSongs(singers[source]!, id)
      // the secondary sources give their songs converted already
      return { source, list: list.map(raw => (raw?.meta ? raw : toMusicInfo(raw)) as T) }
    } catch (err) {
      console.log(err)
      return null
    }
  }))
  if (results.every(r => !r)) throw new Error('get artist songs failed')
  const mainLists = results.filter(r => r && !isSecondarySource(r.source)).map(r => r!.list)
  const secondaryLists = results.filter(r => r && isSecondarySource(r.source)).map(r => r!.list)
  const ids = new Set<string>()
  const ordered: T[] = []
  const add = (musicInfo: T | undefined) => {
    if (!musicInfo || ids.has(musicInfo.id)) return
    ids.add(musicInfo.id)
    ordered.push(musicInfo)
  }
  const longest = Math.max(0, ...mainLists.map(list => list.length))
  for (let i = 0; i < longest; i++) for (const list of mainLists) add(list[i])
  for (const list of secondaryLists) list.forEach(add)
  const merged = mergeSameSongs(ordered, isSupported)
  // a song of the main sources is exact (their id): the secondary copies of it are left out
  const mainNames = new Set(merged.filter(m => !isSecondarySource(m.source)).map(m => mergeNameKey(m.name)))
  return merged.filter(m => !isSecondarySource(m.source) || !mainNames.has(mergeNameKey(m.name)))
}

// a source marks the explicit version of an album, another one does not: the same album
const EXPLICIT_RXP = /\s*[([（【［]\s*explicit(?:\s+version)?\s*[)\]）】］]/gi
const albumKey = (name: string) => name.replace(EXPLICIT_RXP, ' ').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w).join(' ')

/**
 * The albums of the artist on all its sources: the ones of the first source, then the ones the others have
 * more (the same album name once, an "(Explicit)" tag left out)
 */
export const getCombinedAlbums = async(matches: ArtistMatch[], singers: Partial<Record<string, SingerApi>>, limit: number): Promise<CombinedAlbum[]> => {
  const results = await Promise.all(matches.map(async({ source, id }) => {
    try {
      const result = await singers[source]!.getAlbumList(id, 1, limit)
      return (result.list as any[]).map((item): CombinedAlbum => ({ ...item, id: String(item.id), source }))
    } catch (err) {
      console.log(err)
      return null
    }
  }))
  if (results.every(r => !r)) throw new Error('get artist albums failed')
  const keys = new Set<string>()
  const albums: CombinedAlbum[] = []
  for (const list of results) {
    for (const album of list ?? []) {
      const key = albumKey(album.info?.name ?? '') || `${album.source}_${album.id}`
      if (keys.has(key)) continue
      keys.add(key)
      albums.push(album)
    }
  }
  return albums
}
