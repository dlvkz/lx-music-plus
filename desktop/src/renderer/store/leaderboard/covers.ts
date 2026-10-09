import { getCache, setCache } from '@renderer/utils/dataCache'
import { httpFetch } from '@renderer/utils/request'
import { getListDetail } from './action'
import { getChartBoards } from '@renderer/utils/chartSources'

// Chart covers. The built-in chart lists carry no image, the official ones are fetched here per source,
// charts without one fall back to the cover of their first song.

type Covers = Record<string, string>

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}
const request = async(url: string, referer?: string): Promise<any> => {
  const { body, statusCode } = await (httpFetch(url, { headers: referer ? { ...headers, Referer: referer } : headers }) as any).promise
  if (statusCode != 200) throw new Error('failed')
  return body
}

const chartCovers = async(source: 'sp' | 'dz' | 'sc') => {
  const covers: Covers = {}
  for (const board of await getChartBoards(source)) if (board.pic) covers[board.bangid] = board.pic
  return covers
}

const loaders: Partial<Record<string, () => Promise<Covers>>> = {
  // the charts of Spotify / SoundCloud come with their pictures
  sp: async() => chartCovers('sp'),
  dz: async() => chartCovers('dz'),
  sc: async() => chartCovers('sc'),
  async wy() {
    const body = await request('https://music.163.com/api/toplist', 'https://music.163.com/')
    const covers: Covers = {}
    for (const item of body.list ?? []) covers[String(item.id)] = `${item.coverImgUrl as string}?param=300y300`
    return covers
  },
  async kw() {
    const body = await request('http://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2')
    const covers: Covers = {}
    for (const item of body.child ?? []) {
      if (item.pic) covers[String(item.sourceid)] = item.pic
    }
    return covers
  },
  async tx() {
    const body = await request('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?format=json&g_tk=5381&platform=h5&needNewCode=1')
    const covers: Covers = {}
    for (const item of body.data?.topList ?? []) covers[String(item.id)] = (item.picUrl as string).replace(/^http:/, 'https:')
    return covers
  },
  async kg() {
    const body = await request('http://mobilecdnbj.kugou.com/api/v3/rank/list?version=9108&plat=0&showtype=2&parentid=0&apiver=6&area_code=1&withsong=0')
    const covers: Covers = {}
    for (const item of body.data?.info ?? []) {
      if (item.imgurl) covers[String(item.rankid)] = (item.imgurl as string).replace('{size}', '240')
    }
    return covers
  },
}

const cache = new Map<LX.OnlineSource, Promise<Covers>>()

/**
 * Covers of the charts of a source as they were last time (kept between the runs of the app):
 * official ones and the ones taken from the first song, by chart id {source}__{bangid}
 */
export const getCachedChartCovers = (source: LX.OnlineSource): Covers => getCache<Covers>(`chart_covers:${source}`) ?? {}
const saveChartCover = (id: string, url: string) => {
  const source = id.split('__')[0] as LX.OnlineSource
  const covers = getCachedChartCovers(source)
  if (covers[id] == url) return
  setCache(`chart_covers:${source}`, { ...covers, [id]: url })
}

/**
 * Official covers of the charts of a source, by chart id (bangid)
 */
export const getBoardCovers = async(source: LX.OnlineSource): Promise<Covers> => {
  let task = cache.get(source)
  if (!task) {
    task = (loaders[source]?.() ?? Promise.resolve({})).then((covers: Covers) => {
      // kept for the next runs, by chart id
      if (Object.keys(covers).length) {
        const saved = getCachedChartCovers(source)
        const next = { ...saved }
        for (const [bangid, url] of Object.entries(covers)) next[`${source}__${bangid}`] = url
        setCache(`chart_covers:${source}`, next)
      }
      return covers
    }).catch(err => {
      console.log(err)
      cache.delete(source)
      return {}
    })
    cache.set(source, task)
  }
  return task
}

const songCovers = new Map<string, string | null>()
const queue: Array<() => Promise<void>> = []
let running = 0
const MAX_CONCURRENT = 3
const runQueue = () => {
  while (running < MAX_CONCURRENT && queue.length) {
    running++
    void queue.shift()!().finally(() => {
      running--
      runQueue()
    })
  }
}

/**
 * Cover of the first song of a chart, for charts that have no official cover
 * @param id chart id {source}__{bangid}
 */
export const getBoardSongCover = async(id: string): Promise<string | null> => {
  if (songCovers.has(id)) return songCovers.get(id)!
  return new Promise(resolve => {
    queue.push(async() => {
      let cover: string | null = null
      try {
        const { list } = await getListDetail(id, 1)
        cover = list.find(m => m.meta.picUrl)?.meta.picUrl ?? null
      } catch {}
      songCovers.set(id, cover)
      if (cover) saveChartCover(id, cover)
      resolve(cover)
    })
    runQueue()
  })
}
