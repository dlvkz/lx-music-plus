// The collected albums and artists for the sync (store/list/collections.ts; mobile: core/collect.ts, the same file in
// utils/collectionsSync.ts). Every album / artist the devices know is kept with the time it was last collected or
// removed: the latest change wins, a removal included, so the devices end up with the same collection whatever the
// order they meet in.

export interface SyncCollection {
  type: 'album' | 'artist'
  source?: string
  id: string
  name: string
  img: string | null
  /** when it was collected (ms), 0: before the sync knew of it */
  time?: number
}

export interface CollectionsSyncEntry {
  /** getCollectionKey() of the album / artist */
  key: string
  /** when it was collected / removed (ms) */
  time: number
  /** missing: removed */
  collection?: SyncCollection
}

/** what is sent (JSON) */
export interface CollectionsSyncData {
  entries: CollectionsSyncEntry[]
}

// how long a removal is remembered: a device away for longer gets back what it still has
export const REMOVED_KEEP_TIME = 365 * 86400000
export const REMOVED_MAX_COUNT = 2000

const isCollection = (c: any): c is SyncCollection => {
  return !!c && (c.type == 'album' || c.type == 'artist') && typeof c.id == 'string' && typeof c.name == 'string'
}

export const parseCollectionsSyncData = (data: string): CollectionsSyncEntry[] => {
  if (!data) return []
  try {
    const parsed = JSON.parse(data) as Partial<CollectionsSyncData> | null
    if (!Array.isArray(parsed?.entries)) return []
    return parsed.entries.filter(e => e && typeof e.key == 'string' && typeof e.time == 'number' && (e.collection == null || isCollection(e.collection)))
  } catch {
    return []
  }
}

export const stringifyCollectionsSyncData = (entries: CollectionsSyncEntry[]) => {
  const data: CollectionsSyncData = { entries }
  return JSON.stringify(data)
}

/**
 * The entries of two devices merged: per album / artist the latest change (the same time: collected wins)
 */
export const mergeCollectionsSyncEntries = (local: CollectionsSyncEntry[], remote: CollectionsSyncEntry[]): CollectionsSyncEntry[] => {
  const merged = new Map<string, CollectionsSyncEntry>()
  for (const entry of [...local, ...remote]) {
    const prev = merged.get(entry.key)
    if (!prev || entry.time > prev.time || (entry.time == prev.time && entry.collection && !prev.collection)) merged.set(entry.key, entry)
  }
  return Array.from(merged.values())
}

/**
 * The data (JSON) of two devices merged
 */
export const mergeCollectionsSyncData = (localData: string, remoteData: string) => {
  return stringifyCollectionsSyncData(mergeCollectionsSyncEntries(parseCollectionsSyncData(localData), parseCollectionsSyncData(remoteData)))
}

/**
 * The removals still remembered: the recent ones, at most REMOVED_MAX_COUNT
 */
export const pruneRemoved = (removed: Record<string, number>, now = Date.now()): Record<string, number> => {
  const entries = Object.entries(removed).filter(([, time]) => typeof time == 'number' && now - time < REMOVED_KEEP_TIME)
  entries.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(entries.slice(0, REMOVED_MAX_COUNT))
}
