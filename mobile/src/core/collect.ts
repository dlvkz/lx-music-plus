import { normalizeArtistName } from '@/utils/artistName'
import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { mergeCollectionsSyncEntries, parseCollectionsSyncData, pruneRemoved, stringifyCollectionsSyncData, type CollectionsSyncEntry } from '@/utils/collectionsSync'

// Collected albums and artists. As on Spotify they are not copied into a list: the library
// keeps a link to the page itself, which loads live when it is opened.
// They are synced with the other devices (utils/collectionsSync.ts, plugins/sync/client/modules/collections)

export interface Collection {
  type: 'album' | 'artist'
  /** album: source of the album; artist: the source the page was opened from, if any */
  source?: LX.OnlineSource
  /** album id, or the artist name */
  id: string
  name: string
  img: string | null
  /** when it was collected (ms), 0: before the sync */
  time?: number
}

const STORAGE_KEY = '@collections'
// the albums / artists removed, with the time (the sync gives the removal to the other devices)
const REMOVED_STORAGE_KEY = '@collections_removed'

let collections: Collection[] = []
let removed: Record<string, number> = {}
const listeners = new Set<(list: Collection[]) => void>()
const initPromise = Promise.all([
  getData<Collection[]>(STORAGE_KEY).then(list => {
    collections = list ?? []
  }),
  getData<Record<string, number>>(REMOVED_STORAGE_KEY).then(data => {
    removed = pruneRemoved(data ?? {})
  }),
]).then(() => {
  notify()
}).catch(err => {
  console.log(err)
})

const notify = () => {
  const list = [...collections]
  for (const listener of listeners) listener(list)
}
const save = () => {
  notify()
  void saveData(STORAGE_KEY, collections).catch(err => { console.log(err) })
  void saveData(REMOVED_STORAGE_KEY, removed).catch(err => { console.log(err) })
}

// the changes made here (an album / artist collected or removed), for the sync
const changedListeners = new Set<() => void>()
const handleChanged = () => {
  save()
  for (const listener of changedListeners) listener()
}
export const onCollectionsChanged = (listener: () => void) => {
  changedListeners.add(listener)
  return () => { changedListeners.delete(listener) }
}

export const getCollectionKey = (type: Collection['type'], source: string | undefined, id: string) => {
  return type == 'artist' ? `artist:${normalizeArtistName(id).toLowerCase()}` : `album:${source ?? ''}:${id}`
}
const keyOf = (c: Collection) => getCollectionKey(c.type, c.source, c.id)

export const isCollected = (type: Collection['type'], source: string | undefined, id: string) => {
  const key = getCollectionKey(type, source, id)
  return collections.some(c => keyOf(c) == key)
}

/**
 * Collect the album / artist, or remove it when it is collected already
 */
export const toggleCollection = (collection: Collection) => {
  const key = keyOf(collection)
  const index = collections.findIndex(c => keyOf(c) == key)
  if (index > -1) {
    collections.splice(index, 1)
    removed[key] = Date.now()
  } else {
    collections.push({ ...collection, time: Date.now() })
    removed = Object.fromEntries(Object.entries(removed).filter(([k]) => k != key))
  }
  handleChanged()
  return index < 0
}

export const removeCollection = (collection: Collection) => {
  const key = keyOf(collection)
  const index = collections.findIndex(c => keyOf(c) == key)
  if (index < 0) return
  collections.splice(index, 1)
  removed[key] = Date.now()
  handleChanged()
}

const getSyncEntries = (): CollectionsSyncEntry[] => [
  ...collections.map(c => ({ key: keyOf(c), time: c.time ?? 0, collection: { ...c } })),
  ...Object.entries(removed).map(([key, time]) => ({ key, time })),
]

/**
 * The collection of this device for the sync (JSON)
 */
export const getCollectionsSyncData = async() => {
  await initPromise
  return stringifyCollectionsSyncData(getSyncEntries())
}

/**
 * The collection of another device (JSON) merged into this one: the latest change of each album / artist wins
 */
export const mergeCollectionsSyncData = async(data: string) => {
  await initPromise
  const merged = mergeCollectionsSyncEntries(getSyncEntries(), parseCollectionsSyncData(data))
  let changed = false
  const nextRemoved: Record<string, number> = {}
  const added: Collection[] = []
  for (const entry of merged) {
    const index = collections.findIndex(c => keyOf(c) == entry.key)
    if (entry.collection) {
      const collection: Collection = { ...entry.collection as Collection, time: entry.time }
      if (index < 0) {
        added.push(collection)
        changed = true
      } else if ((collections[index].time ?? 0) < entry.time) {
        // (in its place)
        collections.splice(index, 1, collection)
        changed = true
      }
    } else {
      nextRemoved[entry.key] = entry.time
      if (index > -1) {
        collections.splice(index, 1)
        changed = true
      }
    }
  }
  // the ones new here at the end, the oldest first
  added.sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
  collections.push(...added)
  const prunedRemoved = pruneRemoved(nextRemoved)
  if (Object.keys(prunedRemoved).length != Object.keys(removed).length) changed = true
  removed = prunedRemoved
  if (changed) save()
  return changed
}

/**
 * The picture and name of a collection follow the ones of its page
 */
export const updateCollection = (type: Collection['type'], source: string | undefined, id: string, img: string | null | undefined, name?: string) => {
  const key = getCollectionKey(type, source, id)
  const collection = collections.find(c => keyOf(c) == key)
  if (!collection) return
  let changed = false
  if (img && collection.img != img) {
    collection.img = img
    changed = true
  }
  if (name && collection.name != name) {
    collection.name = name
    changed = true
  }
  if (changed) save()
}

export const useCollections = () => {
  const [list, setList] = useState(() => [...collections])
  useEffect(() => {
    listeners.add(setList)
    void initPromise.then(() => { setList([...collections]) })
    return () => {
      listeners.delete(setList)
    }
  }, [])
  return list
}
