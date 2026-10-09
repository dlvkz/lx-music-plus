import { normalizeArtistName } from '@/utils/artistName'
import { getCachedTranslation, needsTranslation, translateText } from '@/utils/translate'
import { Navigation } from 'react-native-navigation'
import commonState from '@/store/common/state'
import { showThemedDialog, toast } from '@/utils/tools'
import { type CollectionInfo } from '@/screens/Collection/data'
import { navigations } from '@/navigation'
import { setActiveList } from '@/core/list'
import { setNavActiveId } from '@/core/common'
import { type PlayingFromTarget } from '@/core/playingFrom'
import { getSecondarySongAlbum, isSecondarySource } from '@/utils/secondarySources'

// Links from a song to its artist / album page

const SPLIT_RXP = /\s*(?:、|&|;|；|\/|,|，|\|)\s*/
// sources that have an album page (utils/musicSdk/{source}/singer.js getAlbumDetail)
const ALBUM_SOURCES: LX.Source[] = ['kw', 'wy']

// the screen that is on top, new pages are pushed from it
const SCREEN_NAME_RXP = /^lxm\.\w+Screen$/
let topComponentId: string | null = null
Navigation.events().registerComponentDidAppearListener(({ componentId, componentName }) => {
  if (SCREEN_NAME_RXP.test(componentName)) topComponentId = componentId
})
const getTopComponentId = () => topComponentId ?? commonState.componentIds.home!

// set by the navigation (it imports the screens, which import this module)
let collectionPusher: ((componentId: string, info: CollectionInfo) => void) | null = null
export const setCollectionPusher = (pusher: typeof collectionPusher) => {
  collectionPusher = pusher
}
const pushCollection = (info: CollectionInfo) => {
  collectionPusher?.(getTopComponentId(), info)
}

export const getArtistNames = (musicInfo: LX.Music.MusicInfo) => {
  return (musicInfo.singer ?? '').split(SPLIT_RXP).map(n => n.trim()).filter(n => n)
}

// the secondary sources whose songs have an album page (found when it is opened: getSecondarySongAlbum)
const SECONDARY_ALBUM_SOURCES = ['sc', 'bc', 'kh']

export const hasAlbumPage = (musicInfo: LX.Music.MusicInfo) => {
  if (SECONDARY_ALBUM_SOURCES.includes(musicInfo.source)) return true
  return ALBUM_SOURCES.includes(musicInfo.source) && !!musicInfo.meta.albumName && !!(musicInfo.meta as LX.Music.MusicInfoMeta_online).albumId
}

/**
 * Open the artist page of a song, asks which artist when there are several
 */
export const openArtist = async(musicInfo: LX.Music.MusicInfo) => {
  const names = getArtistNames(musicInfo)
  if (!names.length) return
  let name: string | null = names[0]
  if (names.length > 1) {
    const artists = names.slice(0, 8)
    // the names are followed by their translation, not waited for long
    const translations = await Promise.race([
      Promise.all(artists.map(async name => needsTranslation(name) ? translateText(name).catch(() => null) : null)),
      new Promise<null>(resolve => setTimeout(() => { resolve(null) }, 1500)),
    ])
    name = await showThemedDialog({
      title: global.i18n.t('music_link_artist'),
      vertical: true,
      buttons: artists.map((name, index) => {
        const translation = translations?.[index] ?? getCachedTranslation(name)
        return { text: translation && translation.toLowerCase() != name.toLowerCase() ? `${name}  (${translation})` : name, value: name }
      }),
    })
  }
  // "NewJeans (뉴진스)" and "NewJeans" are the same page
  if (name) pushCollection({ type: 'artist', name: normalizeArtistName(name), fromSource: musicInfo.source })
}

/**
 * Open the page the songs playing come from (core/playingFrom.ts: tapped in the player / the queue); the pages of
 * the library are tabs: the player is closed first (`closePlayer`)
 */
export const openPlayingFrom = (target: PlayingFromTarget, closePlayer: () => void) => {
  switch (target.kind) {
    case 'collection':
      pushCollection(target.info)
      break
    case 'songlist':
      navigations.pushSonglistDetailScreen(getTopComponentId(), { id: target.id, source: target.source as LX.OnlineSource, name: target.name, author: '', img: undefined, desc: undefined, play_count: undefined })
      break
    case 'list':
    case 'library':
      closePlayer()
      if (target.kind == 'list') setActiveList(target.id)
      setNavActiveId('nav_love')
      // (the library page may not be created yet)
      setTimeout(() => {
        if (target.kind == 'list') global.app_event.libraryListRequested()
        else global.app_event.libraryViewRequested(target.view)
      }, 100)
      break
  }
}

/**
 * Open the page of one of the artists of a song (a name tapped in the queue)
 */
export const openArtistName = (name: string, musicInfo: LX.Music.MusicInfo) => {
  pushCollection({ type: 'artist', name: normalizeArtistName(name), fromSource: musicInfo.source })
}

export const openAlbum = async(musicInfo: LX.Music.MusicInfo) => {
  // a song of a secondary source: its album is looked for, its artist page when it has none (a single...)
  if (isSecondarySource(musicInfo.source)) {
    const album = await getSecondarySongAlbum(musicInfo).catch((err: unknown) => {
      console.log(err)
      return null
    })
    if (album) pushCollection({ type: 'album', source: album.source as LX.OnlineSource, id: album.id, name: album.name, img: musicInfo.meta.picUrl })
    else await openArtist(musicInfo)
    return
  }
  if (!hasAlbumPage(musicInfo)) {
    toast(global.i18n.t('music_link_no_album'))
    return
  }
  const meta = musicInfo.meta as LX.Music.MusicInfoMeta_online
  pushCollection({
    type: 'album',
    source: musicInfo.source as LX.OnlineSource,
    id: String(meta.albumId),
    name: meta.albumName,
    img: meta.picUrl,
  })
}
