import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { registerStatsChangedEvent } from '@main/modules/sync/statsEvent'

let unregisterLocalAction: (() => void) | null

// the plays recorded on this device are given to the devices connected
export const registerEvent = (wss: LX.Sync.Server.SocketServer) => {
  unregisterEvent()
  unregisterLocalAction = registerStatsChangedEvent((delta) => {
    for (const client of wss.clients) {
      if (!client.moduleReadys?.stats) continue
      void client.remoteQueueStats.onStatsSyncAction(delta).catch(err => {
        client.close(SYNC_CLOSE_CODE.failed)
        console.log(err.message)
      })
    }
  })
}

export const unregisterEvent = () => {
  unregisterLocalAction?.()
  unregisterLocalAction = null
}
