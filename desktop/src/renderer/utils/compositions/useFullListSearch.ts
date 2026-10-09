import { shallowRef, watch, nextTick, type Ref } from '@common/utils/vueTools'

/**
 * Song search of a list that is shown page by page: the search covers every song of the list,
 * not only the page that is shown. The whole list is loaded when the search is opened,
 * a song picked on another page makes its page the shown one.
 *
 * Used with material/OnlineList: `:search-list="allSongs" @search-visible @search-select`
 */
export default ({ listRef, getKey, getPageList, getTotal, getLimit, loadAll, loadPage }: {
  listRef: Ref<any>
  /** identifies the list, the loaded songs are dropped when it changes */
  getKey: () => string
  getPageList: () => LX.Music.MusicInfoOnline[]
  getTotal: () => number
  getLimit: () => number
  loadAll: () => Promise<LX.Music.MusicInfoOnline[]>
  loadPage: (page: number) => Promise<unknown>
}) => {
  const allSongs = shallowRef<LX.Music.MusicInfoOnline[] | null>(null)
  let loadedKey: string | null = null

  watch(getKey, () => {
    allSongs.value = null
    loadedKey = null
  })

  const handleSearchVisible = async(visible: boolean) => {
    const key = getKey()
    if (!visible || !key || loadedKey == key) return
    // everything is on the page already
    if (getTotal() <= getLimit()) return
    loadedKey = key
    try {
      const list = await loadAll()
      if (getKey() == key && list.length) allSongs.value = list
    } catch (err) {
      console.log(err)
      // eslint-disable-next-line require-atomic-updates
      if (loadedKey == key) loadedKey = null
    }
  }

  const handleSearchSelect = async({ musicInfo, isPlay }: { musicInfo: LX.Music.MusicInfoOnline, isPlay: boolean }) => {
    const list = allSongs.value
    if (!list) return
    const index = list.findIndex(m => m.id == musicInfo.id)
    if (index < 0) return
    await loadPage(Math.floor(index / getLimit()) + 1)
    await nextTick()
    // the pages scroll back to their top after they are loaded
    setTimeout(() => {
      const pageIndex = getPageList().findIndex(m => m.id == musicInfo.id)
      if (pageIndex > -1) listRef.value?.showMusic(pageIndex, isPlay)
    }, 80)
  }

  return {
    allSongs,
    handleSearchVisible,
    handleSearchSelect,
  }
}
