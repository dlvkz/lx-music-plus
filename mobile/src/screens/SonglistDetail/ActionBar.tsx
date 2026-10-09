import { memo } from 'react'
import { ActionRow, CollectButton, DownloadButton, PlayButton } from '@/components/common/ActionIcons'
import { downloadMusics, downloadRest, isSyncList, setListSync, useListDownloadState, useDownloadState } from '@/core/download'
import { confirmRemoveDownloads } from '@/core/downloadPrompt'
import { getListDetailAll } from '@/core/songlist'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { toast } from '@/utils/tools'

import { getCollectedListId, handleCollect, handlePlay, useIsCollected } from './listAction'
import songlistState from '@/store/songlist/state'
import { useListInfo } from './state'
// import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

export default memo(() => {
  const info = useListInfo()
  const t = useI18n()
  const isCollected = useIsCollected(info.id, info.source)

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  // A collected playlist is kept downloaded (new songs included) until the button is pressed again,
  // the songs of a playlist that is not collected are downloaded once.
  const collectedListId = getCollectedListId(info.id, info.source)
  useSettingValue('download.syncListIds')
  const isSync = isCollected && isSyncList(collectedListId)
  // a ring around the download button shows how far the downloads of the playlist have gone:
  // all the songs of the collected list, or the loaded songs of the playlist
  const listDownloadState = useListDownloadState(isCollected ? collectedListId : null)
  const pageDownloadState = useDownloadState(songlistState.listDetailInfo.list)
  const downloadState = listDownloadState.taskIds.length ? listDownloadState : pageDownloadState
  const handleDownload = () => {
    if (!songlistState.listDetailInfo.info.name) return
    if (downloadState.taskIds.length || isSync) {
      void confirmRemoveDownloads(songlistState.listDetailInfo.info.name || info.name, downloadState, () => {
        void getListDetailAll(info.source, info.id).then(async list => downloadRest(list)).catch(() => {
          toast(t('list_error'))
        })
      }).then(removed => {
        // it is not kept downloaded any more either
        if (removed && isSync) void setListSync(collectedListId, false)
      })
      return
    }
    if (isCollected) {
      void setListSync(collectedListId, !isSync)
      toast(t(isSync ? 'download__sync_off_tip' : 'download__sync_on_tip'))
      return
    }
    void getListDetailAll(info.source, info.id).then(async list => downloadMusics(list)).then(count => {
      toast(t(count ? 'download__added' : 'download__exists'))
    }).catch(() => {
      toast(t('list_error'))
    })
  }

  const handleCollection = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name, songlistState.listDetailInfo.info.img ?? info.img)
  }

  return (
    <ActionRow
      left={<DownloadButton active={isSync} done={downloadState.done} downloading={downloadState.downloading} progress={downloadState.progress} partial={downloadState.partial} onPress={handleDownload} />}
      right={<>
        <CollectButton collected={isCollected} onPress={handleCollection} />
        <PlayButton onPress={handlePlayAll} />
      </>}
    />
  )
})
