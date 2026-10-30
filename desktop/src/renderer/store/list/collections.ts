import { normalizeArtistName } from '@renderer/utils/artistName'
import { reactive } from '@common/utils/vueTools'
import { mergeCollectionsSyncEntries, parseCollectionsSyncData, pruneRemoved, stringifyCollectionsSyncData, type CollectionsSyncEntry } from '@renderer/utils/collectionsSync'

// Collected albums and artists. As on Spotify they are not copied into a list: the library
// keeps a link to the page itself, which loads live when it is opened.
// They are synced with the other devices (utils/collectionsSync.ts, core/useApp/useCollectionsSync.ts)

export interface Collection {
  type: 'album' | 'artist'
  /** album: source of the album; artist: the source the page was opened from, if any */
  source?: string
  /** album id, or the artist name */
  id: string
  name: string
  img: string | null
  /** when it was collected (ms), 0: before the sync */
  time?: number
}

const STORAGE_KEY = 'lx_collections'
// the albums / artists removed, with the time (the sync gives the removal to the other devices)
const REMOVED_STORAGE_KEY = 'lx_collections_removed'

export const collections = reactive<Collection[]>([])
try {
  // one entry per album / artist: spellings of the same artist saved before are merged
  const keys = new Set<string>()
  for (const c of JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Collection[]) {
    if (!c || typeof c.id != 'string' || typeof c.name != 'string') continue
    const key = c.type == 'artist' ? `artist:${normalizeArtistName(c.id).toLowerCase()}` : `album:${c.source ?? ''}:${c.id}`
    if (keys.has(key)) continue
    keys.add(key)
    collections.push(c)
  }
} catch {}
let removed: Record<string, number> = {}
try {
  removed = pruneRemoved(JSON.parse(localStorage.getItem(REMOVED_STORAGE_KEY) ?? '{}') ?? {})
} catch {}

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
    localStorage.setItem(REMOVED_STORAGE_KEY, JSON.stringify(removed))
  } catch (err) {
    console.log(err)
  }
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

export const findCollection = (type: Collection['type'], source: string | undefined, id: string) => {
  const key = getCollectionKey(type, source, id)
  return collections.find(c => keyOf(c) == key)
}

export const isCollected = (type: Collection['type'], source: string | undefined, id: string) => !!findCollection(type, source, id)

/**
 * Collect the album / artist, or remove it when it is collected already
 */
// plain strings only: a reactive value slipping in here would break the sidebar
const toPlain = (collection: Collection, time: number): Collection => ({
  type: collection.type == 'artist' ? 'artist' : 'album',
  source: typeof collection.source == 'string' && collection.source ? collection.source : undefined,
  id: String(collection.id),
  name: String(collection.name),
  img: typeof collection.img == 'string' && collection.img ? collection.img : null,
  time,
})

export const toggleCollection = (collection: Collection) => {
  const key = keyOf(collection)
  const index = collections.findIndex(c => keyOf(c) == key)
  if (index > -1) {
    collections.splice(index, 1)
    removed[key] = Date.now()
    handleChanged()
    return false
  }
  collections.push(toPlain(collection, Date.now()))
  removed = Object.fromEntries(Object.entries(removed).filter(([k]) => k != key))
  handleChanged()
  return true
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
export const getCollectionsSyncData = () => stringifyCollectionsSyncData(getSyncEntries())

/**
 * The collection of another device (JSON) merged into this one: the latest change of each album / artist wins
 * @returns whether this one changed
 */
export const mergeCollectionsSyncData = (data: string) => {
  const merged = mergeCollectionsSyncEntries(getSyncEntries(), parseCollectionsSyncData(data))
  let changed = false
  const nextRemoved: Record<string, number> = {}
  const added: Collection[] = []
  for (const entry of merged) {
    const index = collections.findIndex(c => keyOf(c) == entry.key)
    if (entry.collection) {
      if (index < 0) {
        added.push(toPlain(entry.collection as Collection, entry.time))
        changed = true
      } else if ((collections[index].time ?? 0) < entry.time) {
        // (in its place)
        collections.splice(index, 1, toPlain(entry.collection as Collection, entry.time))
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
 * The picture of a collection is kept up to date with the one of its page
 */
export const updateCollectionImg = (type: Collection['type'], source: string | undefined, id: string, img: string | null | undefined, name?: string) => {
  const collection = findCollection(type, source, id)
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
