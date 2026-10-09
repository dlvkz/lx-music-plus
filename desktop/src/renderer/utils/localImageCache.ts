import { reactive } from '@common/utils/vueTools'

// Small local copies of pictures that come from slow servers (the chart covers): they are kept in
// IndexedDB and shown from there, the picture of the server is only downloaded once.

const DB_NAME = 'lx_image_cache'
const STORE = 'images'
const SIZE = 300

/** local picture of a remote one, by its url */
export const localImages = reactive<Record<string, string>>({})

let dbPromise: Promise<IDBDatabase> | null = null
const openDb = async() => {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => { resolve(req.result) }
    req.onerror = () => { reject(req.error) }
  })
  return dbPromise
}

const loaded = new Set<string>()
const saving = new Set<string>()

/**
 * Make the local copies of these pictures available in `localImages`, the missing ones are saved
 */
export const loadLocalImages = async(urls: Array<string | null | undefined>) => {
  const list = urls.filter((url): url is string => !!url && !loaded.has(url))
  if (!list.length) return
  for (const url of list) loaded.add(url)
  let db: IDBDatabase
  try {
    db = await openDb()
  } catch (err) {
    console.log(err)
    return
  }
  const missing: string[] = []
  await Promise.all(list.map(async url => new Promise<void>(resolve => {
    const req = db.transaction(STORE).objectStore(STORE).get(url)
    req.onsuccess = () => {
      const blob = req.result as Blob | undefined
      if (blob) localImages[url] = URL.createObjectURL(blob)
      else missing.push(url)
      resolve()
    }
    req.onerror = () => {
      missing.push(url)
      resolve()
    }
  })))
  for (const url of missing) void saveLocalImage(db, url)
}

const saveLocalImage = async(db: IDBDatabase, url: string) => {
  if (saving.has(url)) return
  saving.add(url)
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const bitmap = await createImageBitmap(await res.blob())
    const scale = Math.min(1, SIZE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/webp', 0.86) })
    if (!blob) return
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(blob, url)
      tx.oncomplete = () => { resolve() }
      tx.onerror = () => { reject(tx.error) }
    })
    // shown from the next visit: the picture of the server is on screen already
  } catch (err) {
    console.log(err)
    // tried again the next time
    loaded.delete(url)
  } finally {
    saving.delete(url)
  }
}
