import { getNavBarColor } from '@/utils/navBar'
import { Navigation } from 'react-native-navigation'
import * as screenNames from './screenNames'
import * as navigations from './navigation'

import registerScreens from './registerScreens'
import { removeComponentId } from '@/core/common'
import { onAppLaunched } from './regLaunchedEvent'
import commonState from '@/store/common/state'
import { getStatusBarStyle } from './utils'
import { setCollectionPusher } from '@/core/musicLinks'

setCollectionPusher(navigations.pushCollectionScreen)

let unRegisterEvent: ReturnType<ReturnType<typeof Navigation.events>['registerScreenPoppedListener']>

const init = (callback: () => void | Promise<void>) => {
  // Register all screens on launch
  registerScreens()

  if (unRegisterEvent) unRegisterEvent.remove()

  Navigation.setDefaultOptions({
    // animations: {
    //   setRoot: {
    //     waitForRender: true,
    //   },
    // },
  })
  unRegisterEvent = Navigation.events().registerScreenPoppedListener(({ componentId }) => {
    removeComponentId(componentId)
  })
  // the system bars of the screens that are already open follow the theme (e.g. system dark mode switch)
  global.state_event.on('themeUpdated', (theme) => {
    const options = {
      statusBar: {
        style: getStatusBarStyle(theme.isDark),
      },
      navigationBar: {
        backgroundColor: getNavBarColor(theme.isDark),
      },
      layout: {
        componentBackgroundColor: theme['c-content-background'],
      },
    } as const
    for (const componentId of Object.values(commonState.componentIds)) {
      if (componentId) Navigation.mergeOptions(componentId, options)
    }
  })
  onAppLaunched(() => {
    console.log('Register app launched listener')
    void callback()
  })
}

export * from './utils'
export * from './event'
export * from './hooks'

export {
  init,
  screenNames,
  navigations,
}
