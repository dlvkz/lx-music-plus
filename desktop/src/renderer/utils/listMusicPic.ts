import { getPicUrl as getOnlinePicUrl } from '@renderer/core/music/online'

// Cover thumbnails for list rows: requests are delayed so fast scrolling doesn't fire them,
// cancelled when the row leaves the viewport, and limited in concurrency.
const LOAD_DELAY = 200
const MAX_CONCURRENT = 4

interface Task {
  musicInfo: LX.Music.MusicInfo
  listId: string | null
  callback: (url: string) => void
  cancelled: boolean
}

const queue: Task[] = []
const failedIds = new Set<string>()
let running = 0

// Covers found for songs that are not in one of the user's lists (album, artist, chart pages...),
// kept between the runs of the app so a page shows them at once the next time.
const PIC_CACHE_KEY = 'lx_song_pic_cache'
const MAX_PICS = 4000
let pics = new Map<string, string>()
try {
  pics = new Map(JSON.parse(localStorage.getItem(PIC_CACHE_KEY) ?? '[]') as Array<[string, string]>)
} catch {}
let savePicsTimeout: ReturnType<typeof setTimeout> | null = null
const savePic = (id: string, url: string) => {
  if (pics.get(id) == url) return
  pics.delete(id)
  pics.set(id, url)
  // the oldest ones go first
  if (pics.size > MAX_PICS) pics.delete(pics.keys().next().value!)
  if (savePicsTimeout) return
  savePicsTimeout = setTimeout(() => {
    savePicsTimeout = null
    try {
      localStorage.setItem(PIC_CACHE_KEY, JSON.stringify([...pics]))
    } catch (err) {
      console.log(err)
    }
  }, 2000)
}

const loadPic = async(musicInfo: LX.Music.MusicInfo, listId: string | null): Promise<string | null> => {
  if (musicInfo.source == 'local') {
    // only the embedded cover; looking it up online is left to the player
    return window.lx.worker.main.getMusicFilePic(musicInfo.meta.filePath)
  }
  return getOnlinePicUrl({ musicInfo, listId, isRefresh: false, allowToggleSource: false })
}

const runQueue = () => {
  while (running < MAX_CONCURRENT && queue.length) {
    const task = queue.shift()!
    if (task.cancelled) continue
    running++
    loadPic(task.musicInfo, task.listId).then(url => {
      if (!url) throw new Error('no pic')
      if (task.musicInfo.source != 'local') {
        // the other rows / pages showing this song don't look it up again
        task.musicInfo.meta.picUrl = url
        savePic(task.musicInfo.id, url)
      }
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
 * Get the cover of a list song, returns a function that cancels the request
 */
export const getListMusicPic = (musicInfo: LX.Music.MusicInfo, listId: string | null, callback: (url: string) => void): () => void => {
  if (musicInfo.source != 'local' && !musicInfo.meta.picUrl && pics.has(musicInfo.id)) musicInfo.meta.picUrl = pics.get(musicInfo.id)!
  if (musicInfo.source != 'local' && musicInfo.meta.picUrl) {
    callback(musicInfo.meta.picUrl)
    return () => {}
  }
  if (failedIds.has(musicInfo.id)) return () => {}

  const task: Task = { musicInfo, listId, callback, cancelled: false }
  const timeout = setTimeout(() => {
    queue.push(task)
    runQueue()
  }, LOAD_DELAY)
  return () => {
    task.cancelled = true
    clearTimeout(timeout)
  }
}

/**
 * Request a small version of the image where the CDN supports it
 */
export const getThumbnailUrl = (url: string, size: number): string => {
  if (/^https?:\/\/p\d+\.music\.126\.net\//.test(url) && !url.includes('param=')) {
    return `${url}${url.includes('?') ? '&' : '?'}param=${size}y${size}`
  }
  // kuwo: .../star/albumcover/500/xx/xx/xxx.jpg
  if (KW_PIC_RE.test(url)) return url.replace(KW_PIC_RE, `$1${pickSize(KW_PIC_SIZES, size)}/`)
  // tencent: .../music/photo_new/T002R500x500M000xxx.jpg
  if (TX_PIC_RE.test(url)) {
    const txSize = pickSize(TX_PIC_SIZES, size)
    return url.replace(TX_PIC_RE, `$1${txSize}x${txSize}M`)
  }
  return url
}

const KW_PIC_RE = /^(https?:\/\/img\d*\.(?:kwcdn\.)?kuwo\.cn\/star\/albumcover\/)\d+\//
const KW_PIC_SIZES = [100, 120, 150, 300]
const TX_PIC_RE = /^(https?:\/\/y\.(?:gtimg|qq)\.cn\/music\/photo_new\/T\d{3}R)\d+x\d+M/
const TX_PIC_SIZES = [90, 150, 300]
// smallest size the CDN serves that is not smaller than the requested one
const pickSize = (sizes: number[], size: number) => sizes.find(s => s >= size) ?? sizes[sizes.length - 1]
