import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { registerStatsChangedEvent } from '@main/modules/sync/statsEvent'

let unregisterLocalAction: (() => void) | null

// the plays recorded on this device are sent to the server (which gives them to the other devices)
export const registerEvent = (socket: LX.Sync.Client.Socket) => {
  unregisterEvent()
  unregisterLocalAction = registerStatsChangedEvent((delta) => {
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
