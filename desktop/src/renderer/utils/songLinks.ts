import type { Router } from 'vue-router'
import { normalizeArtistName } from './artistName'
import { getSecondarySongAlbum } from './secondarySources'
// sets the requests of the secondary sources (through node)
import './secondaryAudio'

/**
 * Open the album of a song of a secondary source (SoundCloud, Bandcamp, KHInsider), found when it is asked for;
 * its artist page when it has none (a single, YouTube...)
 */
export const openSecondarySongAlbum = async(router: Router, musicInfo: LX.Music.MusicInfo) => {
  const album = await getSecondarySongAlbum(musicInfo).catch((err: unknown) => {
    console.log(err)
    return null
  })
  if (album) {
    await router.push({ path: '/album', query: { source: album.source, id: album.id, name: album.name } })
    return
  }
  const name = normalizeArtistName((musicInfo.singer ?? '').split(/[、&/,，]/)[0]?.trim() ?? '')
  if (name) await router.push({ path: '/artist', query: { name, source: musicInfo.source } })
}
