import { normalizeArtistName } from '@renderer/utils/artistName'
import { reactive } from '@common/utils/vueTools'

// Collected albums and artists. As on Spotify they are not copied into a list: the library
// keeps a link to the page itself, which loads live when it is opened.

export interface Collection {
  type: 'album' | 'artist'
  /** album: source of the album; artist: the source the page was opened from, if any */
  source?: string
  /** album id, or the artist name */
  id: string
  name: string
  img: string | null
}

const STORAGE_KEY = 'lx_collections'

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

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
  } catch (err) {
    console.log(err)
  }
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
export const toggleCollection = (collection: Collection) => {
  const key = keyOf(collection)
  const index = collections.findIndex(c => keyOf(c) == key)
  if (index > -1) {
    collections.splice(index, 1)
    save()
    return false
  }
  // plain strings only: a reactive value slipping in here would break the sidebar
  collections.push({
    type: collection.type == 'artist' ? 'artist' : 'album',
    source: typeof collection.source == 'string' && collection.source ? collection.source : undefined,
    id: String(collection.id),
    name: String(collection.name),
    img: typeof collection.img == 'string' && collection.img ? collection.img : null,
  })
  save()
  return true
}

export const removeCollection = (collection: Collection) => {
  const key = keyOf(collection)
  const index = collections.findIndex(c => keyOf(c) == key)
  if (index < 0) return
  collections.splice(index, 1)
  save()
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
