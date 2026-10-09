import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail, getListDetailAll } from '@renderer/store/leaderboard/action'
import useFullListSearch from '@renderer/utils/compositions/useFullListSearch'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'

export default () => {
  const listRef = ref<any>(null)

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.list, index)
  }

  const getList = async(id: string, page: number) => {
    return getAndSetListDetail(id, page).then(() => {
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    }).catch(_ => _)
  }

  // the song search covers the whole chart, not only the page that is shown
  const search = useFullListSearch({
    listRef,
    getKey: () => listDetailInfo.id,
    getPageList: () => listDetailInfo.list,
    getTotal: () => listDetailInfo.total,
    getLimit: () => listDetailInfo.limit,
    loadAll: async() => getListDetailAll(listDetailInfo.id),
    loadPage: async(page) => getList(listDetailInfo.id, page),
  })

  return {
    listRef,
    listDetailInfo,
    getList,
    handlePlayList,
    ...search,
  }
}
