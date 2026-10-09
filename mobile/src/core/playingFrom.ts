import { useEffect, useState } from 'react'
import { LIST_IDS } from '@/config/constant'
import { RADIO_LIST_ID } from '@/core/player/playMethod'
import { getData, saveData } from '@/plugins/storage'
import listState from '@/store/list/state'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { getBuiltInListName, isBuiltInListId } from '@/utils/listName'
import { type CollectionInfo } from '@/screens/Collection/data'

// What the songs playing come from (the player shows it): a list of the library, or what the temporary list was
// made from (a playlist, an album, an artist, a chart, the radio...), kept by the id of the temporary list

export type PlayingFromType = 'list' | 'playlist' | 'album' | 'artist' | 'chart' | 'radio' | 'mix' | 'downloads' | 'stats'
/** the page it comes from (tapped: it opens), none: the radio */
export type PlayingFromTarget =
  | { kind: 'collection', info: CollectionInfo }
  | { kind: 'songlist', source: string, id: string, name: string }
  | { kind: 'list', id: string }
  | { kind: 'library', view: 'download' | 'stats' }
export interface PlayingFrom {
  type: PlayingFromType
  name: string
  target?: PlayingFromTarget
}

const STORAGE_KEY = '@playing_from'
const MAX_LABELS = 50

let labels = new Map<string, PlayingFrom>()
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}
void getData<Record<string, PlayingFrom>>(STORAGE_KEY).then(data => {
  if (!data) return
  labels = new Map([...Object.entries(data), ...labels])
  notify()
}).catch(() => {})

/**
 * What the temporary list is made from (called when it is played)
 */
export const setPlayingFrom = (tempId: string, type: PlayingFromType, name: string, target?: PlayingFromTarget) => {
  labels.delete(tempId)
  labels.set(tempId, { type, name, target })
  if (labels.size > MAX_LABELS) labels.delete(labels.keys().next().value!)
  void saveData(STORAGE_KEY, Object.fromEntries(labels)).catch(() => {})
  notify()
}

// the temporary lists named by their id
const fromTempId = (id: string): PlayingFrom | null => {
  if (id == RADIO_LIST_ID) return { type: 'radio', name: '' }
  if (id == 'recommend_daily_mix') return { type: 'mix', name: '', target: { kind: 'collection', info: { type: 'dailyMix' } } }
  if (id.startsWith('stats_')) return { type: 'stats', name: '', target: { kind: 'library', view: 'stats' } }
  if (id.startsWith('download')) return { type: 'downloads', name: '', target: { kind: 'library', view: 'download' } }
  if (id.startsWith('collection_album_')) return { type: 'album', name: '' }
  if (id.startsWith('collection_artist_')) return { type: 'artist', name: '' }
  if (id.startsWith('collection_chart_') || id.startsWith('board__')) return { type: 'chart', name: '' }
  return null
}

/**
 * What the list played (its id) comes from, null when it is not known
 */
export const getPlayingFrom = (listId: string | null): PlayingFrom | null => {
  if (!listId) return null
  if (listId == LIST_IDS.TEMP) {
    const id = listState.tempListMeta.id
    if (!id) return null
    return labels.get(id) ?? fromTempId(id)
  }
  if (listId == LIST_IDS.DOWNLOAD) return { type: 'downloads', name: '', target: { kind: 'library', view: 'download' } }
  if (isBuiltInListId(listId)) return { type: 'list', name: getBuiltInListName(listId), target: { kind: 'list', id: listId } }
  const list = listState.userList.find(l => l.id == listId)
  return list ? { type: 'list', name: list.name, target: { kind: 'list', id: listId } } : null
}

/**
 * What the song playing comes from, updated when it changes
 */
export const usePlayingFrom = () => {
  const playMusicInfo = usePlayMusicInfo()
  const [, setVersion] = useState(0)
  useEffect(() => {
    const update = () => { setVersion(version => version + 1) }
    listeners.add(update)
    return () => {
      listeners.delete(update)
    }
  }, [])
  const playInfo = usePlayInfo()
  // (the list played: known before its song plays, after a restart)
  return getPlayingFrom(playMusicInfo.listId ?? playInfo.playerListId)
}
