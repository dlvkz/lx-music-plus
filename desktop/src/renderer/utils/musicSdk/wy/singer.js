import { httpFetch } from '../../request'
import { eapiRequest } from './utils/index'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'

// picture of the artists found by the last searches, by id
const searchPics = new Map()

export default {
  /**
   * 通过名称搜索歌手，返回歌手 id
   */
  async search(name) {
    const { body } = await httpFetch(`https://music.163.com/api/cloudsearch/pc?type=100&limit=5&offset=0&s=${encodeURIComponent(name)}`, {
      headers: { Referer: 'https://music.163.com', 'User-Agent': 'Mozilla/5.0' },
    }).promise
    const list = body?.result?.artists ?? []
    const target = name.toLowerCase()
    const matches = n => typeof n == 'string' && n.toLowerCase() == target
    // several artists can share a name: the one with the most songs is the known one
    const item = list.filter(a => matches(a.name) || (a.alias ?? []).some(matches) || (a.trans ? matches(a.trans) : false))
      .sort((a, b) => (b.musicSize ?? 0) - (a.musicSize ?? 0))[0] ?? list[0]
    if (!item) return null
    // the pictures of the search result are used when the artist detail has none
    searchPics.set(String(item.id), item.picUrl || item.img1v1Url || null)
    return String(item.id)
  },
  getAlbumDetail(id) {
    return httpFetch(`https://music.163.com/api/v1/album/${id}`, { headers: { Referer: 'https://music.163.com' } }).promise.then(({ body }) => body)
  },
  /**
   * 获取歌手信息
   * @param {*} id
   */
  getInfo(id) {
    return eapiRequest('/api/artist/head/info/get', { id }).promise.then(({ body }) => {
      if (!body || body.code != 200) throw new Error('get singer info faild.')
      const data = body.data ?? body
      const artist = data.artist ?? {}
      const user = data.user ?? {}
      return {
        source: 'wy',
        id: artist.id,
        info: {
          name: artist.name,
          desc: artist.briefDesc,
          avatar: artist.cover || artist.avatar || user.avatarUrl || searchPics.get(String(id)) || null,
          gender: user.gender === 1 ? 'man' : 'woman',
        },
        count: {
          music: artist.musicSize ?? data.musicSize,
          album: artist.albumSize ?? data.albumSize,
        },
      }
    })
  },
  /**
   * 获取歌手歌曲列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  getSongList(id, page = 1, limit = 100) {
    return eapiRequest('/api/v2/artist/songs', {
      id,
      limit,
      offset: limit * (page - 1),
    }).promise.then(({ body }) => {
      const data = body.data ?? body
      if (!data.songs || body.code != 200) throw new Error('get singer song list faild.')

      const list = this.filterSongList(data.songs)
      return {
        list,
        limit,
        page,
        total: data.total ?? data.songs.length,
        source: 'wy',
      }
    })
  },
  /**
   * 获取歌手专辑列表
   * @param {*} id
   * @param {*} page
   * @param {*} limit
   */
  getAlbumList(id, page = 1, limit = 10) {
    return eapiRequest(`/api/artist/albums/${id}`, {
      limit,
      offset: limit * (page - 1),
    }).promise.then(({ body }) => {
      const data = body.data ?? body
      if (!data.hotAlbums || body.code != 200) throw new Error('get singer album list faild.')

      const list = this.filterAlbumList(data.hotAlbums)
      return {
        source: 'wy',
        list,
        limit,
        page,
        total: data.artist?.albumSize ?? list.length,
      }
    })
  },
  filterAlbumList(raw) {
    const list = []
    raw.forEach(item => {
      if (!item.id) return
      list.push({
        id: item.id,
        count: item.size,
        info: {
          name: item.name,
          author: formatSingerName(item.artists),
          img: item.picUrl,
          desc: null,
        },
      })
    })
    return list
  },
  filterSongList(raw) {
    const list = []
    raw.forEach(item => {
      if (!item.id) return

      const types = []
      const _types = {}
      let size
      item.privilege.chargeInfoList.forEach(i => {
        switch (i.rate) {
          case 128000:
            size = item.lMusic ? sizeFormate(item.lMusic.size) : null
            types.push({ type: '128k', size })
            _types['128k'] = {
              size,
            }
          case 320000:
            size = item.hMusic ? sizeFormate(item.hMusic.size) : null
            types.push({ type: '320k', size })
            _types['320k'] = {
              size,
            }
          case 999000:
            size = item.sqMusic ? sizeFormate(item.sqMusic.size) : null
            types.push({ type: 'flac', size })
            _types.flac = {
              size,
            }
          case 1999000:
            size = item.hrMusic ? sizeFormate(item.hrMusic.size) : null
            types.push({ type: 'flac24bit', size })
            _types.flac24bit = {
              size,
            }
        }
      })

      list.push({
        singer: formatSingerName(item.artists),
        name: item.name,
        albumName: item.album.name,
        albumId: item.album.id,
        songmid: item.id,
        source: 'wy',
        interval: formatPlayTime(item.duration / 1000),
        img: null,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      })
    })
    return list
  },
}
