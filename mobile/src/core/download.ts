import { useEffect, useMemo, useState } from 'react'
import { getData, saveData } from '@/plugins/storage'
import { downloadFile, stopDownload, mkdir, unlink, existsFile, moveFile, privateStorageDirectoryPath } from '@/utils/fs'
import { filterFileName } from '@/utils/common'
import settingState from '@/store/setting/state'
import listState from '@/store/list/state'
import { LIST_IDS } from '@/config/constant'
import { updateSetting } from '@/core/common'
import { getListMusics } from '@/core/list'
import { getMusicUrl } from '@/core/music/online'
import { getPlayQuality } from '@/core/music/utils'
import { state as userApiState } from '@/store/userApi'
import { tipDialog } from '@/utils/tools'
import { countMusicApiSongs, forbidsBatchDownload } from '@/utils/sourceAddons'

// Downloads (new on mobile, same behaviour as the desktop app, store/download/sync.ts):
// songs are saved in the app storage, a song that is downloaded is played from its file,
// "keep downloaded" lists download their songs and the ones added to them later.

export type DownloadStatus = 'waiting' | 'running' | 'completed' | 'error'
export interface DownloadTask {
  id: string // id of the song
  musicInfo: LX.Music.MusicInfoOnline
  status: DownloadStatus
  progress: number // 0 - 100
  filePath: string
  listId?: string
  /** a failed download waits until this time to be tried again */
  retryAt?: number
}

const STORAGE_KEY = '@download_tasks_v1'
const DOWNLOAD_DIR = `${privateStorageDirectoryPath}/downloads`
const MAX_CONCURRENT = 2
const EXT_RXP = /\.(mp3|flac|m4a|ogg|wav|aac)(?:\?|$)/i

let tasks: DownloadTask[] = []
const taskMap = new Map<string, DownloadTask>()
const jobs = new Map<string, number>()
let runningCount = 0

type Listener = (tasks: DownloadTask[]) => void
const listeners = new Set<Listener>()
let notifyTimer: NodeJS.Timeout | null = null
const notify = () => {
  if (notifyTimer) return
  // progress events come in bursts
  notifyTimer = setTimeout(() => {
    notifyTimer = null
    const list = [...tasks]
    for (const listener of listeners) listener(list)
  }, 300)
}
let saveTimer: NodeJS.Timeout | null = null
const save = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveData(STORAGE_KEY, tasks)
  }, 2000)
}
const update = () => {
  notify()
  save()
}

const initPromise = getData<DownloadTask[]>(STORAGE_KEY).then(list => {
  for (const task of list ?? []) {
    // downloads that were interrupted start again
    if (task.status == 'running') task.status = 'waiting'
    if (taskMap.has(task.id)) continue
    tasks.push(task)
    taskMap.set(task.id, task)
  }
  notify()
}).catch(err => {
  console.log(err)
})

/**
 * All download tasks, updated while they change
 */
export const useDownloadTasks = () => {
  const [list, setList] = useState(tasks)
  useEffect(() => {
    listeners.add(setList)
    void initPromise.then(() => { setList([...tasks]) })
    return () => {
      listeners.delete(setList)
    }
  }, [])
  return list
}

export const getDownloadTask = (id: string) => taskMap.get(id)

export interface DownloadState {
  /** some of the songs are waiting or downloading */
  downloading: boolean
  /** how far the downloads have gone, 0 - 1 */
  progress: number
  /** all the songs are downloaded */
  done: boolean
  /** download tasks of the songs */
  taskIds: string[]
  /** number of downloaded songs / of songs */
  completed: number
  total: number
  /** part of the songs that is downloaded when only some of them are and nothing is downloading, undefined otherwise */
  partial?: number
}
const EMPTY_STATE: DownloadState = { downloading: false, progress: 0, done: false, taskIds: [], completed: 0, total: 0 }

