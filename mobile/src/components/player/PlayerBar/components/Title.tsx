import { TranslatedText } from '@/components/common/TranslatedText'
import { useMemo, useRef } from 'react'
import { Animated, PanResponder, TouchableOpacity } from 'react-native'
import { playNext, playPrev } from '@/core/player/player'
import { navigations } from '@/navigation'
import { usePlayerMusicInfo } from '@/store/player/hook'
// import { toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import commonState from '@/store/common/state'
import playerState from '@/store/player/state'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { createStyle, formatMusicName } from '@/utils/tools'


// a swipe on the title: left the next song, right the one before
const SWIPE_DISTANCE = 50
const SWIPE_VELOCITY = 0.4
const SWIPE_OUT = 80

const useSwipeToggle = () => {
  const translateX = useRef(new Animated.Value(0)).current
  const opacity = useMemo(() => translateX.interpolate({ inputRange: [-SWIPE_OUT, 0, SWIPE_OUT], outputRange: [0, 1, 0], extrapolate: 'clamp' }), [translateX])
  const panResponder = useMemo(() => {
    const reset = () => {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 4 }).start()
    }
    return PanResponder.create({
      // (a tap or a long press stays the one of the title, a horizontal move is a swipe)
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderMove: (_, { dx }) => {
        translateX.setValue(dx * 0.6)
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const isNext = dx < -SWIPE_DISTANCE || (vx < -SWIPE_VELOCITY && dx < -20)
        const isPrev = dx > SWIPE_DISTANCE || (vx > SWIPE_VELOCITY && dx > 20)
        if ((!isNext && !isPrev) || !playerState.playMusicInfo.musicInfo) {
          reset()
          return
        }
        // out on the side of the swipe, the new title in from the other side
        Animated.timing(translateX, { toValue: isNext ? -SWIPE_OUT : SWIPE_OUT, duration: 120, useNativeDriver: true }).start(() => {
          void (isNext ? playNext() : playPrev())
          translateX.setValue(isNext ? SWIPE_OUT / 2 : -SWIPE_OUT / 2)
          reset()
        })
      },
      onPanResponderTerminate: reset,
    })
  }, [translateX])
  return { panHandlers: panResponder.panHandlers, style: { transform: [{ translateX }], opacity } }
}

export default ({ isHome }: { isHome: boolean }) => {
  const swipe = useSwipeToggle()
  // const { t } = useTranslation()
  const musicInfo = usePlayerMusicInfo()
  const downloadFileName = useSettingValue('download.fileName')
  const theme = useTheme()

  const handlePress = () => {
    // console.log('')
    // console.log(playMusicInfo)
    if (!musicInfo.id) return
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
    // toast(global.i18n.t('play_detail_todo_tip'), 'long')
  }

  const handleLongPress = () => {
    const listId = playerState.playMusicInfo.listId
    if (!listId || listId == LIST_IDS.DOWNLOAD) return
    global.app_event.jumpListPosition()
  }
  // console.log('render title')

  const title = musicInfo.id
    ? musicInfo.singer
      ? formatMusicName(downloadFileName, musicInfo.name, musicInfo.singer)
      : musicInfo.name
    : ''
  // console.log(playMusicInfo)
  return (
    <Animated.View style={swipe.style} {...swipe.panHandlers}>
      <TouchableOpacity style={styles.container} onLongPress={handleLongPress} onPress={handlePress} activeOpacity={0.7} >
        <Text color={theme['c-font']} numberOfLines={1} style={styles.title}><TranslatedText text={title} /></Text>
      </TouchableOpacity>
    </Animated.View>
  )
}
// const Singer = () => {
//   const playMusicInfo = useGetter('player', 'playMusicInfo')
//   return (
//     <View style={{ flexGrow: 0, flexShrink: 0 }}>
//       <Text style={{ width: '100%', color: AppColors.normal }} numberOfLines={1}>
//         {playMusicInfo ? playMusicInfo.musicInfo.singer : ''}
//       </Text>
//     </View>
//   )
// }
// const MusicName = () => {
//   const playMusicInfo = useGetter('player', 'playMusicInfo')
//   return (
//     <View style={{ flexGrow: 0, flexShrink: 1 }}>
//       <Text style={{ width: '100%', color: AppColors.normal }} numberOfLines={1}>
//         {playMusicInfo ? playMusicInfo.musicInfo.name : '^-^'}
//       </Text>
//     </View>
//   )
// }

const styles = createStyle({
  container: {
    width: '100%',
    paddingHorizontal: 2,
  },
  title: {
    fontWeight: 'bold',
    // paddingBottom: 4,
    // height: '50%',
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
})
