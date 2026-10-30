import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { registerCollectionsChangedEvent } from '@main/modules/sync/collectionsEvent'

let unregisterLocalAction: (() => void) | null

// an album / artist collected or removed on this device: the collection is given to the devices connected
export const registerEvent = (wss: LX.Sync.Server.SocketServer) => {
  unregisterEvent()
  unregisterLocalAction = registerCollectionsChangedEvent((data) => {
    for (const client of wss.clients) {
      if (!client.moduleReadys?.collections) continue
      void client.remoteQueueCollections.onCollectionsSyncAction(data).catch(err => {
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
