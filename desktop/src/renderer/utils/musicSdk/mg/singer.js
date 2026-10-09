import { httpFetch } from '../../request'
import { createHttpFetch } from './utils'
import { filterMusicInfoListV5 } from './musicInfo'
import album from './album'

const headers = {
  'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
  Referer: 'https://music.migu.cn/',
  channel: '0146921',
  ua: 'Android_migu',
}

const searchSwitch = sw => encodeURIComponent(JSON.stringify(sw))

const searchAll = (text, sw, page = 1, limit = 20) => {
  return httpFetch(`https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/search_all.do?isCopyright=1&isCorrect=1&pageNo=${page}&pageSize=${limit}&searchSwitch=${searchSwitch(sw)}&sort=0&text=${encodeURIComponent(text)}`, { headers }).promise.then(({ body }) => body)
}

const fixImg = img => (img && !/^https?:/.test(img) ? 'http://d.musicapp.migu.cn' + img : img)

const singerCache = new Map()

export default {
  limit_song: 100,
  /**
   * 通过名称搜索歌手，返回歌手 id
   */
  async search(name) {
    const body = await searchAll(name, { song: 0, album: 0, singer: 1, tagSong: 0, mvSong: 0, bestShow: 1, songlist: 0, lyricSong: 0 }, 1, 10)
    const best = (body?.bestShowResultData?.result ?? []).filter(i => i.mod == 'singer' || i.singerName)
    best.forEach(item => {
      if (item?.id) singerCache.set(String(item.id), item)
    })
    const list = body?.singerResultData?.result ?? []
    const target = name.toLowerCase()
    const item = list.find(s => s.name.toLowerCase() == target) ?? best[0]
    return item ? String(item.id) : null
  },
  /**
   * 获取歌手信息
   * @param {*} id
   */
  async getInfo(id) {
    let cached = singerCache.get(String(id))
    if (!cached) {
      let data
      try {
        data = await createHttpFetch(`https://app.c.nf.migu.cn/MIGUM3.0/resource/singer/song/v1.0?singerId=${id}&pageNo=1&pageSize=1`, { headers })
      } catch (err) {
        console.log(err)
      }
      const singer = (data?.songItems?.[0]?.singerList ?? []).find(s => String(s.id) == String(id)) ?? {}
      cached = { id, singerName: singer.name, singerPicUrl: [{ img: singer.img }], songCount: data?.totalCount }
    }
    const pic = cached.singerPicUrl?.length ? (cached.singerPicUrl[0].img ?? cached.singerPicUrl[0]) : ''
    return {
      source: 'mg',
      id,
      info: {
        name: cached.singerName ?? '',
        desc: '',
        avatar: pic,
        gender: '',
      },
      count: {
        music: parseInt(cached.songCount) || 0,
        album: parseInt(cached.albumCount) || 0,
      },
    }
  },
  /**
   * 获取歌手歌曲列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  async getSongList(id, page = 1, limit = this.limit_song) {
    const data = await createHttpFetch(`https://app.c.nf.migu.cn/MIGUM3.0/resource/singer/song/v1.0?singerId=${id}&pageNo=${page}&pageSize=${limit}`, { headers })
    const raw = (data?.songItems ?? []).map(item => ({
      ...item,
      img1: fixImg(item.img1),
      img2: fixImg(item.img2),
      img3: fixImg(item.img3),
    }))
    const list = filterMusicInfoListV5(raw)
    return {
      source: 'mg',
      list,
      limit,
      page,
      total: parseInt(data?.totalCount) || list.length,
    }
  },
  /**
   * 获取歌手专辑列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  async getAlbumList(id, page = 1, limit = 20) {
    const name = singerCache.get(String(id))?.singerName
    if (!name) return { source: 'mg', list: [], limit, page, total: 0 }
    const body = await searchAll(name, { song: 0, album: 1, singer: 0, tagSong: 0, mvSong: 0, bestShow: 0, songlist: 0, lyricSong: 0 }, page, limit)
    const raw = body?.albumResultData?.result ?? []
    const list = raw.filter(a => a.singer && a.singer.includes(name)).map(a => ({
      id: a.id,
      count: null,
      info: {
        name: a.name,
        author: a.singer,
        img: a.imgItems?.[0]?.img ?? null,
        time: a.publishDate,
      },
    }))
    return {
      source: 'mg',
      list,
      limit,
      page,
      total: parseInt(body?.albumResultData?.totalCount) || list.length,
    }
  },
  async getAlbumDetail(id, page = 1) {
    const body = await createHttpFetch(`https://c.musicapp.migu.cn/MIGUM2.0/v1.0/content/resourceinfo.do?resourceType=5&resourceId=${id}`, { headers })
    const materialId = body?.resource?.[0]?.materialId ?? id
    return album.getAlbumDetail(materialId, page)
  },
}
