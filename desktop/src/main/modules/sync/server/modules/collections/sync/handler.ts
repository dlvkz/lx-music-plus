// 这个文件导出的方法将暴露给客户端调用，第一个参数固定为当前 socket 对象
import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { mergeRemoteCollectionsData } from '@main/modules/sync/collectionsEvent'

const handler: LX.Sync.ServerSyncHandlerCollectionsActions<LX.Sync.Server.Socket> = {
  // an album / artist collected or removed on a device: merged here, given to the other devices
  async onCollectionsSyncAction(socket, data) {
    if (!socket.moduleReadys.collections) return
    mergeRemoteCollectionsData(data)
    const currentId = socket.keyInfo.clientId
    socket.broadcast((client) => {
      if (client.keyInfo.clientId == currentId || !client.moduleReadys?.collections || client.userInfo.name != socket.userInfo.name) return
      void client.remoteQueueCollections.onCollectionsSyncAction(data).catch(err => {
        client.close(SYNC_CLOSE_CODE.failed)
        console.log(err.message)
      })
    })
  },
}

export default handler
