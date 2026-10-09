import { normalizeArtistName } from '@/utils/artistName'
import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'

// Collected albums and artists. As on Spotify they are not copied into a list: the library
// keeps a link to the page itself, which loads live when it is opened.

export interface Collection {
  type: 'album' | 'artist'
  /** album: source of the album; artist: the source the page was opened from, if any */
  source?: LX.OnlineSource
  /** album id, or the artist name */
  id: string
  name: string
  img: string | null
}

const STORAGE_KEY = '@collections'

let collections: Collection[] = []
const listeners = new Set<(list: Collection[]) => void>()
const initPromise = getData<Collection[]>(STORAGE_KEY).then(list => {
  collections = list ?? []
  notify()
})

const notify = () => {
  const list = [...collections]
  for (const listener of listeners) listener(list)
}
const save = () => {
  notify()
  void saveData(STORAGE_KEY, collections).catch(err => { console.log(err) })
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
  if (index > -1) collections.splice(index, 1)
  else collections.push({ ...collection })
  save()
  return index < 0
}

export const removeCollection = (collection: Collection) => {
  const key = keyOf(collection)
  const index = collections.findIndex(c => keyOf(c) == key)
  if (index < 0) return
  collections.splice(index, 1)
  save()
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
