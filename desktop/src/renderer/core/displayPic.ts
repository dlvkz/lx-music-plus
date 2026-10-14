import { ref, watch } from '@common/utils/vueTools'
import { musicInfo } from '@renderer/store/player/state'

// The cover shown (the play bar, the player, the dynamic backgrounds): the one of the song before stays until the
// cover of the new song is loaded, no empty / grey moment between two songs (mobile: core/displayPic.ts)

// a song that has no cover: the one before is left after this long
const NO_COVER_DELAY = 4000

export const displayPic = ref<string | null>(musicInfo.pic)

let token = 0
let noCoverTimeout: ReturnType<typeof setTimeout> | null = null
watch(() => [musicInfo.id, musicInfo.pic] as const, ([id, pic]) => {
  const current = ++token
  if (noCoverTimeout) {
    clearTimeout(noCoverTimeout)
    noCoverTimeout = null
  }
  // nothing playing
  if (!id) {
    displayPic.value = null
    return
  }
  // the cover is still looked for
  if (!pic) {
    noCoverTimeout = setTimeout(() => {
      noCoverTimeout = null
      if (current == token) displayPic.value = null
    }, NO_COVER_DELAY)
    return
  }
  if (pic == displayPic.value) return
  const img = new Image()
  img.onload = () => {
    if (current == token) displayPic.value = pic
  }
  // (a cover that can't be loaded: none, not the one of the song before)
  img.onerror = () => {
    if (current == token) displayPic.value = null
  }
  img.src = pic
}, { immediate: true })
