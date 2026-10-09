import { httpFetch } from '../../request'
import { decodeName } from '../../index'
import { formatSinger, objStr2JSON } from './util'
import album from './album'

const request = async(url) => {
  const { body, statusCode } = await httpFetch(url).promise
  if (statusCode !== 200) throw new Error('request failed: ' + statusCode)
  return typeof body == 'string' ? objStr2JSON(body) : body
}

export default {
  limit_song: 100,
  /**
   * 通过名称搜索歌手，返回歌手 id
   */
  async search(name) {
    const body = await request(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(name)}&pn=0&rn=10&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=artist&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`)
    const list = body.abslist ?? []
    const target = name.toLowerCase()
    const item = list.find(s => decodeName(s.ARTIST).toLowerCase() == target || decodeName(s.AARTIST).toLowerCase() == target) ?? list[0]
    return item ? item.ARTISTID : null
  },
  /**
   * 获取歌手信息
   */
  async getInfo(id) {
    const body = await request(`http://search.kuwo.cn/r.s?stype=artistinfo&artistid=${id}&rformat=json&encoding=utf8`)
    if (!body.name) throw new Error('get singer info failed.')
    return {
      source: 'kw',
      id: body.id,
      info: {
        name: decodeName(body.name),
        desc: decodeName(body.info || body.desc || ''),
        avatar: body.hts_pic || (body.pic ? `https://img1.kuwo.cn/star/starheads/${body.pic.replace(/^\d+\//, '240/')}` : ''),
        gender: body.gender,
        country: body.country,
      },
      count: {
        music: parseInt(body.musicnum) || 0,
        album: parseInt(body.albumnum) || 0,
      },
    }
  },
  /**
   * 获取歌手歌曲列表
   */
  async getSongList(id, page = 1, limit = this.limit_song) {
    const body = await request(`http://search.kuwo.cn/r.s?stype=artist2music&artistid=${id}&pn=${page - 1}&rn=${limit}&rformat=json&encoding=utf8&sortby=0`)
    if (!body.musiclist) throw new Error('get singer song list failed.')
    const list = body.musiclist.map(item => {
      const formats = (item.formats ?? '').split('|')
      const types = []
      const _types = {}
      const add = (type) => {
        types.push({ type, size: null })
        _types[type] = { size: null }
      }
      if (formats.includes('MP3128')) add('128k')
      if (formats.includes('MP3H')) add('320k')
      if (formats.includes('ALFLAC')) add('flac')
      if (formats.includes('HIRFLAC')) add('flac24bit')
      const sec = parseInt(item.duration)
      return {
        singer: formatSinger(decodeName(item.artist)),
        name: decodeName(item.name),
        albumName: decodeName(item.album),
        albumId: item.albumid,
        songmid: item.musicrid ?? String(item.id).replace('MUSIC_', ''),
        source: 'kw',
        interval: Number.isNaN(sec) ? null : `${String(Math.trunc(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`,
        img: item.web_albumpic_short ? `https://img1.kuwo.cn/star/albumcover/${item.web_albumpic_short.replace(/^\d+\//, '500/')}` : null,
        lrc: null,
        otherSource: null,
        types,
        _types,
        typeUrl: {},
      }
    })
    return {
      list,
      limit,
      page,
      total: parseInt(body.total),
      source: 'kw',
    }
  },
  /**
   * 获取歌手专辑列表
   */
  async getAlbumList(id, page = 1, limit = 30) {
    const body = await request(`http://search.kuwo.cn/r.s?stype=albumlist&artistid=${id}&sortby=1&alflag=1&pn=${page - 1}&rn=${limit}&rformat=json&encoding=utf8`)
    if (!body.albumlist) throw new Error('get singer album list failed.')
    return {
      source: 'kw',
      list: body.albumlist.map(item => ({
        id: item.albumid ?? item.id,
        info: {
          name: decodeName(item.name),
          author: decodeName(item.artist),
          img: item.img || item.hts_img,
          time: item.pub,
        },
        count: parseInt(item.musiccnt) || null,
      })),
      limit,
      page,
      total: parseInt(body.total),
    }
  },
  getAlbumDetail(id, page = 1) {
    return album.getAlbumListDetail(id, page)
  },
}
