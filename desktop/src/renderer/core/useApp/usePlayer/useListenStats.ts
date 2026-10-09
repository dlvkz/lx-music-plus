import fs from 'fs'
import path from 'path'
import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { isPlay, playMusicInfo } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import { getThemes } from '@renderer/store/utils'
import { flushListening, mergeListenStats, onListenStatsChanged, recordListening, setListenStatsStorage } from '@renderer/utils/listenStats'
import { onSyncAction, sendSyncAction } from '@renderer/utils/ipc'
import { setLastfmEnv, trackListening } from '@renderer/utils/lastfm'
import { appSetting } from '@renderer/store/setting'
import { toMD5 } from '@common/utils/nodejs'
import { initAddons } from '@renderer/utils/sourceAddons'

// the listening stats (utils/listenStats.ts, the Stats page): the time the player really plays is recorded
const TICK = 5000

// the file of the log: in the data folder of the app (the folder of the pictures of the themes is in it)
const getStatsFile = async() => new Promise<string>(resolve => {
  getThemes(info => {
    resolve(path.join(path.dirname(info.dataPath), 'listen_stats.json'))
  })
})

export default () => {
  // Last.fm (the scrobbles, the recommendations): its settings
  setLastfmEnv(() => ({
    apiKey: appSetting['lastfm.apiKey'],
    apiSecret: appSetting['lastfm.apiSecret'],
    sessionKey: appSetting['lastfm.sessionKey'],
    scrobble: appSetting['lastfm.scrobble'],
  }), toMD5)

  // the source addons installed (utils/sourceAddons.ts): next to the stats
  void initAddons({
    async load() {
      return fs.promises.readFile(path.join(path.dirname(await getStatsFile()), 'source_addons.json'), 'utf8').catch(() => null)
    },
    async save(data) {
      const file = path.join(path.dirname(await getStatsFile()), 'source_addons.json')
      await fs.promises.writeFile(`${file}.tmp`, data)
      await fs.promises.rename(`${file}.tmp`, file)
    },
  })

  setListenStatsStorage({
    async load() {
      return fs.promises.readFile(await getStatsFile(), 'utf8').catch(() => null)
    },
    async save(data) {
      const file = await getStatsFile()
      // the whole file only
      await fs.promises.writeFile(`${file}.tmp`, data)
      await fs.promises.rename(`${file}.tmp`, file)
    },
  })

  let last = Date.now()
  const record = () => {
    const now = Date.now()
    const elapsed = Math.min(now - last, TICK * 2)
    last = now
    const info = playMusicInfo.musicInfo
    // a song played from the downloads is a download task that wraps the song
    const musicInfo = info ? 'progress' in info ? info.metadata.musicInfo : info : null
    if (!musicInfo || elapsed <= 0) return
    void recordListening(musicInfo, elapsed, playProgress.nowPlayTime)
    trackListening(musicInfo, elapsed, playProgress.nowPlayTime, playProgress.maxPlayTime)
  }

  const timer = setInterval(() => {
    if (isPlay.value) record()
  }, TICK)
  const stopWatch = watch(isPlay, (playing, wasPlaying) => {
    if (playing) {
      last = Date.now()
      return
    }
    // paused / stopped: the time since the last record, the log saved
    if (wasPlaying) record()
    void flushListening()
  })
  const handleUnload = () => {
    if (isPlay.value) record()
    void flushListening()
  }
  window.addEventListener('beforeunload', handleUnload)

  // the sync (main: modules/sync/statsEvent): the plays of the other devices are merged into the log, the ones
  // recorded here are given to the other devices
  const removeSyncListener = onSyncAction(({ params: action }) => {
    if (action.action == 'stats_merge') void mergeListenStats(action.data)
  })
  const removeChangedListener = onListenStatsChanged((delta) => {
    void sendSyncAction({ action: 'stats_changed', data: delta })
  })

  onBeforeUnmount(() => {
    clearInterval(timer)
    stopWatch()
    window.removeEventListener('beforeunload', handleUnload)
    removeSyncListener()
    removeChangedListener()
  })
}
