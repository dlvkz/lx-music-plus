import { createContext, useContext, useEffect, useState } from 'react'
import { type NAV_ID_Type } from '@/config/constant'
import { type CollectionInfo } from '@/screens/Collection/data'
import { type ListInfoItem } from '@/store/songlist/state'
import commonState from '@/store/common/state'

// Pages opened inside the current tab (album, artist, chart, playlist...): they are shown in the tab,
// above the bottom bar, like a list opened in the library. Each tab keeps its own pages.

export type TabPage =
  | { id: string, type: 'collection', info: CollectionInfo }
  | { id: string, type: 'songlist', info: ListInfoItem }

export const TAB_PAGE_ID_PREFIX = 'tabpage_'

const stacks = new Map<NAV_ID_Type, TabPage[]>()
const listeners = new Set<() => void>()
let count = 0

const emit = () => {
  for (const listener of listeners) listener()
}

export const isTabPageId = (id: string) => id.startsWith(TAB_PAGE_ID_PREFIX)

export const getTabPages = (navId: NAV_ID_Type) => stacks.get(navId) ?? []

/**
 * Open a page in the current tab
 */
export const pushTabPage = (page: { type: 'collection', info: CollectionInfo } | { type: 'songlist', info: ListInfoItem }) => {
  const navId = commonState.navActiveId
  const newPage: TabPage = { ...page, id: `${TAB_PAGE_ID_PREFIX}${++count}` }
  const stack = [...getTabPages(navId), newPage]
  stacks.set(navId, stack)
  emit()
}

/**
 * Close a page (and the pages opened from it)
 */
export const popTabPage = (id: string) => {
  for (const [navId, stack] of stacks) {
    const index = stack.findIndex(p => p.id == id)
    if (index < 0) continue
    stacks.set(navId, stack.slice(0, index))
    emit()
    return
  }
}

/**
 * Close the last page of a tab
 * @returns whether there was one
 */
export const popLastTabPage = (navId: NAV_ID_Type) => {
  const stack = getTabPages(navId)
  if (!stack.length) return false
  stacks.set(navId, stack.slice(0, -1))
  emit()
  return true
}

/**
 * Close all the pages of a tab
 * @returns whether there were some
 */
export const clearTabPages = (navId: NAV_ID_Type) => {
  if (!getTabPages(navId).length) return false
  stacks.set(navId, [])
  emit()
  return true
}

export const useTabPages = (navId: NAV_ID_Type) => {
  const [pages, setPages] = useState(() => getTabPages(navId))
  useEffect(() => {
    const listener = () => { setPages(getTabPages(navId)) }
    listeners.add(listener)
    listener()
    return () => {
      listeners.delete(listener)
    }
  }, [navId])
  return pages
}

/**
 * Set for the pages shown in a tab: no status bar room / player bar of their own (the home screen has them)
 */
export const TabPageContext = createContext<{ embedded: boolean, isTop: boolean }>({ embedded: false, isTop: true })
export const useTabPageInfo = () => useContext(TabPageContext)
