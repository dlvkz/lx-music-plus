// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
// The collected albums and artists: the latest change of each one wins (a removal too), there is nothing to choose
import { getLocalCollectionsData, mergeRemoteCollectionsData } from '@main/modules/sync/collectionsEvent'
import { registerEvent, unregisterEvent } from './localEvent'

const handler: LX.Sync.ClientSyncHandlerCollectionsActions<LX.Sync.Client.Socket> = {
  async onCollectionsSyncAction(socket, data) {
    if (!socket.moduleReadys?.collections) return
    mergeRemoteCollectionsData(data)
  },

  async collections_sync_get_data() {
    return getLocalCollectionsData()
  },

  async collections_sync_set_data(socket, data) {
    mergeRemoteCollectionsData(data)
  },

  async collections_sync_finished(socket) {
    socket.moduleReadys.collections = true
    registerEvent(socket)
    socket.onClose(() => {
      unregisterEvent()
    })
  },
}

export default handler
