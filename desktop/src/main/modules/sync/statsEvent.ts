import fs from 'fs'
import path from 'path'
import { sendSyncAction } from '@main/modules/winMain'
import { mergeListenStatsData } from '../../../renderer/utils/listenStats'

// The listening stats for the sync: the log is kept by the window (utils/listenStats.ts, its file is in the
// data folder), the plays of the other devices are given to it to be merged; the plays it records come here
// (renderer: useListenStats) to be sent to the other devices

const getStatsFile = () => path.join(global.lxDataPath, 'listen_stats.json')

/**
 * The log of this device (JSON, as last saved)
 */
export const getLocalStatsData = async(): Promise<string> => {
  return fs.promises.readFile(getStatsFile(), 'utf8').catch(() => '')
}

/**
 * The log (JSON) of another device merged into the one of this device
 */
export const mergeRemoteStatsData = (data: string) => {
  sendSyncAction({ action: 'stats_merge', data })
}

/**
 * The log of this device merged with the one of another device (JSON); the window merges it too
 */
export const mergeLocalStatsData = async(remoteData: string): Promise<string> => {
  const localData = await getLocalStatsData()
  mergeRemoteStatsData(remoteData)
  return mergeListenStatsData(localData, remoteData)
}

const changeListeners = new Set<(delta: string) => void>()
/**
 * The plays recorded here (JSON), when the window saves its log
 */
export const registerStatsChangedEvent = (listener: (delta: string) => void) => {
  changeListeners.add(listener)
  return () => { changeListeners.delete(listener) }
}

export const handleLocalStatsChanged = (delta: string) => {
  for (const listener of changeListeners) listener(delta)
}
