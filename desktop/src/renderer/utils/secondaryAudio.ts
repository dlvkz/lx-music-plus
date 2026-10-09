import needle from 'needle'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { themeInfo } from '@renderer/store'
import { getHlsParts, setSecondaryHttp, setSecondaryYtdlp, type SecondaryHttp } from './secondarySources'
import { resolveSecondaryStream } from './sourceAddons'

// Audio of the songs of the secondary sources (utils/secondarySources.ts) on desktop: the requests go
// through node (no CORS), a SoundCloud HLS playlist (mp3 parts) is joined into one mp3 file of the
// temporary folder (the player has no HLS support).

// the pages of Bandcamp answer a captcha to node (its TLS), the fetch of the window (no CORS in this
// window) is a browser for them
const BROWSER_FETCH_RXP = /^https:\/\/[^/]*bandcamp\.com\//

const needleRequest: SecondaryHttp = async(url, options) => new Promise((resolve, reject) => {
  needle.request((options?.method ?? 'GET').toLowerCase() as 'get', url, options?.body ?? null, {
    headers: options?.headers,
    follow_max: 5,
    response_timeout: 15000,
    parse: false,
    compressed: true,
  }, (err, resp) => {
    if (err) {
      reject(err)
      return
    }
    // body: the decompressed answer (raw is the gzip data)
    const body: unknown = resp.body
    resolve({ status: resp.statusCode ?? 0, body: Buffer.isBuffer(body) ? body.toString() : typeof body == 'string' ? body : JSON.stringify(body) })
  })
})

setSecondaryHttp(async(url, options) => {
  if (BROWSER_FETCH_RXP.test(url) && (options?.method ?? 'GET') == 'GET') {
    const res = await fetch(url)
    return { status: res.status, body: await res.text() }
  }
  return needleRequest(url, options)
})

/* ---------- yt-dlp (YouTube) ---------- */

// shipped with the app (resources/yt-dlp, build-config/fetch-ytdlp.js), run from a copy in the data folder
// of the app that keeps itself up to date (YouTube changes break the old versions)
const YTDLP_UPDATE_INTERVAL = 7 * 24 * 60 * 60 * 1000
const YTDLP_FILE = process.platform == 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
const getBundledYtdlp = () => {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'yt-dlp', YTDLP_FILE),
    path.join(process.cwd(), 'resources', 'yt-dlp', YTDLP_FILE),
  ]
  return candidates.find(p => fs.existsSync(p)) ?? null
}

const execYtdlp = async(file: string, args: string[]): Promise<string> => new Promise((resolve, reject) => {
  execFile(file, args, { maxBuffer: 64 * 1024 * 1024, timeout: 90_000, windowsHide: true }, (err, stdout, stderr) => {
    if (err) {
      reject(new Error(stderr?.toString().trim() || err.message))
      return
    }
    resolve(stdout.toString())
  })
})

let ytdlpPathPromise: Promise<string> | null = null
const getYtdlp = async(): Promise<string> => {
  ytdlpPathPromise ??= (async() => {
    const bundled = getBundledYtdlp()
    if (!bundled) throw new Error('yt-dlp is not bundled')
    const dir = path.join(themeInfo.dataPath || os.tmpdir(), 'yt-dlp')
    const file = path.join(dir, YTDLP_FILE)
    const stamp = path.join(dir, 'last_update')
    try {
      await fs.promises.mkdir(dir, { recursive: true })
      if (!fs.existsSync(file)) {
        await fs.promises.copyFile(bundled, file)
        // Linux: the copy has to be executable (the bundled one can be read-only, in an AppImage)
        if (process.platform != 'win32') await fs.promises.chmod(file, 0o755)
        await fs.promises.writeFile(stamp, String(Date.now()))
      }
    } catch (err) {
      console.log(err)
      // no writable copy: the bundled one is used as it is
      return bundled
    }
    // the copy updates itself once a week (in the background)
    const lastUpdate = parseInt(await fs.promises.readFile(stamp, 'utf8').catch(() => '0')) || 0
    if (Date.now() - lastUpdate > YTDLP_UPDATE_INTERVAL) {
      void fs.promises.writeFile(stamp, String(Date.now())).catch(() => {})
      void execYtdlp(file, ['-U']).then(out => { console.log('yt-dlp update:', out.trim()) }).catch(err => { console.log('yt-dlp update failed', err) })
    }
    return file
  })().catch(err => {
    ytdlpPathPromise = null
    throw err
  })
  return ytdlpPathPromise
}

setSecondaryYtdlp(async(url, options) => execYtdlp(await getYtdlp(), [...options, url]))

/* ---------- audio files ---------- */

const AUDIO_DIR = path.join(os.tmpdir(), 'lx_secondary_audio')

const downloadPart = async(url: string): Promise<Buffer> => new Promise((resolve, reject) => {
  needle.get(url, { follow_max: 5, response_timeout: 20000, parse: false }, (err, resp) => {
    if (err) {
      reject(err)
      return
    }
    if (!resp.statusCode || resp.statusCode < 200 || resp.statusCode >= 300) {
      reject(new Error(`part download failed: ${resp.statusCode}`))
      return
    }
    const body: unknown = resp.body
    resolve(Buffer.isBuffer(body) ? body : resp.raw)
  })
})

const joinHlsParts = async(playlistUrl: string, id: string): Promise<string> => {
  const filePath = path.join(AUDIO_DIR, `${id.replace(/[^\w-]/g, '_')}.mp3`)
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) return filePath
  await fs.promises.mkdir(AUDIO_DIR, { recursive: true })
  const parts = await getHlsParts(playlistUrl)
  if (!parts.length) throw new Error('empty playlist')
  const buffers: Buffer[] = []
  for (const part of parts) buffers.push(await downloadPart(part))
  // the whole file only: a failed join is not taken for the song later
  const tempPath = `${filePath}.tmp`
  await fs.promises.writeFile(tempPath, Buffer.concat(buffers))
  await fs.promises.rename(tempPath, filePath)
  return filePath
}

const joining = new Map<string, Promise<string>>()

/**
 * Link to the audio of a secondary source song (a file of the temporary folder for a HLS playlist)
 */
export const getSecondaryMusicUrl = async(musicInfo: LX.Music.MusicInfo): Promise<string> => {
  const stream = await resolveSecondaryStream(musicInfo)
  if (!stream.hls) return stream.url
  let task = joining.get(musicInfo.id)
  if (!task) {
    task = joinHlsParts(stream.url, musicInfo.id).finally(() => {
      joining.delete(musicInfo.id)
    })
    joining.set(musicInfo.id, task)
  }
  return task
}
