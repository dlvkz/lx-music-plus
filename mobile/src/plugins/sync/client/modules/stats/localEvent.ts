import { SYNC_CLOSE_CODE } from '@/plugins/sync/constants'
import { onListenStatsChanged } from '@/utils/listenStats'

let unregisterLocalAction: (() => void) | null

// the plays recorded here are sent to the server (which gives them to the other devices)
export const registerEvent = (socket: LX.Sync.Socket) => {
  unregisterEvent()
  unregisterLocalAction = onListenStatsChanged((delta) => {
    if (!socket.moduleReadys?.stats) return
    void socket.remoteQueueStats.onStatsSyncAction(delta).catch(err => {
      socket.moduleReadys.stats = false
      socket.close(SYNC_CLOSE_CODE.failed)
      console.log(err.message)
    })
  })
}

export const unregisterEvent = () => {
  unregisterLocalAction?.()
  unregisterLocalAction = null
}
