// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
// The listening stats: the logs of the devices are merged (the same play once), there is nothing to choose
import { getLocalStatsData, mergeRemoteStatsData } from '@main/modules/sync/statsEvent'
import { registerEvent, unregisterEvent } from './localEvent'

const handler: LX.Sync.ClientSyncHandlerStatsActions<LX.Sync.Client.Socket> = {
  async onStatsSyncAction(socket, data) {
    if (!socket.moduleReadys?.stats) return
    mergeRemoteStatsData(data)
  },

  async stats_sync_get_data() {
    return getLocalStatsData()
  },

  async stats_sync_set_data(socket, data) {
    mergeRemoteStatsData(data)
  },

  async stats_sync_finished(socket) {
    socket.moduleReadys.stats = true
    registerEvent(socket)
    socket.onClose(() => {
      unregisterEvent()
    })
  },
}

export default handler
