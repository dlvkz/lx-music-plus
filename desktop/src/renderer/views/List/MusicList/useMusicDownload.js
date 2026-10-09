import { ref } from '@common/utils/vueTools'
import { downloadMusics } from '@renderer/store/download/sync'

export default ({ selectedList, list, props }) => {
  const isShowDownload = ref(false)
  const isShowDownloadMultiple = ref(false)
  const musicInfo = ref(null)

  const handleShowDownloadModal = (index, single) => {
    if (selectedList.value.length && !single) {
      isShowDownloadMultiple.value = true
    } else {
      // one song: downloaded at once with the quality of the download settings (or the best one the
      // song has below it), no quality to choose
      downloadMusics([list.value[index]], props.listId)
    }
  }

  return {
    isShowDownload,
    isShowDownloadMultiple,
    selectedDownloadMusicInfo: musicInfo,
    handleShowDownloadModal,
  }
}
