import { normalizeArtistName } from './artistName'
import {
  decodeHtml,
  searchBandcampAlbums,
  searchKhinsiderAlbums,
  searchBandcampArtists,
  searchSoundcloudAlbums,
  searchSoundcloudArtists,
  secondaryGetJson,
  secondaryGetText,
} from './secondarySources'

// The artist / album searches (the same file in the desktop and the mobile app): every source is searched at
// once, the results of all of them are put together (the results of each source in turns, their best first),
// the same artist (name) / album (name and artist) once, from the first source of the list

export interface ArtistSearchResult {
  name: string
  img: string | null
  /** the sources that have the artist, in the order of the sources searched */
  sources: string[]
}

export interface AlbumSearchResult {
  source: string
  id: string
  name: string
  artist: string
  img: string | null
  count: number | null
  time: string | null
}

const SOURCE_TIMEOUT = 10000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const formatDate = (time: number | string | null | undefined) => {
  if (!time) return null
  if (typeof time == 'number') return new Date(time).toISOString().slice(0, 10)
  return time.slice(0, 10) || null
}

/* ---------- NetEase ---------- */

const wySearch = async<T>(type: number, query: string, limit: number) => {
  return secondaryGetJson<{ result?: T }>(`https://music.163.com/api/cloudsearch/pc?type=${type}&limit=${limit}&offset=0&s=${encodeURIComponent(query)}`, {
    headers: { Referer: 'https://music.163.com', 'User-Agent': UA },
  })
}

const wyArtists = async(query: string, limit: number) => {
  const data = await wySearch<{ artists?: Array<{ name: string, picUrl?: string | null, img1v1Url?: string | null }> }>(100, query, limit)
  return (data.result?.artists ?? []).map(a => ({ name: a.name, img: a.picUrl || null }))
}

const wyAlbums = async(query: string, limit: number): Promise<AlbumSearchResult[]> => {
  const data = await wySearch<{ albums?: Array<{ id: number, name: string, picUrl?: string | null, size?: number, publishTime?: number, artist?: { name: string }, artists?: Array<{ name: string }> }> }>(10, query, limit)
  return (data.result?.albums ?? []).map(a => ({
    source: 'wy',
    id: String(a.id),
    name: a.name,
    artist: a.artists?.map(artist => artist.name).join('、') || a.artist?.name || '',
    img: a.picUrl ?? null,
    count: a.size ?? null,
    time: formatDate(a.publishTime),
  }))
}

/* ---------- Kuwo ---------- */

// the answers of Kuwo are objects written with ' (as the musicSdk of Kuwo reads them)
const kwJson = async<T>(url: string): Promise<T> => {
  const text = await secondaryGetText(url, { headers: { 'User-Agent': UA } })
  return JSON.parse(text.replace(/('(?=(,\s*')))|('(?=:))|((?<=([:,]\s*))')|((?<={)')|('(?=}))/g, '"')) as T
}
// (some characters come escaped twice: "\\u0026")
const kwText = (text: string | null | undefined) => decodeHtml(text ?? '')
  .replace(/\\+u([0-9a-f]{4})/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
  .replace(/\u00a0/g, ' ')
  .trim()

const kwArtists = async(query: string, limit: number) => {
  const data = await kwJson<{ abslist?: Array<{ ARTIST: string, hts_PICPATH?: string }> }>(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(query)}&pn=0&rn=${limit}&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=artist&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`)
  return (data.abslist ?? []).map(a => ({ name: kwText(a.ARTIST), img: a.hts_PICPATH || null }))
}

const kwAlbums = async(query: string, limit: number): Promise<AlbumSearchResult[]> => {
  const data = await kwJson<{ albumlist?: Array<{ albumid: string, name: string, artist: string, hts_img?: string, img?: string, musiccnt?: string, pub?: string }> }>(`http://search.kuwo.cn/r.s?all=${encodeURIComponent(query)}&ft=album&itemset=web_2013&client=kt&pn=0&rn=${limit}&rformat=json&encoding=utf8`)
  return (data.albumlist ?? []).map(a => ({
    source: 'kw',
    id: String(a.albumid),
    name: kwText(a.name),
    artist: kwText(a.artist).replace(/&/g, '、'),
    img: a.hts_img || a.img || null,
    count: parseInt(a.musiccnt ?? '') || null,
    time: formatDate(a.pub),
  }))
}

/* ---------- QQ ---------- */

const txSearch = async<T>(searchType: number, query: string, limit: number) => {
  const data = await secondaryGetJson<{ req?: { data?: { body?: T } } }>('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      comm: { ct: '19', cv: '1859', uin: '0' },
      req: { method: 'DoSearchForQQMusicDesktop', module: 'music.search.SearchCgiService', param: { grp: 1, num_per_page: limit, page_num: 1, query, search_type: searchType } },
    }),
  })
  return data.req?.data?.body
}

