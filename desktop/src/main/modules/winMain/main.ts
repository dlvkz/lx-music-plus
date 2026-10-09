import { BrowserWindow, dialog, screen, session } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { createTaskBarButtons, getWindowSizeInfo } from './utils'
import { getOSVersion, getPlatform, isLinux, isMac, isWin } from '@common/utils'
import { getProxy, openDevTools as handleOpenDevTools } from '@main/utils'
import { mainSend } from '@common/mainIpc'
import { sendFocus, sendTaskbarButtonClick } from './rendererEvent'
import { encodePath } from '@common/utils/electron'

let browserWindow: Electron.BrowserWindow | null = null

const winEvent = () => {
  if (!browserWindow) return

  browserWindow.on('close', event => {
    if (global.lx.isSkipTrayQuit || !global.lx.appSetting['tray.enable']) {
      browserWindow!.setProgressBar(-1)
      // global.lx.mainWindowClosed = true
      global.lx.event_app.main_window_close()
      return
    }

    event.preventDefault()
    browserWindow!.hide()
  })

  browserWindow.on('closed', () => {
    // global.lx.mainWindowClosed = true
    browserWindow = null
  })

  // browserWindow.on('restore', () => {
  //   browserWindow.webContents.send('restore')
  // })
  browserWindow.on('focus', () => {
    sendFocus()
    global.lx.event_app.main_window_focus()
  })

  browserWindow.on('blur', () => {
    global.lx.event_app.main_window_blur()
  })
  browserWindow.on('enter-full-screen', () => {
    global.lx.event_app.main_window_fullscreen(true)
  })
  browserWindow.on('leave-full-screen', () => {
    global.lx.event_app.main_window_fullscreen(false)

    // macOS needs here to set resizable to false after exiting full screen
    if (isMac) {
      if (browserWindow?.resizable) {
        browserWindow.setResizable(false)
      }
    }
  })

  browserWindow.once('ready-to-show', () => {
    if (!global.envParams.cmdParams.hidden) {
      showWindow()
      setThumbarButtons()
    }
    global.lx.event_app.main_window_ready_to_show()
  })

  browserWindow.on('show', () => {
    global.lx.event_app.main_window_show()

    // 修复隐藏窗口后再显示时任务栏按钮丢失的问题
    setThumbarButtons()
  })
  browserWindow.on('hide', () => {
    global.lx.event_app.main_window_hide()
  })
}


// the size, place and state of the window kept between runs (the window is resized by its edges)
const WINDOW_STATE_FILE = 'window-state.json'
const MIN_WIDTH = 760
const MIN_HEIGHT = 500
interface WindowState { x?: number, y?: number, width: number, height: number, maximized: boolean }
const getWindowStatePath = () => path.join(global.lxDataPath, WINDOW_STATE_FILE)
const readWindowState = (): WindowState | null => {
  try {
    const state = JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf8')) as WindowState
    if (!(state.width >= MIN_WIDTH && state.height >= MIN_HEIGHT)) return null
    // (a place on a screen not connected any more: centred)
    if (state.x != null && state.y != null) {
      const visible = screen.getAllDisplays().some(({ workArea: area }) => state.x! < area.x + area.width - 100 && state.x! + state.width > area.x + 100 && state.y! >= area.y - 20 && state.y! < area.y + area.height - 100)
      if (!visible) {
        delete state.x
        delete state.y
      }
    }
    return state
  } catch {
    return null
  }
}
let saveStateTimeout: NodeJS.Timeout | null = null
const saveWindowState = () => {
  if (saveStateTimeout) clearTimeout(saveStateTimeout)
  saveStateTimeout = setTimeout(() => {
    saveStateTimeout = null
    if (!browserWindow || browserWindow.isDestroyed() || browserWindow.isFullScreen() || browserWindow.isMinimized()) return
    const maximized = browserWindow.isMaximized()
    // (maximized: the size it comes back to)
    const bounds = maximized ? browserWindow.getNormalBounds() : browserWindow.getBounds()
    const state: WindowState = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, maximized }
    fs.promises.writeFile(getWindowStatePath(), JSON.stringify(state)).catch(() => {})
  }, 500)
}

