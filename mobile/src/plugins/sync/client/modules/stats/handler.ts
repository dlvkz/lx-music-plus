// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
// The listening stats (utils/listenStats.ts): the logs of the devices are merged (the same play once), there
// is nothing to choose
import log from '../../../log'
import { getListenStatsData, mergeListenStats } from '@/utils/listenStats'
import { registerEvent, unregisterEvent } from './localEvent'

const handler: LX.Sync.ClientSyncHandlerStatsActions<LX.Sync.Socket> = {
  async onStatsSyncAction(socket, data) {
    if (!socket.moduleReadys?.stats) return
    await mergeListenStats(data)
  },

  async stats_sync_get_data() {
    log.info('[stats:sync]get data')
    return getListenStatsData()
  },

  async stats_sync_set_data(socket, data) {
    log.info('[stats:sync]set data')
    await mergeListenStats(data)
  },

  async stats_sync_finished(socket) {
    log.info('[stats:sync]finished')
    socket.moduleReadys.stats = true
    registerEvent(socket)
    socket.onClose(() => {
      unregisterEvent()
    })
  },
}

export default handler
