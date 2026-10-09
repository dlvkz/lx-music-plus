import { SYNC_CLOSE_CODE } from '@common/constants_sync'
import { mergeLocalStatsData } from '@main/modules/sync/statsEvent'

// The listening stats: the logs of the devices are merged (the same play once), there is nothing to choose.
// The device gets the log of this one merged with its own, the other devices get its plays.
export const sync = async(socket: LX.Sync.Server.Socket) => {
  const remoteData = await socket.remoteQueueStats.stats_sync_get_data()
  const mergedData = await mergeLocalStatsData(remoteData)
  await socket.remoteQueueStats.stats_sync_set_data(mergedData)
  const currentId = socket.keyInfo.clientId
  socket.broadcast((client) => {
    if (client.keyInfo.clientId == currentId || !client.moduleReadys?.stats || client.userInfo.name != socket.userInfo.name) return
    void client.remoteQueueStats.onStatsSyncAction(remoteData).catch(err => {
      client.close(SYNC_CLOSE_CODE.failed)
      console.log(err.message)
    })
  })
  await socket.remoteQueueStats.stats_sync_finished()
  socket.moduleReadys.stats = true
}
