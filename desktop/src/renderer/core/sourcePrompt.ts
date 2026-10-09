import router from '@renderer/router'
import { dialog } from '@renderer/plugins/Dialog'
import { userApi } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { getSourceName, isMissingSource } from '@renderer/utils/sourceAddons'

// A song that nothing installed can play (no source addon for its platform, no Music API for the Chinese ones):
// the user is told and sent to Settings → Sources

/**
 * The name of the platform of a song that nothing installed can play, else null
 */
export const getMissingSourceName = (musicInfo: LX.Music.MusicInfo): string | null => {
  const hasMusicApi = userApi.list.some(api => api.id == appSetting['common.apiSource'])
  if (!isMissingSource(musicInfo.source, hasMusicApi)) return null
  return getSourceName(musicInfo.source, String(window.i18n.locale ?? ''))
}

// a section of the settings to show while they are open (the settings page listens)
const sectionListeners = new Set<(name: string) => void>()
export const onSettingSection = (listener: (name: string) => void) => {
  sectionListeners.add(listener)
  return () => { sectionListeners.delete(listener) }
}
export const showSettingSection = async(name: string) => {
  if (router.currentRoute.value.path == '/setting' && sectionListeners.size) {
    for (const listener of sectionListeners) listener(name)
    return
  }
  await router.push({ path: '/setting', query: { name } }).catch(() => {})
}

let isShowing = false
/**
 * The pop-up that leads to the sources (one at a time)
 */
export const showNoSourceDialog = async(platform: string) => {
  if (isShowing) return
  isShowing = true
  const isOpen = await dialog.confirm({
    message: `${window.i18n.t('player__no_source_title')}\n\n${window.i18n.t('player__no_source', { platform })}`,
    cancelButtonText: window.i18n.t('player__no_source_later'),
    confirmButtonText: window.i18n.t('player__no_source_open'),
  }).finally(() => {
    isShowing = false
  })
  if (isOpen) await showSettingSection('SettingAddons')
}
