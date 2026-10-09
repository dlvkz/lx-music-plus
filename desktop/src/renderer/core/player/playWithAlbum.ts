import { LIST_IDS } from '@common/constants'
import { setTempList } from '@renderer/store/list/action'
import { tempListMeta } from '@renderer/store/list/state'
import { setPlayingFrom } from '@renderer/store/list/playingFrom'
import { playMusicInfo } from '@renderer/store/player/state'
import { playList } from '@renderer/core/player/action'
import { getSecondarySongAlbum, isSecondarySource } from '@renderer/utils/secondarySources'
import { loadAlbum } from '@renderer/utils/albumData'

const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg']
const normalize = (text: string | null | undefined) => (text ?? '').trim().toLowerCase()

// the album of a song (a secondary source: looked for, a single may have none)
const findAlbum = async(musicInfo: LX.Music.MusicInfoOnline): Promise<{ source: string, id: string, name: string } | null> => {
  if (isSecondarySource(musicInfo.source)) return getSecondarySongAlbum(musicInfo)
  const meta = musicInfo.meta as LX.Music.MusicInfoMeta_online
  if (!ONLINE_SOURCES.includes(musicInfo.source) || !meta.albumId) return null
  return { source: musicInfo.source, id: String(meta.albumId), name: meta.albumName ?? '' }
}

/**
 * A song of the search: played at once, then the songs of its album are put around it, so the album carries on after
 * it. A single, or a song without album: the queue is only that song
 */
export const playWithAlbum = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const tempId = `album_song_${musicInfo.id}`
  const albumName = musicInfo.meta.albumName ?? ''
  setPlayingFrom(tempId, 'album', albumName || musicInfo.name)
  await setTempList(tempId, [musicInfo])
  playList(LIST_IDS.TEMP, 0)

  const album = await findAlbum(musicInfo).catch((err: unknown) => {
    console.log(err)
    return null
  })
  if (!album) return
  const data = await loadAlbum(album.source, album.id, album.name).catch((err: unknown) => {
    console.log(err)
    return null
  }) as { info: { name: string }, list: LX.Music.MusicInfoOnline[] } | null
  if (!data || data.list.length < 2) return
  // another song or list may have been played meanwhile
  if (tempListMeta.id != tempId || playMusicInfo.listId != LIST_IDS.TEMP) return
  let index = data.list.findIndex(m => m.id == musicInfo.id)
  if (index < 0) index = data.list.findIndex(m => normalize(m.name) == normalize(musicInfo.name))
  if (index < 0) return
  const list = [...data.list]
  // the song playing stays the same object
  list[index] = musicInfo
  const name = data.info.name || album.name || albumName
  setPlayingFrom(tempId, 'album', name, { path: '/album', query: { source: album.source, id: album.id, name } })
  await setTempList(tempId, list)
}
