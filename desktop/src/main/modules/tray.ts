import { Tray, Menu, nativeImage } from 'electron'
import { isMac, isWin } from '@common/utils'
import path from 'node:path'
import {
  hideWindow as hideMainWindow,
  isExistWindow as isExistMainWindow,
  isShowWindow as isShowMainWindow,
  sendTaskbarButtonClick,
  showWindow as showMainWindow,
} from './winMain'
import { quitApp } from '@main/app'
import { TRAY_AUTO_ID } from '@common/constants'

let tray: Electron.Tray | null
let isEnableTray: boolean = false
let themeId: number
let isShowStatusBarLyric: boolean = false

const playerState = {
  empty: false,
  collect: false,
  play: false,
  next: true,
  prev: true,
}

const watchConfigKeys = [
  'desktopLyric.enable',
  'desktopLyric.isLock',
  'desktopLyric.isAlwaysOnTop',
  'tray.themeId',
  'tray.enable',
  'player.isShowStatusBarLyric',
  'common.langId',
] satisfies Array<keyof LX.AppSetting>

const themeList = [
  {
    id: 0,
    fileName: 'trayTemplate',
    isNative: true,
  },
  {
    id: 1,
    fileName: 'tray_origin',
    isNative: false,
  },
  {
    id: 2,
    fileName: 'tray_black',
    isNative: false,
  },
]