const getDownloadState = (ids: string[], downloadTasks: DownloadTask[]): DownloadState => {
  if (!ids.length) return EMPTY_STATE
  const byId = new Map(downloadTasks.map(task => [task.id, task]))
  let progress = 0
  let completed = 0
  let downloading = false
  const taskIds: string[] = []
  for (const id of ids) {
    const task = byId.get(id)
    if (!task) continue
    taskIds.push(task.id)
    if (task.status == 'completed') {
      completed++
      progress += 1
      continue
    }
    if (task.status == 'running' || task.status == 'waiting') downloading = true
    progress += (task.progress ?? 0) / 100
  }
  const state: DownloadState = {
    downloading,
    progress: progress / ids.length,
    // downloaded only when all its songs are, partly downloaded otherwise
    done: completed == ids.length,
    taskIds,
    completed,
    total: ids.length,
  }
  if (state.taskIds.length && !state.downloading && !state.done) state.partial = completed / ids.length
  return state
}

/**
 * Download state of a group of songs (an album, a playlist)
 */
export const useDownloadState = (list: LX.Music.MusicInfo[] | null | undefined) => {
  const downloadTasks = useDownloadTasks()
  return useMemo(() => {
    return getDownloadState((list ?? []).filter(m => m.source != 'local').map(m => m.id), downloadTasks)
  }, [list, downloadTasks])
}

/**
 * Download state of one of the user's lists
 * @param listId id of the list, null when there is none to check
 */
export const useListDownloadState = (listId: string | null) => {
  const downloadTasks = useDownloadTasks()
  const [ids, setIds] = useState<string[]>([])
  useEffect(() => {
    if (!listId) {
      setIds([])
      return
    }
    let isUnmounted = false
    const load = () => {
      void getListMusics(listId).then(list => {
        if (!isUnmounted) setIds(list.filter(m => m.source != 'local').map(m => m.id))
      })
    }
    const handleUpdate = (updatedIds: string[]) => {
      if (updatedIds.includes(listId)) load()
    }
    load()
    global.app_event.on('myListMusicUpdate', handleUpdate)
    return () => {
      isUnmounted = true
      global.app_event.off('myListMusicUpdate', handleUpdate)
    }
  }, [listId])

  return useMemo(() => getDownloadState(ids, downloadTasks), [ids, downloadTasks])
}

/**
 * Whether all the songs of one of the user's lists are downloaded
 */
export const useIsListDownloaded = (listId: string | null) => useListDownloadState(listId).done

/**
 * File of a downloaded song, used by the player instead of the online link
 */
export const getDownloadedFilePath = async(id: string): Promise<string | null> => {
  const task = taskMap.get(id)
  if (task?.status != 'completed') return null
  return await existsFile(task.filePath) ? task.filePath : null
}

// A failed download is tried again a few times, later: the sources limit the number of requests
// (a playlist of hundreds of songs used to fail mostly once the limit was reached)
const MAX_RETRIES = 3
const RETRY_DELAYS = [5_000, 20_000, 60_000]
// pause of the whole queue when a source says it gets too many requests / blocks the ip
const RATE_LIMIT_PAUSE = 45_000
// time between the requests of song links
const REQUEST_SPACING = 400
const RATE_LIMIT_RXP = /too many|busy|block|limit|429|服务器繁忙|频繁/i
const retries = new Map<string, number>()
let pausedUntil = 0
let lastRequestTime = 0
let queueTimer: NodeJS.Timeout | null = null

const waitForTurn = async() => {
  const now = Date.now()
  const at = Math.max(pausedUntil, lastRequestTime + REQUEST_SPACING)
  lastRequestTime = Math.max(at, now)
  if (at > now) await new Promise(resolve => setTimeout(resolve, at - now))
}

class DownloadHttpError extends Error {}

