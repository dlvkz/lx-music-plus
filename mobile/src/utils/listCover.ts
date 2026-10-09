import { useEffect, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'

// Covers of the collected playlists: a collected list keeps the picture of the playlist it comes from.
// Kept apart from the list infos, which are shared with the sync / backup formats.

const LIST_COVERS_KEY = '@list_covers'

let covers: Record<string, string> | null = null
let loadPromise: Promise<Record<string, string>> | null = null
const listeners = new Set<() => void>()

const loadCovers = async() => {
  if (covers) return covers
  loadPromise ??= getData<Record<string, string>>(LIST_COVERS_KEY).then(data => {
    covers = data ?? {}
    return covers
  })
  return loadPromise
}

const notify = () => {
  for (const listener of listeners) listener()
}

export const setListCover = async(listId: string, cover: string | null | undefined) => {
  const covers = await loadCovers()
  if (cover) {
    if (covers[listId] == cover) return
    covers[listId] = cover
  } else {
    if (!(listId in covers)) return
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete covers[listId]
  }
  await saveData(LIST_COVERS_KEY, covers)
  notify()
}

/**
 * Whether a cover is saved for the list (as far as the covers are loaded)
 */
export const hasListCover = (listId: string) => !!covers?.[listId]

/**
 * Cover saved for a list, null when it has none
 */
export const useListCover = (listId: string): string | null => {
  const [cover, setCover] = useState<string | null>(covers?.[listId] ?? null)
  useEffect(() => {
    let isUnmounted = false
    const update = () => {
      void loadCovers().then(covers => {
        if (!isUnmounted) setCover(covers[listId] ?? null)
      })
    }
    update()
    listeners.add(update)
    return () => {
      isUnmounted = true
      listeners.delete(update)
    }
  }, [listId])
  return cover
}
