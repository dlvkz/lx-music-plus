import { computed, ref, watch, onBeforeUnmount, type Ref } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getListMusics } from '@renderer/store/list/action'
import { downloadList, downloadStatus } from './state'
import { getDownloadList, createDownloadTasks, startDownloadTasks, checkBatchDownload } from './action'

// "Keep downloaded" lists: all their songs are downloaded,
// songs added to them later are downloaded automatically.

export const syncListIds = computed(() => {
  const ids = appSetting['download.syncListIds']
  return ids ? ids.split(',') : []
})

export const isSyncList = (listId: string) => syncListIds.value.includes(listId)

/**
 * ids of the songs that have a download task (finished or not)
 */
export const downloadedIds = computed(() => {
  const ids = new Set<string>()
  for (const task of downloadList) ids.add(task.metadata.musicInfo.id)
  return ids
})

export interface DownloadState {
  /** some of the songs are waiting or downloading */
  downloading: boolean
  /** how far the downloads have gone, 0 - 1 */
  progress: number
  /** all the songs are downloaded */
  done: boolean
  /** download tasks of the songs, done or not: the group is (partly) downloaded when there are some */
  taskIds: string[]
  /** number of downloaded songs / of songs */
  completed: number
  total: number
  /** part of the songs that is downloaded when only some of them are and nothing is downloading, null otherwise */
  partial: number | null
}
const getDownloadState = (ids: string[]): DownloadState => {
  const tasks = new Map<string, LX.Download.ListItem>()
  for (const task of downloadList) tasks.set(task.metadata.musicInfo.id, task)
  let progress = 0
  let completed = 0
  let downloading = false
  const taskIds: string[] = []
  for (const id of ids) {
    const task = tasks.get(id)
    if (!task) continue
    taskIds.push(task.id)
    if (task.isComplate) {
      completed++
      progress += 1
      continue
    }
    if (task.status == downloadStatus.RUN || task.status == downloadStatus.WAITING) downloading = true
    progress += (task.progress ?? 0) / 100
  }
  const total = ids.length
  // downloaded only when all its songs are, partly downloaded otherwise
  const done = total > 0 && completed == total
  return {
    downloading,
    progress: total ? progress / total : 0,
    done,
    taskIds,
    completed,
    total,
    partial: taskIds.length && !downloading && !done ? completed / total : null,
  }
}

/**
 * Download state of a group of songs (an album, a playlist): whether some of them are downloading,
 * how far the downloads have gone and whether all of them are downloaded
 */
export const useDownloadState = (getList: () => LX.Music.MusicInfo[] | null | undefined) => {
  // the download tasks are loaded once, when a page first needs them
  void getDownloadList()
  return computed(() => getDownloadState((getList() ?? []).filter(m => m.source != 'local').map(m => m.id)))
}

/**
 * Download state of one of the user's lists
 * @param listId the list, null when there is none to check
 */
export const useListDownloadState = (listId: Ref<string | null>) => {
  void getDownloadList()
  const ids = ref<string[]>([])
  const load = () => {
    const id = listId.value
    if (!id) {
      ids.value = []
      return
    }
    void getListMusics(id).then(list => {
      if (listId.value == id) ids.value = list.filter(m => m.source != 'local').map(m => m.id)
    })
  }
  const handleUpdate = (updated: string[]) => {
    if (listId.value && updated.includes(listId.value)) load()
  }
  watch(listId, load, { immediate: true })
  window.app_event.on('myListUpdate', handleUpdate)
  onBeforeUnmount(() => {
    window.app_event.off('myListUpdate', handleUpdate)
  })
  return computed(() => getDownloadState(ids.value))
}

/**
 * Download songs with the default quality, songs that are already downloaded are skipped
 * @returns the number of new downloads
 */
export const downloadMusics = async(list: LX.Music.MusicInfo[], listId?: string): Promise<number> => {
  await getDownloadList()
  const ids = downloadedIds.value
  const targets = list.filter(m => m.source != 'local' && !ids.has(m.id)) as LX.Music.MusicInfoOnline[]
  if (!targets.length) return 0
  if (!appSetting['download.enable']) updateSetting({ 'download.enable': true })
  if (!await createDownloadTasks(targets, appSetting['download.quality'], listId)) return 0
  return targets.length
}

/**
 * Download the songs of a group that are not downloaded yet, the failed / paused ones are started again
 */
export const downloadRest = async(list: LX.Music.MusicInfo[], listId?: string) => {
  await getDownloadList()
  const ids = new Set(list.map(m => m.id))
  const stopped = downloadList.filter(task => !task.isComplate && ids.has(task.metadata.musicInfo.id) && (task.status == downloadStatus.ERROR || task.status == downloadStatus.PAUSE))
  // the ones not downloaded yet with them: a batch (the Music API in use may forbid it)
  if (!checkBatchDownload([...stopped.map(task => task.metadata.musicInfo), ...list.filter(m => !downloadedIds.value.has(m.id))])) return
  if (stopped.length) await startDownloadTasks(stopped)
  await downloadMusics(list, listId)
}

const hasList = (listId: string) => {
  return listId == defaultList.id || listId == loveList.id || userLists.some(l => l.id == listId)
}

/**
 * synced lists that still exist, a removed list just stops being synced
 */
export const activeSyncListIds = computed(() => syncListIds.value.filter(hasList))

export const syncList = async(listId: string) => {
  if (!isSyncList(listId) || !hasList(listId)) return
  await downloadMusics(await getListMusics(listId), listId)
}

export const setListSync = async(listId: string, enable: boolean) => {
  const ids = syncListIds.value.filter(id => id != listId)
  if (enable) ids.push(listId)
  updateSetting({ 'download.syncListIds': ids.join(',') })
  if (enable) await downloadMusics(await getListMusics(listId), listId)
}

/**
 * Called once the lists are loaded: continue unfinished downloads of the synced lists
 * and download the songs that were added to them
 */
export const initDownloadSync = async() => {
  if (!syncListIds.value.length) return
  const list = await getDownloadList()
  const ids = new Set(syncListIds.value)
  const pausedTasks = list.filter(task => !task.isComplate && task.status == downloadStatus.PAUSE && task.metadata.listId && ids.has(task.metadata.listId))
  if (pausedTasks.length) await startDownloadTasks(pausedTasks)
  for (const id of syncListIds.value) await syncList(id)
}

let timeout: ReturnType<typeof setTimeout> | null = null
const updatedIds = new Set<string>()
export const handleMyListUpdate = (ids: string[]) => {
  for (const id of ids) {
    if (isSyncList(id)) updatedIds.add(id)
  }
  if (!updatedIds.size || timeout) return
  timeout = setTimeout(() => {
    timeout = null
    const ids = Array.from(updatedIds)
    updatedIds.clear()
    void (async() => {
      for (const id of ids) await syncList(id)
    })()
  }, 1500)
}
