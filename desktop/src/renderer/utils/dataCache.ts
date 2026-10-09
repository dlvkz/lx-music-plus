// Cache of the data shown by the pages, kept between the runs of the app: a page shows what it
// showed last time at once, the new data replaces it when it has arrived.

const STORAGE_KEY = 'lx_data_cache'
const MAX_ENTRIES = 120
const SAVE_DELAY = 1500

interface Entry {
  time: number
  data: unknown
}

let entries: Record<string, Entry> = {}
try {
  entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
} catch {}
let saveTimeout: ReturnType<typeof setTimeout> | null = null

const save = () => {
  if (saveTimeout) return
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    // the oldest entries go first when there are too many
    const keys = Object.keys(entries).sort((a, b) => entries[a].time - entries[b].time)
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    for (const key of keys.slice(0, Math.max(keys.length - MAX_ENTRIES, 0))) delete entries[key]
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch (err) {
      console.log(err)
    }
  }, SAVE_DELAY)
}

export const getCache = <T>(key: string): T | null => (entries[key]?.data as T | undefined) ?? null
export const getCacheTime = (key: string): number => entries[key]?.time ?? 0
export const setCache = (key: string, data: unknown) => {
  // a plain copy: the pages hand reactive objects in, keeping those would tie their state together
  try {
    data = JSON.parse(JSON.stringify(data))
  } catch (err) {
    console.log(err)
    return
  }
  entries[key] = { time: Date.now(), data }
  save()
}
