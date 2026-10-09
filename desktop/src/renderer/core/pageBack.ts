// Pages with their own "back" behaviour (e.g. a playlist returns to the playlist grid) register it here,
// so the back button of the toolbar does the same thing as the back button inside the page.

import router from '@renderer/router'
import { isShowPlayerDetail } from '@renderer/store/player/state'
import { setShowPlayerDetail } from '@renderer/store/player/action'

type BackHandler = () => boolean

let pageHandler: BackHandler | null = null

/**
 * @param handler returns true when it handled the navigation
 * @returns function that removes the handler
 */
export const setPageBackHandler = (handler: BackHandler) => {
  pageHandler = handler
  return () => {
    if (pageHandler == handler) pageHandler = null
  }
}

const runPageBack = (): boolean => {
  return pageHandler?.() ?? false
}

/**
 * The one "back" of the app (toolbar button, mouse back button):
 * leaves the full screen player first, then uses the page's own back, then the history
 */
export const goBack = () => {
  if (isShowPlayerDetail.value) {
    setShowPlayerDetail(false)
    return
  }
  if (runPageBack()) return
  const fromPath = router.currentRoute.value.fullPath
  router.back()
  setTimeout(() => {
    if (router.currentRoute.value.fullPath === fromPath) void router.replace('/home').catch(() => {})
  }, 100)
}

// mouse back button
const MOUSE_BACK_BUTTON = 3
window.addEventListener('mouseup', event => {
  if (event.button != MOUSE_BACK_BUTTON) return
  event.preventDefault()
  goBack()
})
