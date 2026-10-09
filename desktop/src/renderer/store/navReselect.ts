import { onBeforeUnmount } from '@common/utils/vueTools'

// A click on the sidebar section that is already open: the section goes back to its start
// (like the bottom tabs of the mobile app)

const listeners = new Map<string, Set<() => void>>()

export const emitNavReselect = (path: string) => {
  for (const listener of listeners.get(path) ?? []) listener()
}

export const useNavReselect = (path: string, handler: () => void) => {
  let set = listeners.get(path)
  if (!set) listeners.set(path, set = new Set())
  set.add(handler)
  onBeforeUnmount(() => {
    listeners.get(path)?.delete(handler)
  })
}
