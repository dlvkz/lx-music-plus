import { useEffect, useState } from 'react'
import playerState from '@/store/player/state'
import { prefetch } from '@/components/common/ImageBackground'

// The cover shown (the play bar, the player, the dynamic backgrounds): the one of the song before stays until the
// cover of the new song is loaded, no empty / grey moment between two songs (desktop: core/displayPic.ts)

// a song that has no cover: the one before is left after this long
const NO_COVER_DELAY = 4000

export const formatPicUri = (url: string) => url.startsWith('/') ? `file://${url}` : url

let displayPic: string | null = null
const listeners = new Set<(pic: string | null) => void>()
const setDisplayPic = (pic: string | null) => {
  if (pic == displayPic) return
  displayPic = pic
  for (const listener of listeners) listener(pic)
}

let token = 0
let noCoverTimeout: NodeJS.Timeout | null = null
const update = () => {
  const { id, pic } = playerState.musicInfo
  const current = ++token
  if (noCoverTimeout) {
    clearTimeout(noCoverTimeout)
    noCoverTimeout = null
  }
  // nothing playing
  if (!id) {
    setDisplayPic(null)
    return
  }
  // the cover is still looked for
  if (!pic) {
    noCoverTimeout = setTimeout(() => {
      noCoverTimeout = null
      if (current == token) setDisplayPic(null)
    }, NO_COVER_DELAY)
    return
  }
  if (pic == displayPic) return
  void prefetch(formatPicUri(pic)).then(() => {
    if (current == token) setDisplayPic(pic)
  }).catch(() => {
    // (a cover that can't be loaded: none, not the one of the song before)
    if (current == token) setDisplayPic(null)
  })
}

let isStarted = false
const start = () => {
  if (isStarted) return
  isStarted = true
  displayPic = playerState.musicInfo.pic ?? null
  global.state_event.on('playerMusicInfoChanged', update)
  update()
}

export const getDisplayPic = () => {
  start()
  return displayPic
}

export const onDisplayPicChanged = (listener: (pic: string | null) => void) => {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useDisplayPic = () => {
  const [pic, setPic] = useState(getDisplayPic)
  useEffect(() => {
    setPic(getDisplayPic())
    return onDisplayPicChanged(setPic)
  }, [])
  return pic
}
