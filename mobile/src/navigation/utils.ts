import { getNavBarColor } from '@/utils/navBar'
import { Navigation } from 'react-native-navigation'
import {
  VERSION_MODAL,
  PACT_MODAL,
  DIALOG_MODAL,
  SYNC_MODE_MODAL,
} from './screenNames'
import themeState from '@/store/theme/state'
import { setDialogHandler } from '@/utils/tools'
import { isTabPageId, popTabPage } from '@/store/tabPages'
import { type DialogProps } from './components/DialogModal'


export const getStatusBarStyle = (isDark: boolean) => isDark ? 'light' : 'dark'

export const dismissOverlay = async(compId: string) => Navigation.dismissOverlay(compId)

// pages opened in a tab (store/tabPages) are closed there
export const pop = async(compId: string) => {
  if (isTabPageId(compId)) {
    popTabPage(compId)
    return compId
  }
  return Navigation.pop(compId)
}
export const popToRoot = async(compId: string) => Navigation.popToRoot(compId)
export const popTo = async(compId: string) => Navigation.popTo(compId)

/**
 * Dialog in the app theme, resolves with the value of the pressed button (null when dismissed)
 */
export const showDialog = async<T>(options: Omit<DialogProps<T>, 'onClose'>): Promise<T | null> => {
  const theme = themeState.theme
  return new Promise<T | null>(resolve => {
    void Navigation.showOverlay({
      component: {
        name: DIALOG_MODAL,
        passProps: {
          ...options,
          onClose: resolve,
        },
        options: {
          layout: {
            componentBackgroundColor: 'transparent',
          },
          overlay: {
            interceptTouchOutside: true,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            backgroundColor: getNavBarColor(theme.isDark),
          },
        },
      },
    }).catch(() => {
      resolve(null)
    })
  })
}
// the dialogs of utils/tools (confirm / tip / permission reminders) use it once the navigation is ready
setDialogHandler(showDialog)

export const showPactModal = () => {
  const theme = themeState.theme

  void Navigation.showOverlay({
    component: {
      name: PACT_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          // visible: false,
          backgroundColor: getNavBarColor(theme.isDark),
        },
        // animations: {

        //   showModal: {
        //     enter: {
        //       enabled: true,
        //       alpha: {
        //         from: 0,
        //         to: 1,
        //         duration: 300,
        //       },
        //     },
        //     exit: {
        //       enabled: true,
        //       alpha: {
        //         from: 1,
        //         to: 0,
        //         duration: 300,
        //       },
        //     },
        //   },
        // },
      },
    },
  })
}

export const showVersionModal = () => {
  const theme = themeState.theme

  void Navigation.showOverlay({
    component: {
      name: VERSION_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          // visible: false,
          backgroundColor: getNavBarColor(theme.isDark),
        },
        // animations: {

        //   showModal: {
        //     enter: {
        //       enabled: true,
        //       alpha: {
        //         from: 0,
        //         to: 1,
        //         duration: 300,
        //       },
        //     },
        //     exit: {
        //       enabled: true,
        //       alpha: {
        //         from: 1,
        //         to: 0,
        //         duration: 300,
        //       },
        //     },
        //   },
        // },
      },
    },
  })
}

export const showSyncModeModal = () => {
  const theme = themeState.theme

  void Navigation.showOverlay({
    component: {
      name: SYNC_MODE_MODAL,
      options: {
        layout: {
          componentBackgroundColor: 'transparent',
        },
        overlay: {
          interceptTouchOutside: true,
        },
        statusBar: {
          drawBehind: true,
          visible: true,
          style: getStatusBarStyle(theme.isDark),
          backgroundColor: 'transparent',
        },
        navigationBar: {
          // visible: false,
          backgroundColor: getNavBarColor(theme.isDark),
        },
        // animations: {

        //   showModal: {
        //     enter: {
        //       enabled: true,
        //       alpha: {
        //         from: 0,
        //         to: 1,
        //         duration: 300,
        //       },
        //     },
        //     exit: {
        //       enabled: true,
        //       alpha: {
        //         from: 1,
        //         to: 0,
        //         duration: 300,
        //       },
        //     },
        //   },
        // },
      },
    },
  })
}

// export const showToast = (text) => {
//   Navigation.showOverlay({
//     component: {
//       name: TOAST_SCREEN,
//     },
//   })
// }
