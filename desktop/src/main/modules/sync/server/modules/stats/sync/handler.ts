// 这个文件导出的方法将暴露给客户端调用，第一个参数固定为当前 socket 对象
import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { mergeRemoteStatsData } from '@main/modules/sync/statsEvent'

const handler: LX.Sync.ServerSyncHandlerStatsActions<LX.Sync.Server.Socket> = {
  // the plays recorded by a device: merged here, given to the other devices
  async onStatsSyncAction(socket, data) {
    if (!socket.moduleReadys.stats) return
    mergeRemoteStatsData(data)
    const currentId = socket.keyInfo.clientId
    socket.broadcast((client) => {
      if (client.keyInfo.clientId == currentId || !client.moduleReadys?.stats || client.userInfo.name != socket.userInfo.name) return
      void client.remoteQueueStats.onStatsSyncAction(data).catch(err => {
        client.close(SYNC_CLOSE_CODE.failed)
        console.log(err.message)
      })
    })
  },
}

export default handler
