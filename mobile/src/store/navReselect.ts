import { useEffect, useRef } from 'react'
import { type NAV_ID_Type } from '@/config/constant'
import { clearTabPages } from '@/store/tabPages'

// A press on the tab that is already open: the tab goes back to its start (closes what is opened
// in it, scrolls to the top, refreshes when it is there already)

const listeners = new Map<NAV_ID_Type, Set<() => void>>()

export const emitNavReselect = (id: NAV_ID_Type) => {
  // the pages opened in the tab (album, playlist...) are closed first
  if (clearTabPages(id)) return
  for (const listener of listeners.get(id) ?? []) listener()
}

export const useNavReselect = (id: NAV_ID_Type, handler: () => void) => {
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    const listener = () => { handlerRef.current() }
    let set = listeners.get(id)
    if (!set) listeners.set(id, set = new Set())
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }, [id])
}
