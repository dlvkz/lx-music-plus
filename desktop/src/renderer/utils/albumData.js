// The songs of an album (the album page, a song played from the search with its album)
import { markRawList } from '@common/utils/vueTools'
import musicSdk from '@renderer/utils/musicSdk'
import { toNewMusicInfo, deduplicationList } from '@renderer/utils'
import { getSecondaryAlbum, isSecondarySource } from '@renderer/utils/secondarySources'

// (the songs of a SoundCloud album are converted already)
export const toList = list => markRawList(deduplicationList(list.map(m => m.meta ? m : toNewMusicInfo(m))))
const formatTime = (sec) => `${String(Math.trunc(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
const mapWyAlbumSong = (s) => ({
  singer: (s.ar ?? []).map(a => a.name).join('、'),
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

export const normalizeAlbum = (source, id, res) => {
  if (source == 'wy') {
    const album = res?.album ?? {}
    return {
      info: {
        name: album.name ?? '',
        img: album.picUrl ?? null,
        author: (album.artist?.name ?? (album.artists?.[0]?.name)) || '',
        desc: album.description || album.briefDesc || '',
      },
      list: (res?.songs ?? []).map(mapWyAlbumSong),
      total: res?.songs?.length ?? 0,
    }
  }
  if (source == 'tx') {
    const list = res?.list ?? []
    // the sdk returns formatted songs, the album info is taken from the first one
    const first = list[0]
    return {
      info: {
        name: first?.albumName ?? '',
        img: first?.img ?? (/^\d+$/.test(id) ? null : `https://y.gtimg.cn/music/photo_new/T002R500x500M000${id}.jpg`),
        author: typeof first?.singer == 'string' ? first.singer : '',
        desc: '',
      },
      list,
      total: res?.total ?? list.length,
    }
  }
  // kw, kg, mg return { list, total, info: { name, img, desc, author } }
  return {
    info: res?.info ?? { name: '', img: null, author: '', desc: '' },
    list: res?.list ?? [],
    total: res?.total ?? 0,
  }
}

/**
 * Load an album: { info, list, total }
 */
export const loadAlbum = async(source, id, name = '') => {
  if (isSecondarySource(source)) {
    const album = await getSecondaryAlbum(source, id)
    return { info: { name: album.name || name, img: album.img, author: album.author, desc: '' }, list: toList(album.list), total: album.list.length }
  }
  if (!musicSdk[source]?.singer?.getAlbumDetail) throw new Error('no album detail for ' + source)
  const data = normalizeAlbum(source, id, await musicSdk[source].singer.getAlbumDetail(id))
  return { ...data, list: toList(data.list) }
}
