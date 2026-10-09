import { httpFetch } from '../../request'
import { formatPlayCount } from '../../index'

// Home page recommendations, these endpoints work without an account
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://music.163.com/',
}

const request = async(path) => {
  const { body, statusCode } = await httpFetch(`https://music.163.com/api/${path}`, { headers }).promise
  if (statusCode != 200 || body.code != 200) throw new Error('failed')
  return body
}

export default {
  /**
   * Recommended playlists
   * @param {number} limit
   */
  async getRecommendPlaylists(limit = 12) {
    const body = await request(`personalized/playlist?limit=${limit}`)
    return body.result.map(item => ({
      id: String(item.id),
      name: item.name,
      author: '',
      img: item.picUrl,
      play_count: formatPlayCount(item.playCount),
      total: String(item.trackCount),
      source: 'wy',
    }))
  },

  /**
   * Hot artists
   * @param {number} limit
   */
  async getHotArtists(limit = 12) {
    const body = await request(`artist/top?limit=${limit}&offset=0&total=true`)
    return body.artists.map(item => ({
      id: String(item.id),
      name: item.name,
      img: item.img1v1Url || item.picUrl,
      source: 'wy',
    }))
  },

  /**
   * New albums
   * @param {number} limit
   */
  async getNewAlbums(limit = 12) {
    const body = await request(`album/new?area=ALL&limit=${limit}&offset=0&total=true`)
    return body.albums.map(item => ({
      id: String(item.id),
      name: item.name,
      img: item.picUrl,
      artist: (item.artists?.length ? item.artists.map(a => a.name).join('、') : item.artist?.name) ?? '',
      source: 'wy',
    }))
  },

  /**
   * Playlists that contain a song
   * @param {string} songId
   */
  async getRelatedPlaylists(songId) {
    const body = await request(`discovery/simiPlaylist?songid=${songId}&limit=5&offset=0`)
    return (body.playlists ?? []).map(item => ({
      id: String(item.id),
      name: item.name,
      img: item.coverImgUrl,
      source: 'wy',
    }))
  },
}
