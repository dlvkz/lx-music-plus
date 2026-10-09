import SkipIcon from '@/components/common/SkipIcon'
import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { toggleLoved, useIsLoved } from '@/core/player/loved'
import { useTheme } from '@/store/theme/hook'
import { playNext, playPrev, togglePlay } from '@/core/player/player'
import { createStyle } from '@/utils/tools'
import { useHorizontalMode } from '@/utils/hooks'
import HeartIcon from '@/components/common/HeartIcon'

const handlePlayPrev = () => {
  void playPrev()
}
const handlePlayNext = () => {
  void playNext()
}

const PlayPrevBtn = () => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={handlePlayPrev}>
      <SkipIcon direction="prev" color={theme['c-font']} size={19} />
    </TouchableOpacity>
  )
}

const PlayNextBtn = () => {
  const theme = useTheme()

  return (
    <TouchableOpacity style={styles.cotrolBtn} activeOpacity={0.5} onPress={handlePlayNext}>
      <SkipIcon direction="next" color={theme['c-font']} size={19} />
    </TouchableOpacity>
  )
}

const LoveBtn = () => {
  const musicInfo = usePlayerMusicInfo()
  const isLoved = useIsLoved(musicInfo.id)

  return (
    <TouchableOpacity style={styles.loveBtn} activeOpacity={0.5} disabled={!musicInfo.id} onPress={() => { toggleLoved(isLoved) }}>
      <HeartIcon loved={isLoved} size={22} />
    </TouchableOpacity>
  )
}

const TogglePlayBtn = () => {
  const isPlay = useIsPlay()
  const theme = useTheme()

  return (
    <TouchableOpacity style={{ ...styles.playBtn, backgroundColor: theme['c-primary-light-400-alpha-700'] }} activeOpacity={0.5} onPress={togglePlay}>
      <Icon name={isPlay ? 'pause' : 'play'} color={theme['c-font']} size={16} />
    </TouchableOpacity>
  )
}

export default () => {
  const isHorizontalMode = useHorizontalMode()
  return (
    <>
      {/* <TouchableOpacity activeOpacity={0.5} onPress={toggleNextPlayMode}>
        <Text style={{ ...styles.cotrolBtn }}>
          <Icon name={playModeIcon} style={{ color: theme.secondary10 }} size={18} />
        </Text>
      </TouchableOpacity>
    */}
      {/* {btnPrev} */}
      { isHorizontalMode ? <PlayPrevBtn /> : null }
      <LoveBtn />
      <TogglePlayBtn />
      <PlayNextBtn />
    </>
  )
}


const styles = createStyle({
  loveBtn: {
    width: 40,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cotrolBtn: {
    width: 42,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
