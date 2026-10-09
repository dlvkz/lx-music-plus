import { memo } from 'react'
import { Image as RNImage, View } from 'react-native'
import Image from './Image'
import { useTheme } from '@/store/theme/hook'
import { LIST_IDS } from '@/config/constant'
import { getBuiltInListCover } from '@/utils/listName'
import { useListCover } from '@/utils/listCover'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const musicHeart = require('@/resources/images/music_heart.png')

/**
 * Cover of one of the user's lists: the picture picked by the user, the picture of the collected
 * playlist, the art of a song of the list otherwise. An empty loved list shows the heart of the
 * desktop app (music_heart.svg).
 */
export default memo(({ listId, cover, size, borderRadius = 12 }: {
  listId: string
  /** cover taken from the songs of the list */
  cover: string | null
  size: number
  borderRadius?: number
}) => {
  const theme = useTheme()
  const customCover = getBuiltInListCover(listId)
  const savedCover = useListCover(listId)

  if (listId == LIST_IDS.LOVE && !customCover && !cover) {
    return (
      <View style={{ width: size, height: size, borderRadius, alignItems: 'center', justifyContent: 'center', backgroundColor: theme['c-primary-light-200-alpha-900'] }}>
        <RNImage source={musicHeart} style={{ width: size * 0.78, height: size * 0.78, tintColor: theme['c-primary-light-400-alpha-400'] }} />
      </View>
    )
  }
  return <Image url={customCover ?? savedCover ?? cover} style={{ width: size, height: size, borderRadius }} />
})
