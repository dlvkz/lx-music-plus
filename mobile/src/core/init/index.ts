import { initDownload } from '@/core/download'
import { initSetting, setLanguage } from '@/core/common'
import { showDialog, showPactModal } from '@/navigation/utils'
import { langList } from '@/lang'
import { getData, saveData } from '@/plugins/storage'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import { initDataCache } from '@/utils/dataCache'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { checkUpdate } from '@/core/version'
import { bootLog } from '@/utils/bootLog'

const LANGUAGE_PICKED_KEY = '@language_picked'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  // first run: the language, then the licence agreement in that language (accepting it checks for updates)
  await pickLanguage()
  if (isFirstPush) {
    isFirstPush = false
    void initDownload()
    if (settingState.setting['common.isAgreePact']) {
      void checkUpdate()
      void initDeeplink()
    } else showPactModal()
  }
}

/**
 * First run: ask for the language right away
 */
const pickLanguage = async() => {
  if (await getData<boolean>(LANGUAGE_PICKED_KEY)) return
  const locale = await showDialog<(typeof langList)[number]['locale']>({
    title: 'Language / 语言',
    vertical: true,
    bgClose: false,
    buttons: langList.map(lang => ({ text: lang.name, value: lang.locale, primary: lang.locale == global.i18n.locale })),
  })
  if (locale && locale != global.i18n.locale) setLanguage(locale)
  void saveData(LANGUAGE_PICKED_KEY, true)
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  await initDataCache()
  bootLog('Data cache inited.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(settingState.setting['common.apiSource'])
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
