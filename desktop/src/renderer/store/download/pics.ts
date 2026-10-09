import { reactive } from '@common/utils/vueTools'
import { getPicUrl } from '@renderer/core/music/download'

// Covers of downloaded songs that have no cover link: the one embedded in the file,
// or else the one found online. Kept while the app runs ('' when there is none).

export const downloadPics = reactive<Record<string, string>>({})

const MAX_CONCURRENT = 4
const queue: LX.Download.ListItem[] = []
const queued = new Set<string>()
let running = 0

const runQueue = () => {
  while (running < MAX_CONCURRENT && queue.length) {
    const task = queue.shift()!
    running++
    getPicUrl({ musicInfo: task, isRefresh: false }).then(url => {
      // a big cover of a file is saved as a temporary file
      if (url && !/^(?:https?|data|file|blob):/i.test(url)) url = `file:///${url.replace(/\\/g, '/')}`
      downloadPics[task.id] = url || ''
    }).catch(() => {
      downloadPics[task.id] = ''
    }).finally(() => {
      running--
      runQueue()
    })
  }
}

/**
 * Look up the cover of a downloaded song, it is put in `downloadPics`
 */
export const loadDownloadPic = (task: LX.Download.ListItem) => {
  if (queued.has(task.id)) return
  queued.add(task.id)
  queue.push(task)
  runQueue()
}