const messages = {
  'en-us': {
    collect: 'Love',
    uncollect: 'Unlove',
    play: 'Play',
    pause: 'Pause',
    next: 'Next Song',
    prev: 'Prev Song',
    hide_win_main: 'Hide Main Window',
    show_win_main: 'Show Main Window',
    hide_win_lyric: 'Hide Lyric Window',
    show_win_lyric: 'Show Lyric Window',
    lock_win_lyric: 'Lock Lyric Window',
    unlock_win_lyric: 'Unlock Lyric Window',
    top_win_lyric: 'On-top Lyric Window',
    untop_win_lyric: 'Un-top Lyric Window',
    show_statusbar_lyric: 'Show Lyrics on Statusbar',
    hide_statusbar_lyric: 'Hide Lyrics on Statusbar',
    exit: 'Exit',
    music_name: 'Title: ',
    music_singer: 'Artist: ',
  },
  'zh-cn': {
    collect: '收藏',
    uncollect: '取消收藏',
    play: '播放',
    pause: '暂停',
    next: '下一曲',
    prev: '上一曲',
    hide_win_main: '隐藏主界面',
    show_win_main: '显示主界面',
    hide_win_lyric: '关闭桌面歌词',
    show_win_lyric: '开启桌面歌词',
    lock_win_lyric: '锁定桌面歌词',
    unlock_win_lyric: '解锁桌面歌词',
    top_win_lyric: '置顶歌词',
    untop_win_lyric: '取消置顶',
    show_statusbar_lyric: '显示状态栏歌词',
    hide_statusbar_lyric: '隐藏状态栏歌词',
    exit: '退出',
    music_name: '歌曲名: ',
    music_singer: '艺术家: ',
  },
  'zh-tw': {
    collect: '收藏',
    uncollect: '取消收藏',
    play: '播放',
    pause: '暫停',
    next: '下一曲',
    prev: '上一曲',
    hide_win_main: '隱藏軟體視窗',
    show_win_main: '顯示軟體視窗',
    hide_win_lyric: '關閉歌詞視窗',
    show_win_lyric: '開啟歌詞視窗',
    lock_win_lyric: '鎖定歌詞視窗',
    unlock_win_lyric: '解鎖歌詞視窗',
    top_win_lyric: '置頂歌詞視窗',
    untop_win_lyric: '取消置頂歌詞視窗',
    show_statusbar_lyric: '顯示狀態列歌詞',
    hide_statusbar_lyric: '隱藏狀態列歌詞',
    exit: '退出',
    music_name: '標題: ',
    music_singer: '演出者: ',
  },
  'ko-kr': {
    collect: '즐겨찾기 추가',
    uncollect: '즐겨찾기 해제',
    play: '재생',
    pause: '일시정지',
    next: '다음 곡',
    prev: '이전 곡',
    hide_win_main: '메인 창 숨기기',
    show_win_main: '메인 창 표시',
    hide_win_lyric: '가사 창 닫기',
    show_win_lyric: '가사 창 열기',
    lock_win_lyric: '가사 창 잠금',
    unlock_win_lyric: '가사 창 잠금 해제',
    top_win_lyric: '가사 항상 위에 표시',
    untop_win_lyric: '항상 위에 표시 해제',
    show_statusbar_lyric: '상태 표시줄에 가사 표시',
    hide_statusbar_lyric: '상태 표시줄 가사 숨기기',
    exit: '종료',
    music_name: '제목: ',
    music_singer: '아티스트: ',
  },
  'ja-jp': {
    collect: 'お気に入りに追加',
    uncollect: 'お気に入りから削除',
    play: '再生',
    pause: '一時停止',
    next: '次の曲',
    prev: '前の曲',
    hide_win_main: 'メインウィンドウを隠す',
    show_win_main: 'メインウィンドウを表示',
    hide_win_lyric: '歌詞ウィンドウを隠す',
    show_win_lyric: '歌詞ウィンドウを表示',
    lock_win_lyric: '歌詞ウィンドウをロック',
    unlock_win_lyric: '歌詞ウィンドウのロックを解除',
    top_win_lyric: '歌詞ウィンドウを最前面に固定',
    untop_win_lyric: '歌詞ウィンドウの最前面固定を解除',
    show_statusbar_lyric: 'ステータスバーに歌詞を表示',
    hide_statusbar_lyric: 'ステータスバーの歌詞を隠す',
    exit: '終了',
    music_name: '曲名: ',
    music_singer: 'アーティスト: ',
  },
  'es-es': {
    collect: 'Añadir a Favoritas',
    uncollect: 'Quitar de Favoritas',
    play: 'Reproducir',
    pause: 'Pausar',
    next: 'Siguiente canción',
    prev: 'Canción anterior',
    hide_win_main: 'Ocultar la ventana principal',
    show_win_main: 'Mostrar la ventana principal',
    hide_win_lyric: 'Ocultar la ventana de letras',
    show_win_lyric: 'Mostrar la ventana de letras',
    lock_win_lyric: 'Bloquear la ventana de letras',
    unlock_win_lyric: 'Desbloquear la ventana de letras',
    top_win_lyric: 'Fijar la ventana de letras encima',
    untop_win_lyric: 'Dejar de fijar la ventana de letras',
    show_statusbar_lyric: 'Mostrar la letra en la barra de estado',
    hide_statusbar_lyric: 'Ocultar la letra de la barra de estado',
    exit: 'Salir',
    music_name: 'Título: ',
    music_singer: 'Artista: ',
  },
  'pt-br': {
    collect: 'Curtir',
    uncollect: 'Descurtir',
    play: 'Tocar',
    pause: 'Pausar',
    next: 'Próxima música',
    prev: 'Música anterior',
    hide_win_main: 'Ocultar a janela principal',
    show_win_main: 'Mostrar a janela principal',
    hide_win_lyric: 'Ocultar a janela de letras',
    show_win_lyric: 'Mostrar a janela de letras',
    lock_win_lyric: 'Travar a janela de letras',
    unlock_win_lyric: 'Destravar a janela de letras',
    top_win_lyric: 'Manter a janela de letras no topo',
    untop_win_lyric: 'Não manter a janela de letras no topo',
    show_statusbar_lyric: 'Mostrar a letra na barra de status',
    hide_statusbar_lyric: 'Ocultar a letra da barra de status',
    exit: 'Sair',
    music_name: 'Título: ',
    music_singer: 'Artista: ',
  },
  'ru-ru': {
    collect: 'В любимое',
    uncollect: 'Убрать из любимого',
    play: 'Воспроизвести',
    pause: 'Пауза',
    next: 'Следующий трек',
    prev: 'Предыдущий трек',
    hide_win_main: 'Скрыть главное окно',
    show_win_main: 'Показать главное окно',
    hide_win_lyric: 'Скрыть окно текста',
    show_win_lyric: 'Показать окно текста',
    lock_win_lyric: 'Закрепить окно текста',
    unlock_win_lyric: 'Открепить окно текста',
    top_win_lyric: 'Окно текста поверх всех окон',
    untop_win_lyric: 'Окно текста не поверх окон',
    show_statusbar_lyric: 'Показывать текст в строке состояния',
    hide_statusbar_lyric: 'Скрыть текст в строке состояния',
    exit: 'Выход',
    music_name: 'Название: ',
    music_singer: 'Исполнитель: ',
  },
  'vi-vn': {
    collect: 'Yêu thích',
    uncollect: 'Bỏ yêu thích',
    play: 'Phát',
    pause: 'Tạm dừng',
    next: 'Bài tiếp theo',
    prev: 'Bài trước',
    hide_win_main: 'Ẩn cửa sổ chính',
    show_win_main: 'Hiện cửa sổ chính',
    hide_win_lyric: 'Ẩn cửa sổ lời bài hát',
    show_win_lyric: 'Hiện cửa sổ lời bài hát',
    lock_win_lyric: 'Khóa cửa sổ lời bài hát',
    unlock_win_lyric: 'Mở khóa cửa sổ lời bài hát',
    top_win_lyric: 'Ghim cửa sổ lời bài hát lên trên',
    untop_win_lyric: 'Bỏ ghim cửa sổ lời bài hát',
    show_statusbar_lyric: 'Hiện lời trên thanh trạng thái',
    hide_statusbar_lyric: 'Ẩn lời trên thanh trạng thái',
    exit: 'Thoát',
    music_name: 'Tên bài: ',
    music_singer: 'Nghệ sĩ: ',
  },
  'de-de': {
    collect: 'Zu Lieblingssongs',
    uncollect: 'Aus Lieblingssongs entfernen',
    play: 'Abspielen',
    pause: 'Pause',
    next: 'Nächster Song',
    prev: 'Vorheriger Song',
    hide_win_main: 'Hauptfenster ausblenden',
    show_win_main: 'Hauptfenster anzeigen',
    hide_win_lyric: 'Songtext-Fenster ausblenden',
    show_win_lyric: 'Songtext-Fenster anzeigen',
    lock_win_lyric: 'Songtext-Fenster sperren',
    unlock_win_lyric: 'Songtext-Fenster entsperren',
    top_win_lyric: 'Songtext-Fenster im Vordergrund',
    untop_win_lyric: 'Songtext-Fenster nicht im Vordergrund',
    show_statusbar_lyric: 'Songtext in der Statusleiste anzeigen',
    hide_statusbar_lyric: 'Songtext in der Statusleiste ausblenden',
    exit: 'Beenden',
    music_name: 'Titel: ',
    music_singer: 'Künstler: ',
  },
  'fr-fr': {
    collect: 'Ajouter aux coups de cœur',
    uncollect: 'Retirer des coups de cœur',
    play: 'Lire',
    pause: 'Pause',
    next: 'Titre suivant',
    prev: 'Titre précédent',
    hide_win_main: 'Masquer la fenêtre principale',
    show_win_main: 'Afficher la fenêtre principale',
    hide_win_lyric: 'Masquer la fenêtre des paroles',
    show_win_lyric: 'Afficher la fenêtre des paroles',
    lock_win_lyric: 'Verrouiller la fenêtre des paroles',
    unlock_win_lyric: 'Déverrouiller la fenêtre des paroles',
    top_win_lyric: 'Fenêtre des paroles au premier plan',
    untop_win_lyric: 'Fenêtre des paroles pas au premier plan',
    show_statusbar_lyric: 'Afficher les paroles dans la barre d’état',
    hide_statusbar_lyric: 'Masquer les paroles de la barre d’état',
    exit: 'Quitter',
    music_name: 'Titre : ',
    music_singer: 'Artiste : ',
  },
  'it-it': {
    collect: 'Aggiungi ai Preferiti',
    uncollect: 'Rimuovi dai Preferiti',
    play: 'Riproduci',
    pause: 'Pausa',
    next: 'Brano successivo',
    prev: 'Brano precedente',
    hide_win_main: 'Nascondi la finestra principale',
    show_win_main: 'Mostra la finestra principale',
    hide_win_lyric: 'Nascondi la finestra del testo',
    show_win_lyric: 'Mostra la finestra del testo',
    lock_win_lyric: 'Blocca la finestra del testo',
    unlock_win_lyric: 'Sblocca la finestra del testo',
    top_win_lyric: 'Finestra del testo sempre in primo piano',
    untop_win_lyric: 'Finestra del testo non in primo piano',
    show_statusbar_lyric: 'Mostra il testo nella barra di stato',
    hide_statusbar_lyric: 'Nascondi il testo dalla barra di stato',
    exit: 'Esci',
    music_name: 'Titolo: ',
    music_singer: 'Artista: ',
  },
  'pl-pl': {
    collect: 'Dodaj do Ulubionych',
    uncollect: 'Usuń z Ulubionych',
    play: 'Odtwórz',
    pause: 'Pauza',
    next: 'Następny utwór',
    prev: 'Poprzedni utwór',
    hide_win_main: 'Ukryj okno główne',
    show_win_main: 'Pokaż okno główne',
    hide_win_lyric: 'Ukryj okno tekstu',
    show_win_lyric: 'Pokaż okno tekstu',
    lock_win_lyric: 'Zablokuj okno tekstu',
    unlock_win_lyric: 'Odblokuj okno tekstu',
    top_win_lyric: 'Okno tekstu zawsze na wierzchu',
    untop_win_lyric: 'Okno tekstu nie na wierzchu',
    show_statusbar_lyric: 'Pokaż tekst na pasku stanu',
    hide_statusbar_lyric: 'Ukryj tekst z paska stanu',
    exit: 'Zakończ',
    music_name: 'Tytuł: ',
    music_singer: 'Wykonawca: ',
  },
} as const
type Messages = typeof messages
type Langs = keyof Messages
const i18n = {
  message: messages['zh-cn'] as Messages[Langs],
  fallbackLocale: 'en-us' as 'en-us',
  getMessage(key: keyof Messages[Langs]) {
    return this.message[key]
  },
  setLang(lang?: Langs | null) {
    this.message = lang
      ? messages[lang] ?? messages[this.fallbackLocale]
      : messages[this.fallbackLocale]
  },
}