const runTask = async(task: DownloadTask) => {
  task.status = 'running'
  task.progress = 0
  update()
  try {
    await mkdir(DOWNLOAD_DIR).catch(() => {})
    const download = async(isRefresh: boolean) => {
      await waitForTurn()
      // the best quality of the song up to the one of the setting (like the desktop app),
      // a quality the song doesn't have fails
      const quality = getPlayQuality(settingState.setting['download.quality'], task.musicInfo)
      const url = await getMusicUrl({ musicInfo: task.musicInfo, quality, isRefresh })
      const ext = EXT_RXP.exec(url)?.[1].toLowerCase() ?? 'mp3'
      const name = filterFileName(`${task.musicInfo.name} - ${task.musicInfo.singer}`).substring(0, 80)
      const filePath = `${DOWNLOAD_DIR}/${name}_${task.id.replace(/[^\w-]/g, '_')}.${ext}`
      // a song joined into a file of the cache (SoundCloud HLS): the file is kept as the download
      if (url.startsWith('file://')) {
        await moveFile(url.replace('file://', ''), filePath)
        return filePath
      }
      const { jobId, promise } = downloadFile(url, filePath, {
        progressInterval: 500,
        progress({ bytesWritten, contentLength }) {
          if (contentLength <= 0) return
          task.progress = Math.trunc(bytesWritten / contentLength * 100)
          notify()
        },
      })
      jobs.set(task.id, jobId)
      const { statusCode } = await promise
      if (statusCode < 200 || statusCode >= 300) {
        void unlink(filePath).catch(() => {})
        throw new DownloadHttpError(`download failed: ${statusCode}`)
      }
      return filePath
    }
    let filePath: string
    try {
      filePath = await download(false)
    } catch (err) {
      // the saved link of the song has expired (403...): a new one is asked for
      if (!taskMap.has(task.id) || !(err instanceof DownloadHttpError)) throw err
      console.log(err)
      task.progress = 0
      filePath = await download(true)
    }
    task.filePath = filePath
    task.progress = 100
    task.status = 'completed'
    retries.delete(task.id)
  } catch (err) {
    console.log(err)
    // removed while it was running
    if (taskMap.has(task.id)) {
      const message = (err as Error)?.message ?? String(err)
      if (RATE_LIMIT_RXP.test(message)) pausedUntil = Math.max(pausedUntil, Date.now() + RATE_LIMIT_PAUSE)
      const count = retries.get(task.id) ?? 0
      if (count < MAX_RETRIES) {
        retries.set(task.id, count + 1)
        task.status = 'waiting'
        task.progress = 0
        task.retryAt = Date.now() + RETRY_DELAYS[count]
      } else {
        retries.delete(task.id)
        task.status = 'error'
      }
    }
  } finally {
    jobs.delete(task.id)
  }
}

const runQueue = () => {
  if (queueTimer) {
    clearTimeout(queueTimer)
    queueTimer = null
  }
  const now = Date.now()
  let nextAt = Infinity
  while (runningCount < MAX_CONCURRENT) {
    const task = tasks.find(t => t.status == 'waiting' && (t.retryAt ?? 0) <= now)
    if (!task) break
    task.retryAt = undefined
    runningCount++
    void runTask(task).finally(() => {
      runningCount--
      update()
      runQueue()
    })
  }
  // the songs waiting to be tried again
  for (const task of tasks) {
    if (task.status == 'waiting' && task.retryAt && task.retryAt > now) nextAt = Math.min(nextAt, task.retryAt)
  }
  if (nextAt != Infinity && runningCount < MAX_CONCURRENT) queueTimer = setTimeout(runQueue, nextAt - now + 50)
}

/**
 * Download songs, songs that are already downloaded (or being downloaded) are skipped
 * @returns the number of new downloads
 */
/**
 * Whether these songs can be downloaded together: the Music API in use may forbid batch downloads (its author,
 * e.g. Huibq), then one song of the Music API at a time (the user is told why)
 */
