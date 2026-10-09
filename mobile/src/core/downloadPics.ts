import { useEffect, useState } from 'react'
import { readPic } from '@/utils/localMediaMetadata'
import { getListMusicPic } from '@/utils/listMusicPic'
import { type DownloadTask } from '@/core/download'

// Covers of downloaded songs that have no cover link: the one embedded in the file,
// or else the one found online. Kept while the app runs ('' when there is none).
// (desktop: renderer/store/download/pics.ts)

let pics: Record<string, string> = {}
const listeners = new Set<(pics: Record<string, string>) => void>()
const setPic = (id: string, url: string) => {
  pics = { ...pics, [id]: url }
  for (const listener of listeners) listener(pics)
}

const MAX_CONCURRENT = 3
const queue: DownloadTask[] = []
const queued = new Set<string>()
let running = 0

const findOnline = async(task: DownloadTask) => new Promise<string>(resolve => {
  // the lookup of the list rows (its result is kept with the song); it gives no answer when it fails
  const timeout = setTimeout(() => { resolve('') }, 8000)
  getListMusicPic(task.musicInfo, url => {
    clearTimeout(timeout)
    resolve(url)
  })
})

const loadPic = async(task: DownloadTask) => {
  if (task.status == 'completed' && task.filePath) {
    let pic = await readPic(task.filePath).catch(() => '')
    if (pic) {
      if (pic.startsWith('/')) pic = `file://${pic}`
      return pic
    }
  }
  return findOnline(task)
}

const runQueue = () => {
  while (running < MAX_CONCURRENT && queue.length) {
    const task = queue.shift()!
    running++
    void loadPic(task).catch(() => '').then(url => {
      setPic(task.id, url)
    }).finally(() => {
      running--
      runQueue()
    })
  }
}

/**
 * Look up the covers of downloaded songs that have none
 */
export const loadDownloadPics = (tasks: DownloadTask[]) => {
  for (const task of tasks) {
    if (queued.has(task.id)) continue
    if (task.musicInfo.meta.picUrl) continue
    queued.add(task.id)
    queue.push(task)
  }
  runQueue()
}

/**
 * Covers found by `loadDownloadPics`, by download task id
 */
export const useDownloadPics = () => {
  const [value, setValue] = useState(pics)
  useEffect(() => {
    listeners.add(setValue)
    setValue(pics)
    return () => {
      listeners.delete(setValue)
    }
  }, [])
  return value
}
