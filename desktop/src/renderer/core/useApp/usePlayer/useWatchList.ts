import { onBeforeUnmount } from '@common/utils/vueTools'

import { playInfo, playMusicInfo } from '@renderer/store/player/state'
import { updatePlayIndex } from '@renderer/store/player/action'
import { throttle } from '@common/utils'

const changedListIds = new Set<string | null>()

export default () => {
  const throttleListChange = throttle(() => {
    const isSkip = playMusicInfo.listId && !changedListIds.has(playInfo.playerListId) && !changedListIds.has(playMusicInfo.listId)
    changedListIds.clear()
    if (isSkip) return

    // The song being played may have been removed from its list (unliked, deleted...): it keeps
    // playing, the play position is moved so that the next song is the one that followed it.
    updatePlayIndex()
  })

  const handleListChange = (listIds: string[]) => {
    for (const id of listIds) {
      changedListIds.add(id)
    }
    throttleListChange()
  }

  const handleDownloadListChange = () => {
    handleListChange(['download'])
  }

  window.app_event.on('myListUpdate', handleListChange)
  window.app_event.on('downloadListUpdate', handleDownloadListChange)

  onBeforeUnmount(() => {
    window.app_event.off('myListUpdate', handleListChange)
    window.app_event.off('downloadListUpdate', handleDownloadListChange)
  })
}
