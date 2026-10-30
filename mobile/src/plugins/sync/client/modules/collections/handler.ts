// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
// The collected albums and artists (core/collect.ts): the latest change of each one wins (a removal too), there is
// nothing to choose
import log from '../../../log'
import { getCollectionsSyncData, mergeCollectionsSyncData } from '@/core/collect'
import { registerEvent, unregisterEvent } from './localEvent'

const handler: LX.Sync.ClientSyncHandlerCollectionsActions<LX.Sync.Socket> = {
  async onCollectionsSyncAction(socket, data) {
    if (!socket.moduleReadys?.collections) return
    await mergeCollectionsSyncData(data)
  },

  async collections_sync_get_data() {
    log.info('[collections:sync]get data')
    return getCollectionsSyncData()
  },

  async collections_sync_set_data(socket, data) {
    log.info('[collections:sync]set data')
    await mergeCollectionsSyncData(data)
  },

  async collections_sync_finished(socket) {
    log.info('[collections:sync]finished')
    socket.moduleReadys.collections = true
    registerEvent(socket)
    socket.onClose(() => {
      unregisterEvent()
    })
  },
}

export default handler
