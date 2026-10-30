import { SYNC_CLOSE_CODE } from '@/plugins/sync/constants'
import { getCollectionsSyncData, onCollectionsChanged } from '@/core/collect'

let unregisterLocalAction: (() => void) | null

// an album / artist collected or removed here: the collection is sent to the server (which gives it to the other
// devices)
export const registerEvent = (socket: LX.Sync.Socket) => {
  unregisterEvent()
  unregisterLocalAction = onCollectionsChanged(() => {
    if (!socket.moduleReadys?.collections) return
    void getCollectionsSyncData().then(async data => socket.remoteQueueCollections.onCollectionsSyncAction(data)).catch(err => {
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
