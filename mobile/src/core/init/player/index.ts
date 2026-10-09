import initPlayer from './player'
import initPlayInfo from './playInfo'
import initPlayStatus from './playStatus'
import initPlayerEvent from './playerEvent'
import initWatchList from './watchList'
import initPlayProgress from './playProgress'
import initPreloadNextMusic from './preloadNextMusic'
import initLyric from './lyric'
import initPlayHistory from './playHistory'
import initListenStats from './listenStats'
import initSoundEffect from './soundEffect'
import { initLibraryImport } from '@/core/libraryImport'
import { restoreTempListId } from '@/core/list'
import { updateSetting } from '@/core/common'
import { getData, saveData } from '@/plugins/storage'

const RESUME_FLAG_KEY = '@resume_play_time_v1'

export default async(setting: LX.AppSetting) => {
  // the app resumes where it was (the position of the song too): on once for the installs made when it was off
  if (!await getData(RESUME_FLAG_KEY).catch(() => null)) {
    void saveData(RESUME_FLAG_KEY, true).catch(() => {})
    if (!setting['player.isSavePlayTime']) updateSetting({ 'player.isSavePlayTime': true })
  }
  // (what the temporary list was made from: the radio... before the song played is restored)
  await restoreTempListId()
  await initPlayer(setting)
  await initLyric(setting)
  await initPlayInfo(setting)
  initPlayStatus()
  initPlayerEvent()
  initWatchList()
  initPlayProgress()
  initPreloadNextMusic()
  initPlayHistory()
  initListenStats()
  initSoundEffect()
  // an import of another platform that was running when the app was closed goes on (after the start)
  setTimeout(() => { initLibraryImport() }, 8000)
}
