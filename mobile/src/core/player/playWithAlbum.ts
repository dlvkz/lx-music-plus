import { LIST_IDS } from '@/config/constant'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { setPlayingFrom } from '@/core/playingFrom'
import { hasAlbumPage } from '@/core/musicLinks'
import { loadCollection, type CollectionInfo } from '@/screens/Collection/data'
import { getSecondarySongAlbum, isSecondarySource } from '@/utils/secondarySources'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'

type Music = LX.Music.MusicInfoOnline

const normalize = (text: string | null | undefined) => (text ?? '').trim().toLowerCase()

// the album of a song (a secondary source: looked for, a single may have none)
const findAlbum = async(musicInfo: Music): Promise<CollectionInfo | null> => {
  if (isSecondarySource(musicInfo.source)) {
    const album = await getSecondarySongAlbum(musicInfo)
    return album ? { type: 'album', source: album.source as LX.OnlineSource, id: album.id, name: album.name, img: musicInfo.meta.picUrl } : null
  }
  if (!hasAlbumPage(musicInfo)) return null
  const meta = musicInfo.meta as LX.Music.MusicInfoMeta_online
  return { type: 'album', source: musicInfo.source as LX.OnlineSource, id: String(meta.albumId), name: meta.albumName, img: meta.picUrl }
}

/**
 * A song of the search: played at once, then the songs of its album are put around it, so the album carries on after
 * it. A single, or a song without album: the queue is only that song
 */
export const playWithAlbum = async(musicInfo: Music) => {
  const tempId = `collection_album_song_${musicInfo.id}`
  const albumName = musicInfo.meta.albumName ?? ''
  setPlayingFrom(tempId, 'album', albumName || musicInfo.name)
  await setTempList(tempId, [musicInfo])
  await playList(LIST_IDS.TEMP, 0)

  const info = await findAlbum(musicInfo).catch((err: unknown) => {
    console.log(err)
    return null
  })
  if (!info) return
  const data = await loadCollection(info).catch((err: unknown) => {
    console.log(err)
    return null
  })
  if (!data || data.list.length < 2) return
  // another song or list may have been played meanwhile
  if (listState.tempListMeta.id != tempId || playerState.playMusicInfo.listId != LIST_IDS.TEMP) return
  let index = data.list.findIndex(m => m.id == musicInfo.id)
  if (index < 0) index = data.list.findIndex(m => normalize(m.name) == normalize(musicInfo.name))
  if (index < 0) return
  const list = [...data.list]
  // the song playing stays the same object
  list[index] = musicInfo
  setPlayingFrom(tempId, 'album', data.title || albumName, { kind: 'collection', info })
  await setTempList(tempId, list)
}