const getIconPath = (id: number) => {
  let theme = id == TRAY_AUTO_ID
    ? global.lx.theme.shouldUseDarkColors
      ? themeList[0] : themeList[2]
    : themeList.find(item => item.id === id) ?? themeList[0]
  return path.join(global.staticPath, 'images/tray', theme.fileName + (isWin ? '.ico' : '.png'))
}

export const createTray = () => {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  if ((tray && !tray.isDestroyed()) || !global.lx.appSetting['tray.enable']) return

  // 托盘
  tray = new Tray(nativeImage.createFromPath(getIconPath(global.lx.appSetting['tray.themeId'])))

  // tray.setToolTip('LX Music')
  // createMenu()
  tray.setIgnoreDoubleClickEvents(true)
  if (!isMac) {
    tray.on('click', () => {
      showMainWindow()
    })
  }
}

export const destroyTray = () => {
  if (!tray) return
  tray.destroy()
  isEnableTray = false
  isShowStatusBarLyric = false
  tray = null
}

const handleUpdateConfig = (setting: Partial<LX.AppSetting>) => {
  global.lx.event_app.update_config(setting)
}

const createPlayerMenu = () => {
  let menu: Electron.MenuItemConstructorOptions[] = []
  menu.push(playerState.play ? {
    label: i18n.getMessage('pause'),
    click() {
      sendTaskbarButtonClick('pause')
    },
  } : {
    label: i18n.getMessage('play'),
    click() {
      sendTaskbarButtonClick('play')
    },
  })
  menu.push({
    label: i18n.getMessage('prev'),
    click() {
      sendTaskbarButtonClick('prev')
    },
  })
  menu.push({
    label: i18n.getMessage('next'),
    click() {
      sendTaskbarButtonClick('next')
    },
  })
  menu.push(playerState.collect ? {
    label: i18n.getMessage('uncollect'),
    click() {
      sendTaskbarButtonClick('unCollect')
    },
  } : {
    label: i18n.getMessage('collect'),
    click() {
      sendTaskbarButtonClick('collect')
    },
  })
  return menu
}

