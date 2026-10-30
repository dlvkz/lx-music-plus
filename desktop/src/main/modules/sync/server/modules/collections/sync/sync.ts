import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { mergeLocalCollectionsData } from '@main/modules/sync/collectionsEvent'

// The collected albums and artists: the latest change of each one wins (a removal too), there is nothing to choose.
// The device gets the collection of this one merged with its own, the other devices get its collection.
export const sync = async(socket: LX.Sync.Server.Socket) => {
  const remoteData = await socket.remoteQueueCollections.collections_sync_get_data()
  const mergedData = await mergeLocalCollectionsData(remoteData)
  await socket.remoteQueueCollections.collections_sync_set_data(mergedData)
  const currentId = socket.keyInfo.clientId
  socket.broadcast((client) => {
    if (client.keyInfo.clientId == currentId || !client.moduleReadys?.collections || client.userInfo.name != socket.userInfo.name) return
    void client.remoteQueueCollections.onCollectionsSyncAction(remoteData).catch(err => {
      client.close(SYNC_CLOSE_CODE.failed)
      console.log(err.message)
    })
  })
  await socket.remoteQueueCollections.collections_sync_finished()
  socket.moduleReadys.collections = true
}