export const createWindow = () => {
  closeWindow()
  const windowSizeInfo = getWindowSizeInfo(global.lx.appSetting['common.windowSizeId'])
  const windowState = readWindowState()

  const { shouldUseDarkColors, theme } = global.lx.theme
  const ses = session.fromPartition('persist:win-main')
  const proxy = getProxy()
  setSesProxy(ses, proxy?.host, proxy?.port)

  /**
   * Initial window options
   */
  const options: Electron.BrowserWindowConstructorOptions = {
    height: windowState?.height ?? windowSizeInfo.height,
    width: windowState?.width ?? windowSizeInfo.width,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: !global.envParams.cmdParams.dt,
    hasShadow: global.envParams.cmdParams.dt,
    // enableRemoteModule: false,
    // icon: join(global.__static, isWin ? 'icons/256x256.ico' : 'icons/512x512.png'),
    resizable: true,
    maximizable: true,
    fullscreenable: true,
    roundedCorners: global.envParams.cmdParams.dt,
    show: false,
    webPreferences: {
      session: ses,
      nodeIntegrationInWorker: true,
      contextIsolation: false,
      webSecurity: false,
      nodeIntegration: true,
      sandbox: false,
      enableWebSQL: false,
      webgl: false,
      spellcheck: false, // 禁用拼写检查器
    },
  }
  if (global.envParams.cmdParams.dt) options.backgroundColor = theme.colors['--color-primary-light-1000']
  if (global.lx.appSetting['common.startInFullscreen']) {
    options.fullscreen = true
    if (isLinux) options.resizable = true
  }
  browserWindow = new BrowserWindow(options)
  if (windowState?.maximized && !options.fullscreen) browserWindow.maximize()
  browserWindow.on('resize', saveWindowState)
  browserWindow.on('move', saveWindowState)
  browserWindow.on('maximize', saveWindowState)
  browserWindow.on('unmaximize', saveWindowState)

  const winURL = process.env.NODE_ENV !== 'production' ? 'http://localhost:9080' : `file://${path.join(encodePath(__dirname), 'index.html')}`
  void browserWindow.loadURL(winURL + `?os=${getPlatform()}&osver=${encodeURIComponent(getOSVersion())}&dt=${global.envParams.cmdParams.dt}&dark=${shouldUseDarkColors}&theme=${encodeURIComponent(JSON.stringify(theme))}`)

  winEvent()

  if (global.envParams.cmdParams.odt) handleOpenDevTools(browserWindow.webContents)

  // global.lx.mainWindowClosed = false
  // browserWindow.webContents.openDevTools()
  global.lx.event_app.main_window_created(browserWindow)
}

export const isExistWindow = (): boolean => !!browserWindow
export const isShowWindow = (): boolean => {
  if (!browserWindow) return false
  return browserWindow.isVisible() && (isWin ? true : browserWindow.isFocused())
}

export const closeWindow = () => {
  if (!browserWindow) return
  browserWindow.close()
}

const setSesProxy = (ses: Electron.Session, host?: string, port?: string | number) => {
  if (host) {
    void ses.setProxy({
      mode: 'fixed_servers',
      proxyRules: `http://${host}:${port}`,
    })
  } else {
    void ses.setProxy({
      mode: 'direct',
    })
  }
}
export const setProxy = () => {
  if (!browserWindow) return
  const proxy = getProxy()
  setSesProxy(browserWindow.webContents.session, proxy?.host, proxy?.port)
}


export const sendEvent = <T = any>(name: string, params?: T) => {
  if (!browserWindow) return
  mainSend(browserWindow, name, params)
}

