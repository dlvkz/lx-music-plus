import { getData, getDataMultiple, removeDataMultiple, saveData } from '@/plugins/storage'

// Cache of the data shown by the pages (home sections, charts, playlists, opened albums / playlists...).
// It is kept between the runs of the app: a page shows what it showed last time at once,
// the new data replaces it when it has arrived.
//
// The small entries are read when the app starts and can be read synchronously, the entries of
// the detail pages (keys starting with `detail:`) are read when their page opens.

const INDEX_KEY = '@data_cache_index'
const KEY_PREFIX = '@data_cache__'
const DETAIL_PREFIX = 'detail:'
const MAX_ENTRIES = 30
const MAX_DETAIL_ENTRIES = 40
const SAVE_INDEX_DELAY = 1500

interface Entry {
  time: number
  data: unknown
}

const cache = new Map<string, Entry>()
// least recently used first
let keys: string[] = []
let saveIndexTimeout: ReturnType<typeof setTimeout> | null = null

const isDetailKey = (key: string) => key.startsWith(DETAIL_PREFIX)

const saveIndex = () => {
  if (saveIndexTimeout) return
  saveIndexTimeout = setTimeout(() => {
    saveIndexTimeout = null
    void saveData(INDEX_KEY, keys).catch(() => {})
  }, SAVE_INDEX_DELAY)
}

const touch = (key: string) => {
  const index = keys.indexOf(key)
  if (index == keys.length - 1 && index > -1) return
  if (index > -1) keys.splice(index, 1)
  keys.push(key)

  // drop the oldest entries of the kind that is over its limit
  const isDetail = isDetailKey(key)
  const sameKindKeys = keys.filter(k => isDetailKey(k) == isDetail)
  const removeKeys = sameKindKeys.slice(0, Math.max(sameKindKeys.length - (isDetail ? MAX_DETAIL_ENTRIES : MAX_ENTRIES), 0))
  if (removeKeys.length) {
    keys = keys.filter(k => !removeKeys.includes(k))
    for (const k of removeKeys) cache.delete(k)
    void removeDataMultiple(removeKeys.map(k => KEY_PREFIX + k)).catch(() => {})
  }
  saveIndex()
}

/**
 * Read the small entries, called once when the app starts
 */
export const initDataCache = async() => {
  try {
    keys = (await getData<string[]>(INDEX_KEY)) ?? []
    const eagerKeys = keys.filter(key => !isDetailKey(key))
    if (!eagerKeys.length) return
    const datas = await getDataMultiple(eagerKeys.map(key => KEY_PREFIX + key))
    datas.forEach(([, value], index) => {
      if (value) cache.set(eagerKeys[index], value as Entry)
    })
  } catch (err) {
    console.log(err)
  }
}

/**
 * Cached data, null when there is none (or when it is a detail entry that is not read yet)
 */
export const getCache = <T>(key: string): T | null => {
  return (cache.get(key)?.data as T | undefined) ?? null
}

/**
 * Time the entry was saved at, 0 when there is none
 */
export const getCacheTime = (key: string): number => cache.get(key)?.time ?? 0

/**
 * Cached data of a detail page, read from the storage when needed
 */
export const loadCache = async<T>(key: string): Promise<T | null> => {
  const entry = cache.get(key)
  if (entry) return entry.data as T
  if (!keys.includes(key)) return null
  try {
    const saved = await getData<Entry>(KEY_PREFIX + key)
    if (!saved) return null
    // a newer one may have been set while reading
    if (!cache.has(key)) cache.set(key, saved)
    return cache.get(key)!.data as T
  } catch (err) {
    console.log(err)
    return null
  }
}

export const setCache = (key: string, data: unknown) => {
  const entry: Entry = { time: Date.now(), data }
  cache.set(key, entry)
  touch(key)
  void saveData(KEY_PREFIX + key, entry).catch(() => {})
}
