import { webFrame } from 'electron'
import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'

// The window is resized by its edges: in a big one the whole page is bigger (text, covers, spaces...), the page laid
// out as in a window of about this size (full screen too). The size follows the window while it is resized, and
// glides to the new one when the window jumps (maximized, full screen)
const BASE_WIDTH = 1240
const BASE_HEIGHT = 780
const MAX_ZOOM = 1.5
const DURATION = 200

// (a change smaller than this is left: no zoom going back and forth by rounding)
const MIN_CHANGE = 0.02

const getTargetZoom = () => {
  // the size of the window (its outer size: not changed by the zoom, the page size is, and rounded: a zoom changed
  // from it changed it again, back and forth)
  const zoom = Math.min(window.outerWidth / BASE_WIDTH, window.outerHeight / BASE_HEIGHT, MAX_ZOOM)
  return Math.max(1, Math.round(zoom * 100) / 100)
}

let frame: number | null = null
let animation: { from: number, to: number, start: number } | null = null
const step = (now: number) => {
  if (!animation) return
  const t = Math.min(1, (now - animation.start) / DURATION)
  // (ease out)
  const eased = 1 - Math.pow(1 - t, 3)
  webFrame.setZoomFactor(animation.from + (animation.to - animation.from) * eased)
  if (t < 1) frame = requestAnimationFrame(step)
  else {
    frame = null
    animation = null
  }
}
const animateTo = (target: number) => {
  const current = webFrame.getZoomFactor()
  // (the zoom changing resizes the page too: the same target is not started again; a small change is left, the
  // bounds of the zoom are always reached)
  const isBound = target == 1 || target == MAX_ZOOM
  if (animation && Math.abs(animation.to - target) < (isBound ? 0.001 : MIN_CHANGE)) return
  if (!animation && Math.abs(current - target) < (isBound ? 0.001 : MIN_CHANGE)) return
  animation = { from: current, to: target, start: performance.now() }
  frame ??= requestAnimationFrame(step)
}

export default () => {
  let pending: number | null = null
  // (once a frame while the window is resized)
  const handleResize = () => {
    if (pending != null) return
    pending = requestAnimationFrame(() => {
      pending = null
      animateTo(getTargetZoom())
    })
  }
  window.addEventListener('resize', handleResize)
  watch(isFullscreen, handleResize)
  webFrame.setZoomFactor(getTargetZoom())
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (pending != null) cancelAnimationFrame(pending)
    if (frame != null) cancelAnimationFrame(frame)
  })
}
