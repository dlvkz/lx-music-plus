import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import { existsFile, moveFile, privateStorageDirectoryPath, readFile, unlink, writeFile } from '@/utils/fs'
import { flushListening, recordListening, setListenStatsStorage } from '@/utils/listenStats'
import { setLastfmEnv, trackListening } from '@/utils/lastfm'
import settingState from '@/store/setting/state'
import { toMD5 } from '@/utils/tools'
import { initAddons } from '@/utils/sourceAddons'

// the listening stats (utils/listenStats.ts, the Stats page of the library): the time the player really plays
// is recorded (a background timer: it goes on with the screen off)
const TICK = 5000
const STATS_FILE = `${privateStorageDirectoryPath}/listen_stats.json`
// the source addons installed (utils/sourceAddons.ts)
const ADDONS_FILE = `${privateStorageDirectoryPath}/source_addons.json`

const saveFile = async(file: string, data: string) => {
  // the whole file only
  const temp = `${file}.tmp`
  await writeFile(temp, data, 'utf8')
  if (await existsFile(file)) await unlink(file)
  await moveFile(temp, file)
}

export default () => {
  // Last.fm (the scrobbles, the recommendations): its settings
  setLastfmEnv(() => ({
    apiKey: settingState.setting['lastfm.apiKey'],
    apiSecret: settingState.setting['lastfm.apiSecret'],
    sessionKey: settingState.setting['lastfm.sessionKey'],
    scrobble: settingState.setting['lastfm.scrobble'],
  }), toMD5)

  setListenStatsStorage({
    async load() {
      if (!await existsFile(STATS_FILE)) return null
      return readFile(STATS_FILE, 'utf8')
    },
    async save(data) {
      await saveFile(STATS_FILE, data)
    },
  })

  void initAddons({
    async load() {
      if (!await existsFile(ADDONS_FILE)) return null
      return readFile(ADDONS_FILE, 'utf8')
    },
    async save(data) {
      await saveFile(ADDONS_FILE, data)
    },
  })

  let last = Date.now()
  const record = () => {
    const now = Date.now()
    const elapsed = Math.min(now - last, TICK * 2)
    last = now
    const info = playerState.playMusicInfo.musicInfo
    // a song played from the downloads is a download task that wraps the song
    const musicInfo = info ? 'progress' in info ? info.metadata.musicInfo : info : null
    if (!musicInfo || elapsed <= 0) return
    void recordListening(musicInfo, elapsed, playerState.progress.nowPlayTime)
    trackListening(musicInfo, elapsed, playerState.progress.nowPlayTime, playerState.progress.maxPlayTime)
  }

  BackgroundTimer.setInterval(() => {
    if (playerState.isPlay) record()
  }, TICK)

  let wasPlaying = playerState.isPlay
  global.state_event.on('playStateChanged', (playing) => {
    if (playing) last = Date.now()
    // paused / stopped: the time since the last record, the log saved
    else if (wasPlaying) {
      record()
      void flushListening()
    }
    wasPlaying = playing
  })
}