export const showSelectDialog = async(options: Electron.OpenDialogOptions) => {
  if (!browserWindow) throw new Error('main window is undefined')
  return dialog.showOpenDialog(browserWindow, options)
}
export const showDialog = ({ type, message, detail }: Electron.MessageBoxSyncOptions) => {
  if (!browserWindow) return
  dialog.showMessageBoxSync(browserWindow, {
    type,
    message,
    detail,
  })
}
export const showSaveDialog = async(options: Electron.SaveDialogOptions) => {
  if (!browserWindow) throw new Error('main window is undefined')
  return dialog.showSaveDialog(browserWindow, options)
}
export const minimize = () => {
  if (!browserWindow) return
  browserWindow.minimize()
}
// (the button of the window: maximized ⇄ its size)
export const maximize = () => {
  if (!browserWindow) return
  if (browserWindow.isMaximized()) browserWindow.unmaximize()
  else browserWindow.maximize()
}
export const unmaximize = () => {
  if (!browserWindow) return
  browserWindow.unmaximize()
}
export const toggleHide = () => {
  if (!browserWindow) return
  browserWindow.isVisible()
    ? browserWindow.hide()
    : browserWindow.show()
}
export const toggleMinimize = () => {
  if (!browserWindow) return
  if (browserWindow.isVisible()) {
    if (browserWindow.isMinimized()) browserWindow.restore()
    else browserWindow.minimize()
  } else browserWindow.show()
}
export const showWindow = () => {
  if (!browserWindow) return
  if (browserWindow.isVisible()) {
    if (browserWindow.isMinimized()) browserWindow.restore()
    else browserWindow.focus()
  } else browserWindow.show()
}
export const hideWindow = () => {
  if (!browserWindow) return
  browserWindow.hide()
}
export const setWindowBounds = (options: Partial<Electron.Rectangle>) => {
  if (!browserWindow) return
  browserWindow.setBounds(options)
}
export const setProgressBar = (progress: number, options?: Electron.ProgressBarOptions) => {
  if (!browserWindow) return
  browserWindow.setProgressBar(progress, options)
}
export const setIgnoreMouseEvents = (ignore: boolean, options?: Electron.IgnoreMouseEventsOptions) => {
  if (!browserWindow) return
  browserWindow.setIgnoreMouseEvents(ignore, options)
}
export const toggleDevTools = () => {
  if (!browserWindow) return
  if (browserWindow.webContents.isDevToolsOpened()) {
    browserWindow.webContents.closeDevTools()
  } else {
    handleOpenDevTools(browserWindow.webContents)
  }
}

export const setFullScreen = (isFullscreen: boolean): boolean => {
  if (!browserWindow) return false
  // https://github.com/any-listen/any-listen/issues/190
  // in electron ^41.2.0, windows -dt mode need to set resizable to true before setting full screen
  if (!!global.envParams.cmdParams.dt || isLinux) {
    // linux 需要先设置为可调整窗口大小才能全屏
    if (isFullscreen) {
      browserWindow.setResizable(isFullscreen)
      browserWindow.setFullScreen(isFullscreen)
    } else {
      browserWindow.setFullScreen(isFullscreen)
      // (the window stays resizable)
      browserWindow.setResizable(true)
    }
  } else {
    browserWindow.setFullScreen(isFullscreen)
  }
  return isFullscreen
}

const taskBarButtonFlags: LX.TaskBarButtonFlags = {
  empty: true,
  collect: false,
  play: false,
  next: true,
  prev: true,
}
export const setThumbarButtons = ({ empty, collect, play, next, prev }: LX.TaskBarButtonFlags = taskBarButtonFlags) => {
  if (!isWin || !browserWindow) return
  taskBarButtonFlags.empty = empty
  taskBarButtonFlags.collect = collect
  taskBarButtonFlags.play = play
  taskBarButtonFlags.next = next
  taskBarButtonFlags.prev = prev
  browserWindow.setThumbarButtons(createTaskBarButtons(taskBarButtonFlags, action => {
    sendTaskbarButtonClick(action)
  }))
}

export const setThumbnailClip = (region: Electron.Rectangle) => {
  if (!browserWindow) return
  browserWindow.setThumbnailClip(region)
}


export const clearCache = async() => {
  if (!browserWindow) throw new Error('main window is undefined')
  await browserWindow.webContents.session.clearCache()
}

export const getCacheSize = async() => {
  if (!browserWindow) throw new Error('main window is undefined')
  return browserWindow.webContents.session.getCacheSize()
}

export const getWebContents = (): Electron.WebContents => {
  if (!browserWindow) throw new Error('main window is undefined')
  return browserWindow.webContents
}
