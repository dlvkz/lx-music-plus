import { updatePlayIndex } from '@/core/player/playInfo'
import { throttleBackgroundTimer } from '@/utils/tools'
import playerState from '@/store/player/state'

const changedListIds = new Set<string | null>()

export default () => {
  const throttleListChange = throttleBackgroundTimer(() => {
    const isSkip = !changedListIds.has(playerState.playInfo.playerListId) && !changedListIds.has(playerState.playMusicInfo.listId)
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

  global.app_event.on('myListMusicUpdate', handleListChange)
  global.app_event.on('downloadListUpdate', handleDownloadListChange)
}
