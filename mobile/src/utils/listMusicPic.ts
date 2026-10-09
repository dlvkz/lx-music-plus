import { getData, saveData } from '@/plugins/storage'
import { getPicUrl as getOnlinePicUrl } from '@/core/music/online'

// Cover thumbnails for list rows: requests are delayed so fast scrolling doesn't fire them,
// cancelled when the row is reused, and limited in concurrency. (desktop: renderer/utils/listMusicPic.ts)
const LOAD_DELAY = 300
const MAX_CONCURRENT = 4

interface Task {
  musicInfo: LX.Music.MusicInfoOnline
  callback: (url: string) => void
  cancelled: boolean
}

const queue: Task[] = []
const failedIds = new Set<string>()
let running = 0

// covers found for songs that are not in one of the user's lists, kept between the runs of the app
const PIC_CACHE_KEY = '@song_pic_cache'
const MAX_PICS = 3000
let pics = new Map<string, string>()
void getData<Array<[string, string]>>(PIC_CACHE_KEY).then(list => {
  if (list) pics = new Map([...list, ...pics])
}).catch(() => {})
let saveTimeout: ReturnType<typeof setTimeout> | null = null
const savePic = (id: string, url: string) => {
  if (pics.get(id) == url) return
  pics.delete(id)
  pics.set(id, url)
  if (pics.size > MAX_PICS) pics.delete(pics.keys().next().value!)
  if (saveTimeout) return
  saveTimeout = setTimeout(() => {
    saveTimeout = null
    void saveData(PIC_CACHE_KEY, [...pics]).catch(() => {})
  }, 3000)
}

const runQueue = () => {
  while (running < MAX_CONCURRENT && queue.length) {
    const task = queue.shift()!
    if (task.cancelled) continue
    running++
    getOnlinePicUrl({ musicInfo: task.musicInfo, isRefresh: false, allowToggleSource: false }).then(url => {
      if (!url) throw new Error('no pic')
      // rows of the same song don't ask again
      task.musicInfo.meta.picUrl = url
      savePic(task.musicInfo.id, url)
      if (!task.cancelled) task.callback(url)
    }).catch(() => {
      failedIds.add(task.musicInfo.id)
    }).finally(() => {
      running--
      runQueue()
    })
  }
}

/**
 * Get the cover of a list song that has none yet, returns a function that cancels the request
 */
export const getListMusicPic = (musicInfo: LX.Music.MusicInfo, callback: (url: string) => void): () => void => {
  // found on an earlier run
  if (musicInfo.source != 'local' && !musicInfo.meta.picUrl && pics.has(musicInfo.id)) {
    musicInfo.meta.picUrl = pics.get(musicInfo.id)!
    callback(musicInfo.meta.picUrl)
    return () => {}
  }
  if (musicInfo.source == 'local' || failedIds.has(musicInfo.id)) return () => {}
  const task: Task = { musicInfo, callback, cancelled: false }
  const timeout = setTimeout(() => {
    queue.push(task)
    runQueue()
  }, LOAD_DELAY)
  return () => {
    task.cancelled = true
    clearTimeout(timeout)
  }
}

const KW_PIC_RXP = /^(https?:\/\/img\d*\.(?:kwcdn\.)?kuwo\.cn\/star\/albumcover\/)\d+\//
const TX_PIC_RXP = /^(https?:\/\/y\.(?:gtimg|qq)\.cn\/music\/photo_new\/T\d{3}R)\d+x\d+M/
/**
 * Request a small version of the image where the CDN supports it
 */
export const getThumbnailUrl = (url: string | null | undefined, size: number): string | null => {
  if (!url) return null
  if (/^https?:\/\/p\d+\.music\.126\.net\//.test(url) && !url.includes('param=')) {
    return `${url}${url.includes('?') ? '&' : '?'}param=${size}y${size}`
  }
  if (KW_PIC_RXP.test(url)) return url.replace(KW_PIC_RXP, `$1${size <= 150 ? 150 : 300}/`)
  if (TX_PIC_RXP.test(url)) return url.replace(TX_PIC_RXP, `$1${size <= 150 ? '150x150' : '300x300'}M`)
  return url
}
