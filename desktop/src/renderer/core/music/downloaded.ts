import { downloadList } from '@renderer/store/download/state'
import { getDownloadList } from '@renderer/store/download/action'
import { buildSavePath } from '@renderer/store/download/utils'
import { getDownloadFilePath } from '@renderer/utils/music'

// A song that is downloaded is played from its file, wherever it is played from (a playlist, an album, the radio):
// the online url only when there is no file. Its menu shows the file in its folder.

const getTasks = (musicInfo: LX.Music.MusicInfoOnline) => {
  return downloadList.filter(task => task.isComplate && task.metadata.musicInfo.id == musicInfo.id)
}

/**
 * Whether a song has a file: a local song, or a song downloaded (the download tasks loaded: getDownloadList)
 */
export const hasMusicFile = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  if ('progress' in musicInfo) return musicInfo.isComplate
  if (musicInfo.source == 'local') return true
  return getTasks(musicInfo).length > 0
}

/**
 * The file of a song downloaded (whatever its quality), '' when it has none
 */
export const getDownloadedFilePath = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem): Promise<string> => {
  if ('progress' in musicInfo) return getDownloadFilePath(musicInfo, buildSavePath(musicInfo))
  if (musicInfo.source == 'local') return ''
  await getDownloadList()
  for (const task of getTasks(musicInfo)) {
    const path = await getDownloadFilePath(task, buildSavePath(task))
    if (path) return path
  }
  return ''
}
