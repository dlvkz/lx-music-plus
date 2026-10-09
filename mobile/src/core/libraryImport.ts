import { LIST_IDS } from '@/config/constant'
import { isCollected, toggleCollection } from '@/core/collect'
import { addListMusics, createList, getListMusics } from '@/core/list'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { getData, removeData, saveData } from '@/plugins/storage'
import settingState from '@/store/setting/state'
import { deduplicationList, toNewMusicInfo } from '@/utils'
import { resumeImport, setImportEnv, type ImportJob } from '@/utils/libraryImport'
import musicSdk from '@/utils/musicSdk'
import { assertApiSupport } from '@/utils/tools'
// sets the yt-dlp of the YouTube source
import '@/core/music/secondary'

// The import of a library from another platform on mobile (utils/libraryImport.ts): the searches of the main
// sources, the lists and the library of the app; the import running when the app was closed goes on.

const STORAGE_KEY = '@library_import'

const search = async(source: string, text: string) => {
  const result = await (musicSdk as any)[source]?.musicSearch.search(text, 1, 10)
  return deduplicationList(((result?.list ?? []) as any[]).map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[])
}

setImportEnv({
  search,
  sources: ['wy', 'kw'],
  isSupported: s => assertApiSupport(s as LX.Source),
  albumSources: ['wy', 'kw', 'tx'],
  async getMainPlaylist(source, id) {
    const first = await getListDetail(id, source as LX.OnlineSource, 1)
    const list = await getListDetailAll(source as LX.OnlineSource, id)
    return { name: first.info.name ?? '', img: first.info.img ?? null, list }
  },
  storage: {
    load: async() => getData<ImportJob>(STORAGE_KEY),
    async save(job) {
      if (job) await saveData(STORAGE_KEY, job)
      else await removeData(STORAGE_KEY)
    },
  },
  writer: {
    getLoved: async() => getListMusics(LIST_IDS.LOVE),
    addLoved: async list => addListMusics(LIST_IDS.LOVE, list, settingState.setting['list.addMusicLocationType']),
    createPlaylist: async(name, list) => createList({ name, list }),
    addArtist(name, img) {
      if (!isCollected('artist', undefined, name)) toggleCollection({ type: 'artist', id: name, name, img })
    },
    addAlbum(album) {
      if (!isCollected('album', album.source, album.id)) toggleCollection({ type: 'album', source: album.source as LX.OnlineSource, id: album.id, name: album.name, img: album.img })
    },
  },
})

/**
 * The import saved when the app was closed goes on
 */
export const initLibraryImport = () => {
  void resumeImport()
}
