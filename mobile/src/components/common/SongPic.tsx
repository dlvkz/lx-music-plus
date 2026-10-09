import { memo, useEffect, useState } from 'react'
import { View } from 'react-native'
import Image from './Image'
import { useTheme } from '@/store/theme/hook'
import { getListMusicPic, getThumbnailUrl } from '@/utils/listMusicPic'

/**
 * Cover of a song in a list row, looked up when the song has none yet
 */
export default memo(({ musicInfo, size, marginRight = 0 }: {
  musicInfo: LX.Music.MusicInfo
  size: number
  marginRight?: number
}) => {
  const theme = useTheme()
  const [url, setUrl] = useState<string | null>(musicInfo.meta.picUrl ?? null)

  useEffect(() => {
    const picUrl = musicInfo.meta.picUrl ?? null
    setUrl(picUrl)
    if (picUrl) return
    return getListMusicPic(musicInfo, setUrl)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicInfo.id])

  // the tinted box shows while the image loads
  return (
    <View style={{ width: size, height: size, borderRadius: 8, marginRight, overflow: 'hidden', backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
      <Image url={getThumbnailUrl(url, 150)} style={{ width: size, height: size }} />
    </View>
  )
})
