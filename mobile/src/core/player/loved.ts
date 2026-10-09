import { useEffect, useState } from 'react'
import { LIST_IDS } from '@/config/constant'
import playerState from '@/store/player/state'
import { getListMusics } from '@/core/list'
import { collectMusic, uncollectMusic } from './player'

export const getPlayingMusicInfo = () => {
  const info = playerState.playMusicInfo.musicInfo
  if (!info) return null
  return 'progress' in info ? info.metadata.musicInfo : info
}

/**
 * Whether the playing song is in the loved list
 * @param id id of the playing song, the state is checked again when it changes
 */
export const useIsLoved = (id: string | null) => {
  const [isLoved, setLoved] = useState(false)
  useEffect(() => {
    let isUnmounted = false
    const check = () => {
      const musicId = getPlayingMusicInfo()?.id
      void getListMusics(LIST_IDS.LOVE).then(list => {
        if (!isUnmounted) setLoved(!!musicId && list.some(m => m.id == musicId))
      })
    }
    const handleUpdate = (ids: string[]) => {
      if (ids.includes(LIST_IDS.LOVE)) check()
    }
    check()
    global.app_event.on('myListMusicUpdate', handleUpdate)
    return () => {
      isUnmounted = true
      global.app_event.off('myListMusicUpdate', handleUpdate)
    }
  }, [id])
  return isLoved
}

export const toggleLoved = (isLoved: boolean) => {
  if (isLoved) uncollectMusic()
  else collectMusic()
}
