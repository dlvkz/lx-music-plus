import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { playMusicInfo } from '@renderer/store/player/state'
import { playProgress } from '@renderer/store/player/playProgress'
import { recordPlay, handleFmMusicToggled } from '@renderer/core/recommend'
import { getListMusics, addListMusics, updateListMusicsPosition } from '@renderer/store/list/action'

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
      await updateListMusicsPosition({ listId: LIST_IDS.DEFAULT, position: 0, ids: [musicInfo.id] })
    } else {
      await addListMusics(LIST_IDS.DEFAULT, [musicInfo], 'top')
    }
  }

  // listened / skipped songs feed the local recommendations
  const PLAYED_TIME = 30
  let prevMusicInfo: LX.Music.MusicInfo | null = null
  let playedTime = 0
  const stopWatchProgress = watch(() => playProgress.nowPlayTime, time => {
    if (time > playedTime) playedTime = time
  })
  const handleRecordPlay = () => {
    const info = playMusicInfo.musicInfo
    const musicInfo = info ? 'progress' in info ? info.metadata.musicInfo : info : null
    if (prevMusicInfo && prevMusicInfo.id != musicInfo?.id) {
      if (playedTime >= PLAYED_TIME || (playProgress.maxPlayTime > 0 && playedTime >= playProgress.maxPlayTime / 2)) recordPlay(prevMusicInfo, 'play')
      else if (playedTime >= 2) recordPlay(prevMusicInfo, 'skip')
    }
    if (prevMusicInfo?.id != musicInfo?.id) playedTime = 0
    prevMusicInfo = musicInfo
  }

  // a song counts as played once it really starts, not when it is only loaded (e.g. restored on startup)
  let isPending = false
  const handleMusicToggled = () => {
    handleRecordPlay()
    handleFmMusicToggled()
    isPending = true
  }
  const handlePlaying = () => {
    if (!isPending) return
    isPending = false
    const info = playMusicInfo.musicInfo
    // playing the history itself keeps its order, otherwise "next song" would bounce between the two newest songs
    if (!info || playMusicInfo.listId == LIST_IDS.DEFAULT) return
    const musicInfo = 'progress' in info ? info.metadata.musicInfo : info
    task = task.then(async() => record(musicInfo)).catch(err => {
      console.log(err)
    })
  }

  window.app_event.on('musicToggled', handleMusicToggled)
  window.app_event.on('playerPlaying', handlePlaying)
  onBeforeUnmount(() => {
    stopWatchProgress()
    window.app_event.off('musicToggled', handleMusicToggled)
    window.app_event.off('playerPlaying', handlePlaying)
  })
}
