import { sendSyncAction } from '@main/modules/winMain'
import { mergeCollectionsSyncData } from '../../../renderer/utils/collectionsSync'

// The collected albums and artists for the sync: they are kept by the window (store/list/collections.ts), which gives
// them here when it starts and after every change (renderer: core/useApp/useSync.ts); the ones of the other devices
// are given to it to be merged

// how long the sync waits for the window to give them, when it starts first
const WAIT_TIMEOUT = 15000

let localData = ''
let resolveReceived: () => void
const received = new Promise<void>(resolve => {
  resolveReceived = resolve
})

/**
 * The collection of this device (JSON)
 */
export const getLocalCollectionsData = async(): Promise<string> => {
  await Promise.race([received, new Promise<void>(resolve => setTimeout(resolve, WAIT_TIMEOUT))])
  return localData
}

/**
 * The collection of the window (JSON), when it starts and after it merged the one of another device
 */
export const setLocalCollectionsData = (data: string) => {
  localData = data
  resolveReceived()
}

/**
 * The collection (JSON) of another device merged into the one of this device
 */
export const mergeRemoteCollectionsData = (data: string) => {
  localData = mergeCollectionsSyncData(localData, data)
  sendSyncAction({ action: 'collections_merge', data })
}

/**
 * The collection of this device merged with the one of another device (JSON); the window merges it too
 */
export const mergeLocalCollectionsData = async(remoteData: string): Promise<string> => {
  await getLocalCollectionsData()
  mergeRemoteCollectionsData(remoteData)
  return localData
}

const changeListeners = new Set<(data: string) => void>()
/**
 * The collection (JSON) when an album / artist is collected or removed here
 */
export const registerCollectionsChangedEvent = (listener: (data: string) => void) => {
  changeListeners.add(listener)
  return () => { changeListeners.delete(listener) }
}

export const handleLocalCollectionsChanged = (data: string) => {
  setLocalCollectionsData(data)
  for (const listener of changeListeners) listener(data)
}
