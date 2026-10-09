import { appendFile, downloadFile, existsFile, mkdir, moveFile, readFile, stat, temporaryDirectoryPath, unlink } from '@/utils/fs'
import { NativeModules } from 'react-native'
import { getHlsParts, setSecondaryYtdlp } from '@/utils/secondarySources'
import { resolveSecondaryStream } from '@/utils/sourceAddons'

// Audio of the songs of the secondary sources (utils/secondarySources.ts). The player has no HLS
// support: a SoundCloud HLS playlist (mp3 parts) is joined into one mp3 file of the cache.

// yt-dlp for the YouTube source: python + yt-dlp bundled with the app (android YtdlpModule, Android 7.0+)
const YtdlpModule = NativeModules.YtdlpModule as { run: (url: string, options: string[]) => Promise<string> } | undefined
setSecondaryYtdlp(YtdlpModule ? async(url, options) => YtdlpModule.run(url, options) : null)

const AUDIO_DIR = `${temporaryDirectoryPath}/secondary_audio`
const joining = new Map<string, Promise<string>>()

const joinHlsParts = async(playlistUrl: string, id: string): Promise<string> => {
  const path = `${AUDIO_DIR}/${id.replace(/[^\w-]/g, '_')}.mp3`
  if (await existsFile(path) && (await stat(path)).size > 0) return path
  await mkdir(AUDIO_DIR).catch(() => {})
  const parts = await getHlsParts(playlistUrl)
  if (!parts.length) throw new Error('empty playlist')
  const partPath = `${path}.part`
  const tempPath = `${path}.tmp`
  await unlink(tempPath).catch(() => {})
  try {
    for (const part of parts) {
      const { promise } = downloadFile(part, partPath)
      const { statusCode } = await promise
      if (statusCode < 200 || statusCode >= 300) throw new Error(`part download failed: ${statusCode}`)
      await appendFile(tempPath, await readFile(partPath, 'base64'), 'base64')
    }
    await unlink(path).catch(() => {})
    // the whole file only: a failed join is not taken for the song later
    await moveFile(tempPath, path)
    return path
  } finally {
    await unlink(partPath).catch(() => {})
    await unlink(tempPath).catch(() => {})
  }
}

/**
 * Link to the audio of a secondary source song (a file of the cache for a HLS playlist)
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
  return `file://${await task}`
}
