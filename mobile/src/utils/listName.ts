import { LIST_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'

// Custom display name / cover of the two built-in lists (loved, play history).
// Only the display changes: the lists keep their ids, so backup / sync still treat them as built-in lists.

export const DEFAULT_LIST_SETTING_KEYS = {
  [LIST_IDS.DEFAULT]: { name: 'list.defaultListName', cover: 'list.defaultListCover', label: 'list_name_default' },
  [LIST_IDS.LOVE]: { name: 'list.loveListName', cover: 'list.loveListCover', label: 'list_name_love' },
} as const

export const isBuiltInListId = (id: string): id is keyof typeof DEFAULT_LIST_SETTING_KEYS => id in DEFAULT_LIST_SETTING_KEYS

/**
 * Name of a built-in list: the one set by the user, the translated default otherwise
 */
export const getBuiltInListName = (id: keyof typeof DEFAULT_LIST_SETTING_KEYS): string => {
  const keys = DEFAULT_LIST_SETTING_KEYS[id]
  return settingState.setting[keys.name] || global.i18n.t(keys.label)
}

export const getBuiltInListCover = (id: string): string | null => {
  if (!isBuiltInListId(id)) return null
  return settingState.setting[DEFAULT_LIST_SETTING_KEYS[id].cover] || null
}
