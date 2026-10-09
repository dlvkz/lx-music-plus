import { Dimensions, StatusBar } from 'react-native'

// The app is laid out behind the system navigation bar (see MainActivity.layoutBehindNavigationBar),
// the pages leave room for it themselves.

/**
 * Color given to the system navigation bar: transparent, the rgb part only tells the system
 * whether its buttons have to be dark or light
 */
export const getNavBarColor = (isDark: boolean) => isDark ? '#00000001' : '#ffffff01'

/**
 * Height of the system navigation bar (gesture strip or buttons)
 */
export const getNavBarHeight = (): number => {
  const screen = Dimensions.get('screen')
  const window = Dimensions.get('window')
  // no bar at the bottom when it sits on the side (landscape with buttons)
  if (screen.width != window.width) return 0
  const height = screen.height - window.height
  // the window height usually leaves the status bar out too
  const heightWithoutStatusBar = height - (StatusBar.currentHeight ?? 0)
  return Math.max(Math.round(heightWithoutStatusBar > 0 ? heightWithoutStatusBar : height), 0)
}
