import { LIST_IDS } from '@common/constants'
import { addListMusics, createUserList, getListMusics } from '@renderer/store/list/action'
import { isCollected, toggleCollection } from '@renderer/store/list/collections'
import { getListDetail, getListDetailAll } from '@renderer/store/songList/action'
import { assertApiSupport } from '@renderer/store/utils'
import { toNewMusicInfo } from '@renderer/utils'
import { resumeImport, setImportEnv, type ImportJob } from '@renderer/utils/libraryImport'
import musicSdk from '@renderer/utils/musicSdk'
// sets the requests of the secondary sources (through node)
import '@renderer/utils/secondaryAudio'

// The import of a library from another platform on desktop (utils/libraryImport.ts): the searches of the main
// sources, the lists and the library of the app; the import running when the app was closed goes on.

const STORAGE_KEY = 'lx_library_import'

const search = async(source: string, text: string) => {
  const result = await musicSdk[source as LX.OnlineSource]?.musicSearch.search(text, 1, 10)
  return ((result?.list ?? []) as any[]).map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
}

setImportEnv({
  search,
  sources: ['wy', 'kw'],
  isSupported: s => assertApiSupport(s as LX.Source),
  albumSources: ['wy', 'kw', 'tx'],
  async getMainPlaylist(source, id) {
    const first = await getListDetail(id, source as LX.OnlineSource, 1)
    const list = await getListDetailAll(id, source as LX.OnlineSource)
    return { name: first.info.name ?? '', img: first.info.img ?? null, list }
  },
  storage: {
    async load() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as ImportJob | null
      } catch {
        return null
      }
    },
    async save(job) {
      if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify(job))
      else localStorage.removeItem(STORAGE_KEY)
    },
  },
  writer: {
    getLoved: async() => getListMusics(LIST_IDS.LOVE),
    addLoved: async list => addListMusics(LIST_IDS.LOVE, list),
    createPlaylist: async(name, list) => createUserList({ name, list }),
    addArtist(name, img) {
      if (!isCollected('artist', undefined, name)) toggleCollection({ type: 'artist', id: name, name, img })
    },
    addAlbum(album) {
      if (!isCollected('album', album.source, album.id)) toggleCollection({ type: 'album', source: album.source, id: album.id, name: album.name, img: album.img })
    },
  },
})

/**
 * The import saved when the app was closed goes on
 */
export const initLibraryImport = () => {
  void resumeImport()
}