export const checkBatchDownload = (list: Array<{ source: string }>) => {
  if (countMusicApiSongs(list) < 2) return true
  const api = userApiState.list.find(api => api.id == settingState.setting['common.apiSource'])
  if (!api || !forbidsBatchDownload(api)) return true
  void tipDialog({
    title: global.i18n.t('download__batch_blocked_title'),
    message: global.i18n.t('download__batch_blocked', { name: api.name }),
  })
  return false
}

export const downloadMusics = async(list: LX.Music.MusicInfo[], listId?: string): Promise<number> => {
  await initPromise
  const targets = list.filter(m => m.source != 'local' && !taskMap.has(m.id)) as LX.Music.MusicInfoOnline[]
  if (!checkBatchDownload(targets)) return 0
  for (const musicInfo of targets) {
    const task: DownloadTask = { id: musicInfo.id, musicInfo, status: 'waiting', progress: 0, filePath: '', listId }
    tasks.unshift(task)
    taskMap.set(task.id, task)
  }
  if (targets.length) {
    tasks = [...tasks]
    update()
    runQueue()
  }
  return targets.length
}

/**
 * Download the songs of a group that are not downloaded yet, the failed ones are tried again
 */
export const downloadRest = async(list: LX.Music.MusicInfo[], listId?: string) => {
  await initPromise
  const failed = list.filter(m => taskMap.get(m.id)?.status == 'error')
  // the ones not downloaded yet with them: a batch (the Music API in use may forbid it)
  if (!checkBatchDownload([...failed, ...list.filter(m => m.source != 'local' && !taskMap.has(m.id))])) return
  retryDownloads(failed.map(m => m.id))
  await downloadMusics(list, listId)
}

export const retryDownloads = (ids: string[]) => {
  for (const id of ids) {
    const task = taskMap.get(id)
    if (task?.status == 'error') task.status = 'waiting'
  }
  update()
  runQueue()
}

/**
 * Remove downloads and their files
 */
export const removeDownloads = async(ids: string[]) => {
  const idSet = new Set(ids)
  for (const id of ids) {
    const task = taskMap.get(id)
    if (!task) continue
    taskMap.delete(id)
    const jobId = jobs.get(id)
    if (jobId != null) stopDownload(jobId)
    if (task.filePath) void unlink(task.filePath).catch(() => {})
  }
  tasks = tasks.filter(task => !idSet.has(task.id))
  update()
}

/* ---------- lists that are kept downloaded ---------- */

export const getSyncListIds = () => {
  const ids = settingState.setting['download.syncListIds']
  return ids ? ids.split(',') : []
}
export const isSyncList = (listId: string) => getSyncListIds().includes(listId)

const hasList = (listId: string) => {
  return listId == LIST_IDS.DEFAULT || listId == LIST_IDS.LOVE || listState.userList.some(l => l.id == listId)
}

export const syncList = async(listId: string) => {
  if (!isSyncList(listId) || !hasList(listId)) return
  await downloadMusics(await getListMusics(listId), listId)
}

export const setListSync = async(listId: string, enable: boolean) => {
  const ids = getSyncListIds().filter(id => id != listId)
  if (enable) ids.push(listId)
  updateSetting({ 'download.syncListIds': ids.join(',') })
  if (enable) await downloadMusics(await getListMusics(listId), listId)
}

let syncTimer: NodeJS.Timeout | null = null
const updatedIds = new Set<string>()
const handleListUpdate = (ids: string[]) => {
  for (const id of ids) {
    if (isSyncList(id)) updatedIds.add(id)
  }
  if (!updatedIds.size || syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    const ids = Array.from(updatedIds)
    updatedIds.clear()
    void (async() => {
      for (const id of ids) await syncList(id)
    })()
  }, 1500)
}

/**
 * Called once the lists are loaded: continue unfinished downloads
 * and download the songs that were added to the synced lists
 */
export const initDownload = async() => {
  await initPromise
  global.app_event.on('myListMusicUpdate', handleListUpdate)
  runQueue()
  for (const id of getSyncListIds()) await syncList(id)
}
