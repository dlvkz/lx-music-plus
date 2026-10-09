import { state as userApiState } from '@/store/userApi'
import settingState from '@/store/setting/state'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import { popToRoot } from '@/navigation'
import { confirmDialog } from '@/utils/tools'
import { getSourceName, isMissingSource } from '@/utils/sourceAddons'
import type { SettingScreenIds } from '@/screens/Home/Views/Setting/Main'

// A song that nothing installed can play (no source addon for its platform, no Music API for the Chinese ones):
// the user is told and sent to Settings → Sources

/**
 * The name of the platform of a song that nothing installed can play, else null
 */
export const getMissingSourceName = (musicInfo: LX.Music.MusicInfo): string | null => {
  const hasMusicApi = userApiState.list.some(api => api.id == settingState.setting['common.apiSource'])
  if (!isMissingSource(musicInfo.source, hasMusicApi)) return null
  return getSourceName(musicInfo.source, String(global.i18n.locale ?? ''))
}

// a section of the settings to show (the settings screen scrolls to it, now or once it is open)
const sectionListeners = new Set<(id: SettingScreenIds) => void>()
let pendingSection: SettingScreenIds | null = null
export const onSettingSection = (listener: (id: SettingScreenIds) => void) => {
  sectionListeners.add(listener)
  if (pendingSection) {
    listener(pendingSection)
    pendingSection = null
  }
  return () => { sectionListeners.delete(listener) }
}
export const showSettingSection = (id: SettingScreenIds) => {
  global.lx.settingActiveId = id
  if (sectionListeners.size) {
    for (const listener of sectionListeners) listener(id)
  } else pendingSection = id
  if (commonState.componentIds.home) void popToRoot(commonState.componentIds.home).catch(() => {})
  setNavActiveId('nav_setting')
}

let isShowing = false
/**
 * The pop-up that leads to the sources (one at a time)
 */
export const showNoSourceDialog = async(platform: string) => {
  if (isShowing) return
  isShowing = true
  const isOpen = await confirmDialog({
    title: global.i18n.t('player__no_source_title'),
    message: global.i18n.t('player__no_source', { platform }),
    cancelButtonText: global.i18n.t('player__no_source_later'),
    confirmButtonText: global.i18n.t('player__no_source_open'),
  }).finally(() => {
    isShowing = false
  })
  if (isOpen) showSettingSection('addons')
}
