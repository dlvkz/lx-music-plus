import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo, deduplicationList } from '@/utils'
import { getDailyMix } from '@/core/recommend'
import { findArtist, getCombinedAlbums, getCombinedSongs, type SingerApi } from '@/utils/artistCombine'
import { bandcampSinger, getSecondaryAlbum, isSecondarySource, khinsiderSinger, soundcloudSinger } from '@/utils/secondarySources'
import { assertApiSupport } from '@/utils/tools'
import { getListDetail as getChartDetail } from '@/core/leaderboard'

type Music = LX.Music.MusicInfoOnline

export interface CollectionInfo {
  type: 'artist' | 'album' | 'dailyMix' | 'chart'
  name?: string
  source?: LX.OnlineSource
  /** artist: the source of the song the page is opened from (its artist first, a Bandcamp band...) */
  fromSource?: string
  id?: string
  img?: string | null
}

export interface AlbumItem {
  id: string
  name: string
  img: string | null
  source: LX.OnlineSource
}

export interface CollectionData {
  title: string
  subtitle: string
  img: string | null
  list: Music[]
  albums?: AlbumItem[]
}

const sdk = musicSdk as any
const toList = (list: unknown) => deduplicationList((list as any[]).map(m => toNewMusicInfo(m))) as Music[]

const formatTime = (sec: number) => `${String(Math.trunc(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
const mapWyAlbumSong = (s: any) => ({
  singer: (s.ar ?? []).map((a: any) => a.name).join('、'),
  name: s.name,
  albumName: s.al?.name ?? '',
  albumId: s.al?.id,
  songmid: s.id,
  source: 'wy',
  interval: formatTime(Math.round((s.dt ?? 0) / 1000)),
  img: s.al?.picUrl ?? null,
  lrc: null,
  otherSource: null,
  types: [{ type: '128k', size: null }, { type: '320k', size: null }],
  _types: { '128k': { size: null }, '320k': { size: null } },
  typeUrl: {},
})

const loadAlbum = async(info: CollectionInfo): Promise<CollectionData> => {
  const source = info.source ?? 'kw'
  // an album of a secondary source (SoundCloud, Bandcamp, KHInsider)
  if (isSecondarySource(source)) {
    if (!info.id) throw new Error('album id is required')
    const album = await getSecondaryAlbum(source, info.id)
    return { title: album.name || info.name || '', subtitle: album.author, img: album.img ?? info.img ?? null, list: album.list }
  }
  const getAlbumDetail = sdk[source]?.singer?.getAlbumDetail
  if (!info.id || !getAlbumDetail) throw new Error('album is not supported for this source')
  const res = await sdk[source].singer.getAlbumDetail(info.id)
  if (source == 'wy') {
    const album = res?.album ?? {}
    return {
      title: album.name ?? info.name ?? '',
      subtitle: (album.artist?.name ?? album.artists?.[0]?.name) || '',
      img: album.picUrl ?? info.img ?? null,
      list: toList((res?.songs ?? []).map(mapWyAlbumSong)),
    }
  }
  // kw returns { list, total, info: { name, img, desc, author } }
  return {
    title: res?.info?.name || info.name || '',
    subtitle: res?.info?.author ?? '',
    img: res?.info?.img ?? info.img ?? null,
    list: toList(res?.list ?? []),
  }
}

// the sources with artist pages, their picture and bio first (SoundCloud: the account of the same name)
// (Bandcamp / KHInsider: only when the others do not have the artist)
const ARTIST_SOURCES = ['wy', 'kw', 'sc', 'bc', 'kh'] as const
const ARTIST_ALBUM_LIMIT = 50
const artistSingers: Partial<Record<string, SingerApi>> = { wy: sdk.wy?.singer, kw: sdk.kw?.singer, sc: soundcloudSinger, bc: bandcampSinger, kh: khinsiderSinger }

// the artist on all the sources that have it: the songs and albums of all of them together
const loadArtist = async(info: CollectionInfo): Promise<CollectionData> => {
  const name = info.name ?? ''
  const singers = artistSingers
  const artist = await findArtist(name, singers, ARTIST_SOURCES, info.fromSource)
  if (!artist) throw new Error('artist not found')
  const [songs, albums] = await Promise.all([
    getCombinedSongs(artist.matches, singers, m => toNewMusicInfo(m) as Music, source => isSecondarySource(source) || assertApiSupport(source as LX.Source)),
    getCombinedAlbums(artist.matches, singers, ARTIST_ALBUM_LIMIT).catch(() => []),
  ])
  return {
    title: artist.info.name || name,
    subtitle: artist.info.desc,
    img: artist.info.avatar || info.img || null,
    list: songs,
    albums: albums.map(item => ({
      id: item.id,
      name: item.info?.name ?? '',
      img: item.info?.img ?? null,
      source: item.source as LX.OnlineSource,
    })),
  }
}

export const loadCollection = async(info: CollectionInfo): Promise<CollectionData> => {
  switch (info.type) {
    case 'album': return loadAlbum(info)
    case 'artist': return loadArtist(info)
    case 'chart': {
      if (!info.id) throw new Error('chart id is required')
      const detail = await getChartDetail(info.id, 1)
      return {
        title: info.name ?? '',
        subtitle: '',
        img: info.img ?? detail.list.find(m => m.meta.picUrl)?.meta.picUrl ?? null,
        list: detail.list,
      }
    }
    case 'dailyMix': {
      const list = await getDailyMix()
      return {
        title: '',
        subtitle: global.i18n.t('home__daily_mix_desc'),
        img: list.find(m => m.meta.picUrl)?.meta.picUrl ?? null,
        list,
      }
    }
  }
}