const txArtists = async(query: string, limit: number) => {
  const body = await txSearch<{ singer?: { list?: Array<{ singerName: string, singerPic?: string }> } }>(1, query, limit)
  return (body?.singer?.list ?? []).map(a => ({ name: a.singerName, img: a.singerPic?.replace('150x150', '500x500') || null }))
}

const txAlbums = async(query: string, limit: number): Promise<AlbumSearchResult[]> => {
  const body = await txSearch<{ album?: { list?: Array<{ albumMID: string, albumName: string, albumPic?: string, publicTime?: string, song_count?: number, singerName?: string, singer_list?: Array<{ name: string }> }> } }>(2, query, limit)
  return (body?.album?.list ?? []).map(a => ({
    source: 'tx',
    id: a.albumMID,
    name: a.albumName,
    artist: a.singer_list?.map(singer => singer.name).join('、') || a.singerName || '',
    img: a.albumPic?.replace('180x180', '500x500') || null,
    count: a.song_count ?? null,
    time: formatDate(a.publicTime),
  }))
}

/* ---------- Kugou ---------- */

const kgSearch = async<T>(kind: string, query: string, limit: number) => {
  const text = await secondaryGetText(`http://msearchcdn.kugou.com/api/v3/search/${kind}?keyword=${encodeURIComponent(query)}&page=1&pagesize=${limit}&showtype=10&plat=2&version=7910&correct=1&sver=5`, { headers: { 'User-Agent': UA } })
  // the answer can start with a comment
  return (JSON.parse(text.replace(/^<!--[\s\S]*?-->/, '')) as { data?: T }).data
}

const kgArtists = async(query: string, limit: number) => {
  const data = await kgSearch<Array<{ singername: string }>>('singer', query, limit)
  return (Array.isArray(data) ? data : []).map(a => ({ name: a.singername, img: null }))
}

const kgAlbums = async(query: string, limit: number): Promise<AlbumSearchResult[]> => {
  const data = await kgSearch<{ info?: Array<{ albumid: number, albumname: string, singername?: string, imgurl?: string, songcount?: number, publishtime?: string }> }>('album', query, limit)
  return (data?.info ?? []).map(a => ({
    source: 'kg',
    id: String(a.albumid),
    name: a.albumname,
    artist: a.singername ?? '',
    img: a.imgurl?.replace('{size}', '400') || null,
    count: a.songcount ?? null,
    time: formatDate(a.publishtime),
  }))
}

/* ---------- all together ---------- */

type ArtistSearcher = (query: string, limit: number) => Promise<Array<{ name: string, img: string | null }>>
type AlbumSearcher = (query: string, limit: number) => Promise<AlbumSearchResult[]>

const ARTIST_SEARCHERS: Record<string, ArtistSearcher> = {
  wy: wyArtists,
  kw: kwArtists,
  tx: txArtists,
  kg: kgArtists,
  sc: searchSoundcloudArtists,
  bc: searchBandcampArtists,
}
const ALBUM_SEARCHERS: Record<string, AlbumSearcher> = {
  wy: wyAlbums,
  kw: kwAlbums,
  tx: txAlbums,
  kg: kgAlbums,
  sc: searchSoundcloudAlbums,
  bc: searchBandcampAlbums,
  kh: searchKhinsiderAlbums,
}