export const createMenu = () => {
  if (!tray) return
  let menu: Electron.MenuItemConstructorOptions[] = createPlayerMenu()
  if (playerState.empty) for (const m of menu) m.enabled = false
  menu.push({ type: 'separator' })
  menu.push(global.lx.appSetting['desktopLyric.enable']
    ? {
        label: i18n.getMessage('hide_win_lyric'),
        click() {
          handleUpdateConfig({ 'desktopLyric.enable': false })
        },
      }
    : {
        label: i18n.getMessage('show_win_lyric'),
        click() {
          handleUpdateConfig({ 'desktopLyric.enable': true })
        },
      })
  menu.push(global.lx.appSetting['desktopLyric.isLock']
    ? {
        label: i18n.getMessage('unlock_win_lyric'),
        click() {
          handleUpdateConfig({ 'desktopLyric.isLock': false })
        },
      }
    : {
        label: i18n.getMessage('lock_win_lyric'),
        click() {
          handleUpdateConfig({ 'desktopLyric.isLock': true })
        },
      })
  menu.push(global.lx.appSetting['desktopLyric.isAlwaysOnTop']
    ? {
        label: i18n.getMessage('untop_win_lyric'),
        click() {
          handleUpdateConfig({ 'desktopLyric.isAlwaysOnTop': false })
        },
      }
    : {
        label: i18n.getMessage('top_win_lyric'),
        click() {
          handleUpdateConfig({ 'desktopLyric.isAlwaysOnTop': true })
        },
      })
  if (isMac) {
    menu.push({ type: 'separator' })
    menu.push(isShowStatusBarLyric
      ? {
          label: i18n.getMessage('hide_statusbar_lyric'),
          click() {
            handleUpdateConfig({ 'player.isShowStatusBarLyric': false })
          },
        }
      : {
          label: i18n.getMessage('show_statusbar_lyric'),
          click() {
            handleUpdateConfig({ 'player.isShowStatusBarLyric': true })
          },
        })
  }
  menu.push({ type: 'separator' })
  if (isExistMainWindow()) {
    const isShow = isShowMainWindow()
    menu.push(isShow
      ? {
          label: i18n.getMessage('hide_win_main'),
          click() {
            hideMainWindow()
          },
        }
      : {
          label: i18n.getMessage('show_win_main'),
          click() {
            showMainWindow()
          },
        })
  }
  menu.push({
    label: i18n.getMessage('exit'),
    click() {
      quitApp()
    },
  })
  const contextMenu = Menu.buildFromTemplate(menu)
  tray.setContextMenu(contextMenu)
}

