import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail, getListDetailAll } from '@renderer/store/songList/action'
import useFullListSearch from '@renderer/utils/compositions/useFullListSearch'
import { listDetailInfo } from '@renderer/store/songList/state'
import { playSongListDetail } from './action'

export default () => {
  const listRef = ref<any>(null)

  const getListData = async(source: LX.OnlineSource, id: string, page: number, refresh: boolean) => {
    await getAndSetListDetail(id, source, page, refresh).then(() => {
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    })
  }

  // the song search covers the whole playlist, not only the page that is shown
  const search = useFullListSearch({
    listRef,
    getKey: () => `${listDetailInfo.source}__${listDetailInfo.id}`,
    getPageList: () => listDetailInfo.list,
    getTotal: () => listDetailInfo.total,
    getLimit: () => listDetailInfo.limit,
    loadAll: async() => getListDetailAll(listDetailInfo.id, listDetailInfo.source),
    loadPage: async(page) => getListData(listDetailInfo.source, listDetailInfo.id, page, false).catch(_ => _),
  })

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index)
  }


  return {
    listRef,
    listDetailInfo,
    getListData,
    handlePlayList,
    ...search,
  }
}