// the results of each source (an empty list for a source that fails / does not answer in time)
const searchAll = async<T>(sources: readonly string[], searchers: Record<string, (query: string, limit: number) => Promise<T[]>>, query: string, limit: number) => {
  return Promise.all(sources.map(async source => {
    const searcher = searchers[source]
    if (!searcher) return []
    return Promise.race([
      searcher(query, limit).catch((err: unknown) => {
        console.log(err)
        return []
      }),
      new Promise<T[]>(resolve => setTimeout(() => { resolve([]) }, SOURCE_TIMEOUT)),
    ])
  }))
}

// the results of the sources in turns: the best ones of each source first
const interleave = <T>(lists: T[][]) => {
  const result: T[] = []
  const longest = Math.max(0, ...lists.map(list => list.length))
  for (let i = 0; i < longest; i++) for (const list of lists) if (i < list.length) result.push(list[i])
  return result
}

const nameKey = (name: string) => name.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w).join(' ')
const artistKey = (name: string) => normalizeArtistName(name).toLowerCase()
const EXPLICIT_RXP = /\s*[([（【［]\s*explicit(?:\s+version)?\s*[)\]）】］]/gi

/**
 * Artists of all the sources (in the order of `sources`: their pictures first): the same name once, the ones
 * with exactly the name searched first
 */
export const searchArtists = async(query: string, sources: readonly string[], limit = 20): Promise<ArtistSearchResult[]> => {
  const lists = await searchAll(sources, ARTIST_SEARCHERS, query, limit)
  const groups = new Map<string, { name: string, imgs: Array<string | null>, sources: string[] }>()
  for (const [index, list] of lists.entries()) {
    for (const artist of list) {
      const key = artistKey(artist.name)
      if (!key) continue
      let group = groups.get(key)
      if (!group) groups.set(key, group = { name: normalizeArtistName(artist.name), imgs: sources.map(() => null), sources: [] })
      group.imgs[index] ??= artist.img
      if (!group.sources.includes(sources[index])) group.sources.push(sources[index])
    }
  }
  // the order of the results: the results of the sources in turns
  const order = interleave(lists.map(list => list.map(artist => artistKey(artist.name))))
  const target = artistKey(query)
  const keys = [...new Set(order)].filter(key => groups.has(key))
  return keys
    .map((key, index) => ({ key, index, exact: key == target }))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || a.index - b.index)
    .map(({ key }) => {
      const group = groups.get(key)!
      return {
        name: group.name,
        img: group.imgs.find(img => img) ?? null,
        sources: sources.filter(source => group.sources.includes(source)),
      }
    })
}

/**
 * Albums of all the sources: the same album (name, an "(Explicit)" tag left out, and first artist) once, the
 * copy of the first source of `sources` (at the place of the best ranked copy)
 */
export const searchAlbums = async(query: string, sources: readonly string[], limit = 20): Promise<AlbumSearchResult[]> => {
  const lists = await searchAll(sources, ALBUM_SEARCHERS, query, limit)
  const albumKey = (album: AlbumSearchResult) => `${nameKey(album.name.replace(EXPLICIT_RXP, ' '))}|${artistKey(album.artist.split(/[、&,/，]/)[0] ?? '')}`
  const best = new Map<string, AlbumSearchResult>()
  for (const list of lists) {
    for (const album of list) {
      const key = albumKey(album)
      const current = best.get(key)
      // the source first in the list, the picture of another copy when it has none
      if (!current) best.set(key, album)
      else if (!current.img && album.img) best.set(key, { ...current, img: album.img })
    }
  }
  const result: AlbumSearchResult[] = []
  const added = new Set<string>()
  for (const album of interleave(lists)) {
    const key = albumKey(album)
    if (added.has(key)) continue
    added.add(key)
    result.push(best.get(key)!)
  }
  return result
}
