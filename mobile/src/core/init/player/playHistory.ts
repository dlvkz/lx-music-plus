import { LIST_IDS } from '@/config/constant'
import playerState from '@/store/player/state'
import { getListMusics, addListMusics, updateListMusicPosition } from '@/core/list'
import { recordPlay, handleFmMusicToggled } from '@/core/recommend'

/**
 * The default list is the play history: every played song is put at its top,
 * songs that are already in it are moved back to the top.
 */
export default () => {
  let task = Promise.resolve()

  const record = async(musicInfo: LX.Music.MusicInfo) => {
    const list = await getListMusics(LIST_IDS.DEFAULT)
    if (list[0]?.id == musicInfo.id) return
    if (list.some(m => m.id == musicInfo.id)) {
      await updateListMusicPosition(LIST_IDS.DEFAULT, 0, [musicInfo.id])
    } else {
      await addListMusics(LIST_IDS.DEFAULT, [musicInfo], 'top')
    }
  }

  // a song counts as played once it really starts, not when it is only loaded (e.g. restored on startup)
  let isPending = false

  // listened / skipped songs feed the local recommendations
  const PLAYED_TIME = 30
  let prevMusicInfo: LX.Music.MusicInfo | null = null
  let playedTime = 0
  let duration = 0
  const handleProgress = (progress: { nowPlayTime: number, maxPlayTime: number }) => {
    if (progress.nowPlayTime > playedTime) playedTime = progress.nowPlayTime
    if (progress.maxPlayTime) duration = progress.maxPlayTime
  }
  const handleRecordPlay = () => {
    const info = playerState.playMusicInfo.musicInfo
    const musicInfo = info ? 'progress' in info ? info.metadata.musicInfo : info : null
    if (prevMusicInfo && prevMusicInfo.id != musicInfo?.id) {
      if (playedTime >= PLAYED_TIME || (duration > 0 && playedTime >= duration / 2)) recordPlay(prevMusicInfo, 'play')
      else if (playedTime >= 2) recordPlay(prevMusicInfo, 'skip')
    }
    if (prevMusicInfo?.id != musicInfo?.id) {
      playedTime = 0
      duration = 0
    }
    prevMusicInfo = musicInfo
  }

  const handleMusicToggled = () => {
    handleRecordPlay()
    handleFmMusicToggled()
    isPending = true
  }
  const handlePlaying = () => {
    if (!isPending) return
    isPending = false
    const { musicInfo: info, listId } = playerState.playMusicInfo
    // playing the history itself keeps its order, otherwise "next song" would bounce between the two newest songs
    if (!info || listId == LIST_IDS.DEFAULT) return
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    task = task.then(async() => record(musicInfo)).catch(err => {
      console.log(err)
    })
  }

  global.app_event.on('musicToggled', handleMusicToggled)
  global.app_event.on('playerPlaying', handlePlaying)
  global.state_event.on('playProgressChanged', handleProgress)
}
