/**
 * Created by qianxin on 17/6/1.
 * 屏幕工具类
 * ui设计基准,iphone 6
 * width:375
 * height:667
 */
import { Dimensions, PixelRatio } from 'react-native'

// 高保真的宽度和高度
const designWidth = 375.0
const designHeight = 667.0

// The size of the physical screen in dp: the size of the window is not stable when the app starts
// (split screen, rotation, started from the notification without a window...), and a bad value made
// all the sizes smaller until the next start
const screen = Dimensions.get('screen')
const screenW = Math.min(screen.width, screen.height)
const screenH = Math.max(screen.width, screen.height)
let fontScale = PixelRatio.getFontScale()

// The sizes follow the size of the screen in dp, not its resolution: the limit used to be in pixels
// (3.1 px per design unit), so a higher resolution setting (1440p instead of 1080p) made everything
// smaller. The limit is now in dp (it is not reached by phones, the 1080p look everywhere).
const MAX_SCALE = 1.3
const scale = Math.min(screenW / designWidth, screenH / designHeight, MAX_SCALE)

/**
 * 设置text
 * @param size  px
 * @returns dp
 */
export function getTextSize(size: number) {
  // console.log('screenW======' + screenW)
  // console.log('screenPxW======' + screenPxW)
  let scaleWidth = screenW / designWidth
  let scaleHeight = screenH / designHeight
  // console.log(scaleWidth, scaleHeight)
  let scale = Math.min(scaleWidth, scaleHeight, 1.3)
  size = Math.floor(size * scale / fontScale)
  // console.log(size)
  return size
}
export function setSpText(size: number) {
  return getTextSize(size) * global.lx.fontSize
}

/**
 * 设置高度
 * @param size  px
 * @returns dp
 */
export function scaleSizeH(size: number) {
  // console.log(screenPxH / designHeight)
  // let scaleHeight = size * Math.min(screenPxH / designHeight, 3.1)
  size = Math.floor(size * scale)
  return size * global.lx.fontSize
}

/**
 * 设置宽度
 * @param size  px
 * @returns dp
 */
export function scaleSizeW(size: number) {
  // console.log(screenPxW / designWidth)
  // let scaleWidth = size * Math.min(screenPxW / designWidth, 3.1)
  size = Math.floor(size * scale)
  return size * global.lx.fontSize
}


export const scaleSizeWR = (size: number) => {
  return size * 2 - scaleSizeW(size)
}

export const scaleSizeHR = (size: number) => {
  return size * 2 - scaleSizeH(size)
}

export const scaleSizeAbsHR = (size: number) => {
  return size * 2 - Math.floor(size * scale)
}
