import { ref } from '@common/utils/vueTools'
import { playWithAlbum } from '@renderer/core/player/playWithAlbum'
import { addHistoryWord } from '@renderer/store/search/action'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { search as searchMusic, listInfos, type ListInfo } from '@renderer/store/search/music'
import { assertApiSupport } from '@renderer/store/utils'

export type SearchSource = LX.OnlineSource | 'all'

// the last search: coming back to the search page shows its results as they were (like mobile),
// it is done again only when something changed or it is asked again (search button / enter)
let lastSearch = ''

export default () => {
  const listRef = ref<any>(null)

  const listInfo = ref<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  })

  const search = (text: string, source: SearchSource, page: number, isRefresh = false) => {
    listInfo.value = listInfos[source] as ListInfo
    const searchKey = `${source}__${page}__${text}`
    if (!isRefresh && searchKey == lastSearch && listInfo.value.list.length) return
    lastSearch = searchKey
    if (text.length) void addHistoryWord(text)
    void searchMusic(text, page, source).then((list: LX.Music.MusicInfo[]) => {
      if (list.length) {
        setTimeout(() => {
          if (listRef.value) listRef.value.scrollToTop()
        })
      }
    })
  }

  // a song of the search plays with its album after it (a single: on its own), not in the play history
  const handlePlayList = async(index: number) => {
    const targetSong = listInfo.value.list[index]
    if (!targetSong || !assertApiSupport(targetSong.source)) return
    await playWithAlbum(targetSong as LX.Music.MusicInfoOnline)
  }

  return {
    listRef,
    listInfo,
    search,
    handlePlayList,
  }
}
