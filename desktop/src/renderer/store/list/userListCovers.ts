import { reactive } from '@common/utils/vueTools'
import { readImageAsCover } from '@renderer/store/list/defaultListCustom'

// Covers of the user's lists: the picture of the collected playlist, or an image picked by the
// user. Kept apart from the list infos, which are shared with the sync / backup formats.
const STORAGE_KEY = 'lx_user_list_covers'

const covers = reactive<Record<string, string>>({})
try {
  Object.assign(covers, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'))
} catch {}

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(covers))
  } catch (err) {
    console.log(err)
  }
}

export const getUserListCover = (listId: string): string | null => covers[listId] ?? null
export const hasUserListCover = (listId: string) => !!covers[listId]

export const setUserListCover = (listId: string, cover: string | null) => {
  if (cover) covers[listId] = cover
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  else if (listId in covers) delete covers[listId]
  else return
  save()
}

/**
 * Use a local image as the cover of the list
 */
export const setUserListCoverFromFile = async(listId: string, filePath: string) => {
  setUserListCover(listId, await readImageAsCover(filePath))
}
