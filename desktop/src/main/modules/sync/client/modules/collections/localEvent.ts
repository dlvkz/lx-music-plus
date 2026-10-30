import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { registerCollectionsChangedEvent } from '@main/modules/sync/collectionsEvent'

let unregisterLocalAction: (() => void) | null

// an album / artist collected or removed here: the collection is sent to the server (which gives it to the other
// devices)
export const registerEvent = (socket: LX.Sync.Client.Socket) => {
  unregisterEvent()
  unregisterLocalAction = registerCollectionsChangedEvent((data) => {
    if (!socket.moduleReadys?.collections) return
    void socket.remoteQueueCollections.onCollectionsSyncAction(data).catch(err => {
      socket.moduleReadys.collections = false
      socket.close(SYNC_CLOSE_CODE.failed)
      console.log(err.message)
    })
  })
}

export const unregisterEvent = () => {
  unregisterLocalAction?.()
  unregisterLocalAction = null
}