export const setTrayImage = (themeId: number) => {
  if (!tray) return
  tray.setImage(nativeImage.createFromPath(getIconPath(themeId)))
}

const setLyric = (lyricLineText?: string) => {
  if (isShowStatusBarLyric && tray && lyricLineText != null) {
    tray.setTitle(lyricLineText)
  }
}

const defaultTip = 'LX Music+'
const setTip = () => {
  if (!tray) return

  let name = global.lx.player_status.name
  let tip: string
  if (name) {
    if (name.length > 20) name = name.substring(0, 20) + '...'
    let singer = global.lx.player_status.singer
    if (singer?.length > 20) singer = singer.substring(0, 20) + '...'

    tip = `${defaultTip}\n${i18n.getMessage('music_name')}${name}${singer ? `\n${i18n.getMessage('music_singer')}${singer}` : ''}`
  } else tip = defaultTip
  tray.setToolTip(tip)
}

const init = () => {
  if (themeId != global.lx.appSetting['tray.themeId']) {
    themeId = global.lx.appSetting['tray.themeId']
    setTrayImage(themeId)
  }
  if (isEnableTray !== global.lx.appSetting['tray.enable']) {
    isEnableTray = global.lx.appSetting['tray.enable']
    global.lx.appSetting['tray.enable'] ? createTray() : destroyTray()
  }
  if (isShowStatusBarLyric !== global.lx.appSetting['player.isShowStatusBarLyric']) {
    isShowStatusBarLyric = global.lx.appSetting['player.isShowStatusBarLyric']
    if (isShowStatusBarLyric) {
      setLyric(global.lx.player_status.lyricLineText)
    } else {
      tray?.setTitle('')
    }
  }
  setTip()
  createMenu()
}

export default () => {
  global.lx.event_app.on('updated_config', (keys, setting) => {
    if (!watchConfigKeys.some(key => keys.includes(key))) return

    if (keys.includes('common.langId')) i18n.setLang(setting['common.langId'])

    init()
  })

  global.lx.event_app.on('main_window_ready_to_show', () => {
    createMenu()
  })
  global.lx.event_app.on('main_window_show', () => {
    createMenu()
  })
  if (!isWin) {
    global.lx.event_app.on('main_window_focus', () => {
      createMenu()
    })
    global.lx.event_app.on('main_window_blur', () => {
      createMenu()
    })
  }
  global.lx.event_app.on('main_window_hide', () => {
    createMenu()
  })
  global.lx.event_app.on('main_window_close', () => {
    destroyTray()
  })

  global.lx.event_app.on('app_inited', () => {
    i18n.setLang(global.lx.appSetting['common.langId'])
    init()
  })

  global.lx.event_app.on('system_theme_change', () => {
    if (global.lx.appSetting['tray.themeId'] != TRAY_AUTO_ID) return
    setTrayImage(global.lx.appSetting['tray.themeId'])
  })

  global.lx.event_app.on('player_status', (status) => {
    let updated = false
    if (status.status) {
      switch (status.status) {
        case 'paused':
          playerState.play = false
          playerState.empty &&= false
          setLyric('')
          break
        case 'error':
          playerState.play = false
          playerState.empty &&= false
          setLyric('')
          break
        case 'playing':
          playerState.play = true
          playerState.empty &&= false
          setLyric(global.lx.player_status.lyricLineText)
          break
        case 'stoped':
          playerState.play &&= false
          playerState.empty = true
          setLyric('')
          break
      }
      updated = true
    } else {
      setLyric(status.lyricLineText)
    }
    if (status.name != null) setTip()
    if (status.singer != null) setTip()
    if (status.collect != null) {
      playerState.collect = status.collect
      updated = true
    }
    if (updated) init()
  })
}
