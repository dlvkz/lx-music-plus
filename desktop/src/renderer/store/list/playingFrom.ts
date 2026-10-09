import { ref } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { RADIO_LIST_ID } from '@renderer/core/player/playMethod'
import { getListDisplayName } from './defaultListCustom'
import { defaultList, loveList, tempListMeta, userLists } from './state'

// What the songs playing come from (the queue shows it): a list of the library, or what the temporary list was
// made from (a playlist, an album, an artist, a chart, the radio...), kept by the id of the temporary list

export type PlayingFromType = 'list' | 'playlist' | 'album' | 'artist' | 'chart' | 'radio' | 'mix' | 'downloads' | 'stats'
/** the page it comes from (the queue opens it), none: the radio */
export interface PlayingFromRoute {
  path: string
  query?: Record<string, string>
}
export interface PlayingFrom {
  type: PlayingFromType
  name: string
  route?: PlayingFromRoute
}

const STORAGE_KEY = 'lx_playing_from'
const MAX_LABELS = 50

let labels = new Map<string, PlayingFrom>()
try {
  labels = new Map(Object.entries(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, PlayingFrom>))
} catch {}
// (the labels are not reactive: a change of them updates this)
const version = ref(0)

/**
 * What the temporary list is made from (called when it is played)
 */
export const setPlayingFrom = (tempId: string, type: PlayingFromType, name: string, route?: PlayingFromRoute) => {
  labels.delete(tempId)
  labels.set(tempId, { type, name, route })
  if (labels.size > MAX_LABELS) labels.delete(labels.keys().next().value!)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(labels)))
  } catch {}
  version.value++
}

// the temporary lists named by their id
const fromTempId = (id: string): PlayingFrom | null => {
  if (id == RADIO_LIST_ID) return { type: 'radio', name: '' }
  if (id == 'recommend_daily_mix') return { type: 'mix', name: '', route: { path: '/dailyMix' } }
  if (id.startsWith('stats_')) return { type: 'stats', name: '', route: { path: '/stats' } }
  if (id.startsWith('download')) return { type: 'downloads', name: '', route: { path: '/download' } }
  if (id.startsWith('album_')) return { type: 'album', name: '' }
  if (id.startsWith('artist_')) return { type: 'artist', name: '' }
  if (id.startsWith('board__')) return { type: 'chart', name: '' }
  return null
}

/**
 * What the list played (its id) comes from, null when it is not known
 */
export const getPlayingFrom = (listId: string | null): PlayingFrom | null => {
  void version.value
  if (!listId) return null
  if (listId == LIST_IDS.TEMP) {
    const id = tempListMeta.id
    if (!id) return null
    return labels.get(id) ?? fromTempId(id)
  }
  if (listId == LIST_IDS.DOWNLOAD) return { type: 'downloads', name: '', route: { path: '/download' } }
  const list = listId == defaultList.id ? defaultList : listId == loveList.id ? loveList : userLists.find(l => l.id == listId)
  return list ? { type: 'list', name: getListDisplayName(list), route: { path: '/list', query: { id: listId } } } : null
}
