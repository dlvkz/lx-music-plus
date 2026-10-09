import SkipIcon from '@/components/common/SkipIcon'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
// import { useIsPlay } from '@/store/player/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { useIsPlay } from '@/store/player/hook'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { BTN_WIDTH } from './MoreBtn/Btn'
import PlayModeBtn from './MoreBtn/PlayModeBtn'
import MusicAddBtn from './MoreBtn/MusicAddBtn'

const PrevBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayPrev = () => {
    void playPrev()
  }
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, width: size, height: size }} activeOpacity={0.5} onPress={handlePlayPrev}>
      <SkipIcon direction="prev" color={theme['c-font']} rawSize={size * 0.5} />
    </TouchableOpacity>
  )
}
const NextBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const handlePlayNext = () => {
    void playNext()
  }
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, width: size, height: size }} activeOpacity={0.5} onPress={handlePlayNext}>
      <SkipIcon direction="next" color={theme['c-font']} rawSize={size * 0.5} />
    </TouchableOpacity>
  )
}

// the play button sits in a circle, like the Alger mobile player
const TogglePlayBtn = ({ size }: { size: number }) => {
  const theme = useTheme()
  const isPlay = useIsPlay()
  return (
    <TouchableOpacity style={{ ...styles.cotrolBtn, width: size, height: size, borderRadius: size / 2, backgroundColor: theme['c-primary-light-400-alpha-700'] }} activeOpacity={0.5} onPress={togglePlay}>
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-font']} rawSize={size * 0.42} />
    </TouchableOpacity>
  )
}

const MAX_SIZE = BTN_WIDTH * 1.5
const MIN_SIZE = BTN_WIDTH * 1.2

export default () => {
  const winSize = useWindowSize()
  const size = Math.min(Math.max(winSize.width * 0.14, MIN_SIZE), MAX_SIZE)

  return (
    <View style={styles.conatiner}>
      <PlayModeBtn />
      <PrevBtn size={size} />
      <TogglePlayBtn size={size * 1.3} />
      <NextBtn size={size} />
      <MusicAddBtn />
    </View>
  )
}


const styles = createStyle({
  conatiner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: '2%',
    paddingTop: 14,
    paddingBottom: 10,
    // backgroundColor: 'rgba(0, 0, 0, .1)',
  },
  cotrolBtn: {
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
