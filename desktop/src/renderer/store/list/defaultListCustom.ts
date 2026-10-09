import fs from 'fs'
import { LIST_IDS } from '@common/constants'
import { appSetting, updateSetting } from '@renderer/store/setting'

// Custom display name / cover of the two built-in lists.
// Only the display changes: the lists keep their ids (default / love) and their
// i18n key names, so import / export / sync still treat them as built-in lists.
const SETTING_KEYS = {
  [LIST_IDS.DEFAULT]: { name: 'list.defaultListName', cover: 'list.defaultListCover' },
  [LIST_IDS.LOVE]: { name: 'list.loveListName', cover: 'list.loveListCover' },
} as const

type DefaultListId = keyof typeof SETTING_KEYS
const COVER_SIZE = 300

export const isDefaultListId = (id: string): id is DefaultListId => id in SETTING_KEYS

/**
 * Display name of a list, reactive when used in a computed / template
 */
export const getListDisplayName = (listInfo: { id: string, name: string }): string => {
  if (!isDefaultListId(listInfo.id)) return listInfo.name
  return appSetting[SETTING_KEYS[listInfo.id].name] || window.i18n.t(listInfo.name as Parameters<typeof window.i18n.t>[0])
}

export const getDefaultListCover = (id: string): string | null => {
  if (!isDefaultListId(id)) return null
  return appSetting[SETTING_KEYS[id].cover] || null
}

export const hasDefaultListCustom = (id: string): boolean => {
  if (!isDefaultListId(id)) return false
  return !!(appSetting[SETTING_KEYS[id].name] || appSetting[SETTING_KEYS[id].cover])
}

export const setDefaultListName = (id: string, name: string) => {
  if (!isDefaultListId(id)) return
  updateSetting({ [SETTING_KEYS[id].name]: name })
}

/**
 * Use a local image as the list cover, it is stored as a small square jpeg data url
 * so the cover keeps working if the picked file is moved or deleted
 */
export const setDefaultListCover = async(id: string, filePath: string) => {
  if (!isDefaultListId(id)) return
  updateSetting({ [SETTING_KEYS[id].cover]: await readImageAsCover(filePath) })
}

/**
 * Small square jpeg data url made of a local image
 */
export const readImageAsCover = async(filePath: string): Promise<string> => {
  const bitmap = await createImageBitmap(new Blob([await fs.promises.readFile(filePath)]))
  const size = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(size, COVER_SIZE)
  canvas.getContext('2d')!.drawImage(
    bitmap,
    (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size,
    0, 0, canvas.width, canvas.height,
  )
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

export const resetDefaultListCustom = (id: string) => {
  if (!isDefaultListId(id)) return
  updateSetting({ [SETTING_KEYS[id].name]: '', [SETTING_KEYS[id].cover]: '' })
}
