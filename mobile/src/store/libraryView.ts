import { useEffect, useState } from 'react'

// Whether the library shows one of its lists (or the downloads) instead of the grid:
// the opened list has its own header, so the page title is hidden then.

let isOpened = false
const listeners = new Set<(isOpened: boolean) => void>()

export const setLibraryListOpened = (opened: boolean) => {
  if (isOpened == opened) return
  isOpened = opened
  for (const listener of listeners) listener(opened)
}

// Whether the opened list has been scrolled down: its header shrinks to a bar then
let isScrolled = false
const scrollListeners = new Set<(isScrolled: boolean) => void>()

export const setLibraryListScrolled = (scrolled: boolean) => {
  if (isScrolled == scrolled) return
  isScrolled = scrolled
  for (const listener of scrollListeners) listener(scrolled)
}

export const useLibraryListScrolled = () => {
  const [scrolled, setScrolled] = useState(isScrolled)
  useEffect(() => {
    scrollListeners.add(setScrolled)
    setScrolled(isScrolled)
    return () => {
      scrollListeners.delete(setScrolled)
    }
  }, [])
  return scrolled
}

export const useLibraryListOpened = () => {
  const [opened, setOpened] = useState(isOpened)
  useEffect(() => {
    listeners.add(setOpened)
    setOpened(isOpened)
    return () => {
      listeners.delete(setOpened)
    }
  }, [])
  return opened
}
