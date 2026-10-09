import { useTranslation } from '@/components/common/TranslatedText'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, TouchableOpacity, View } from 'react-native'
// import { useLayout } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import { useIsPlay, usePlayerMusicInfo } from '@/store/player/hook'
import { useWindowSize } from '@/utils/hooks'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { useNavigationComponentDidAppear } from '@/navigation'
import { HEADER_HEIGHT } from './components/Header'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import commonState from '@/store/common/state'
import { useLrcPlay, useLrcSet } from '@/plugins/lyric'
import { getPlayingMusicInfo, toggleLoved, useIsLoved } from '@/core/player/loved'
import { openAlbum, openArtist } from '@/core/musicLinks'
import HeartIcon from '@/components/common/HeartIcon'
import { useSettingValue } from '@/store/setting/hook'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'

// one turn takes two minutes, as on the desktop app
const ROTATE_DURATION = 120000
const PREVIEW_LINES = 3
const CD_DOTS = [['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']] as const

// Cover: a square, or a turning disc, a tap switches between them
const Cover = memo(({ componentId, size }: { componentId: string, size: number }) => {
  const musicInfo = usePlayerMusicInfo()
  const isPlay = useIsPlay()
  const isDisc = useSettingValue('playDetail.isDiscCover')
  const [animated, setAnimated] = useState(!!commonState.componentIds.playDetail)
  const [pic, setPic] = useState(musicInfo.pic)
  const theme = useTheme()
  const rotate = useRef(new Animated.Value(0)).current
  const rotateValue = useRef(0)

  useEffect(() => {
    if (animated) setPic(musicInfo.pic)
  }, [musicInfo.pic, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  useEffect(() => {
    if (!isDisc) {
      rotate.setValue(0)
      rotateValue.current = 0
      return
    }
    if (!isPlay) return
    let isStopped = false
    const run = (from: number) => {
      rotate.setValue(from)
      Animated.timing(rotate, {
        toValue: 1,
        duration: ROTATE_DURATION * (1 - from),
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !isStopped) run(0)
      })
    }
    run(rotateValue.current)
    return () => {
      isStopped = true
      rotate.stopAnimation(value => {
        rotateValue.current = value >= 1 ? 0 : value
      })
    }
  }, [isDisc, isPlay, rotate])

  const toggleStyle = useCallback(() => {
    updateSetting({ 'playDetail.isDiscCover': !settingState.setting['playDetail.isDiscCover'] })
  }, [])

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  // a case with a dot in each corner, holding the disc: a thin rim, the cover,
  // a tinted ring around the hole in the middle
  const casePadding = size * 0.05
  const dotSize = size * 0.07
  const discSize = size - casePadding * 2
  const picSize = discSize * 0.96
  const ringSize = discSize * 0.4
  const holeSize = discSize * 0.232
  const caseColor = theme['c-primary-light-300-alpha-800']

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={toggleStyle}>
      {
        isDisc
          ? <View style={{ ...styles.cdCase, width: size, height: size, padding: casePadding, backgroundColor: caseColor }}>
              {
                CD_DOTS.map(([vertical, horizontal]) => (
                  <View key={vertical + horizontal} style={{ ...styles.cdDot, [vertical]: casePadding, [horizontal]: casePadding, width: dotSize, height: dotSize, borderRadius: dotSize / 2, borderColor: theme['c-primary-dark-300-alpha-800'], backgroundColor: caseColor }} />
                ))
              }
              <Animated.View style={{ ...styles.cd, width: discSize, height: discSize, borderRadius: discSize / 2, backgroundColor: theme['c-primary-light-400'], transform: [{ rotate: spin }] }}>
                {/* no shared element transition: it would leave the cover off the center of the turning disc */}
                <Image url={pic} style={{ width: picSize, height: picSize, borderRadius: picSize / 2 }} />
                <View style={{ ...styles.cdCenter, width: ringSize, height: ringSize, borderRadius: ringSize / 2, backgroundColor: theme['c-primary-light-300-alpha-600'] }}>
                  <View style={{ ...styles.cdHole, width: holeSize, height: holeSize, borderRadius: holeSize / 2, borderWidth: Math.max(1, discSize * 0.012), borderColor: theme['c-primary-light-300'], backgroundColor: theme['c-content-background'] }}>
                    <View style={{ ...styles.cdHoleFill, backgroundColor: caseColor }} />
                  </View>
                </View>
              </Animated.View>
            </View>
          : <View style={{ ...styles.square, elevation: animated ? 6 : 0 }}>
              <Image url={pic} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pic} style={{ width: size, height: size, borderRadius: 14 }} />
            </View>
      }
    </TouchableOpacity>
  )
})

const SongInfo = memo(() => {
  const theme = useTheme()
  const musicInfo = usePlayerMusicInfo()
  const isLoved = useIsLoved(musicInfo.id)
  // the original title and artist, each followed by its translation (informative)
  const translatedName = useTranslation(musicInfo.name)
  const translatedSinger = useTranslation(musicInfo.singer)

  const handleOpenArtist = () => {
    const info = getPlayingMusicInfo()
    if (info) void openArtist(info)
  }
  // the title opens the album of the song
  const handleOpenAlbum = () => {
    const info = getPlayingMusicInfo()
    if (info) void openAlbum(info)
  }
  const toggleLove = () => {
    toggleLoved(isLoved)
  }

  return (
    <View style={styles.songInfo}>
      <View style={styles.songText}>
        <Text size={22} numberOfLines={1} style={styles.songName} onPress={handleOpenAlbum}>{musicInfo.name}</Text>
        { translatedName ? <Text size={13} numberOfLines={1} color={theme['c-font-label']} style={styles.originalName} onPress={handleOpenAlbum}>{translatedName}</Text> : null }
        <Text size={15} numberOfLines={1} color={theme['c-font-label']} onPress={handleOpenArtist}>{musicInfo.singer}</Text>
        { translatedSinger ? <Text size={13} numberOfLines={1} color={theme['c-font-label']} style={styles.originalName} onPress={handleOpenArtist}>{translatedSinger}</Text> : null }
      </View>
      <TouchableOpacity activeOpacity={0.6} onPress={toggleLove} style={styles.loveBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <HeartIcon loved={isLoved} size={26} />
      </TouchableOpacity>
    </View>
  )
})

// The current lyric line and the next ones, a tap opens the lyric page
const LyricPreview = memo(({ onPress }: { onPress: () => void }) => {
  const theme = useTheme()
  const lines = useLrcSet()
  const { line } = useLrcPlay()
  const visibleLines = useMemo(() => {
    const start = Math.max(line, 0)
    return lines.slice(start, start + PREVIEW_LINES)
  }, [lines, line])

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.lyric}>
      {
        visibleLines.map((item, index) => (
          <Text key={`${line}_${index}`} numberOfLines={1}
            size={index == 0 ? 17 : 15}
            color={index == 0 ? theme['c-primary-font-active'] : theme['c-font-label']}
            style={index == 0 ? styles.lyricActive : { ...styles.lyricLine, opacity: index == 1 ? 0.75 : 0.45 }}
          >{item.text}</Text>
        ))
      }
    </TouchableOpacity>
  )
})

export default ({ componentId, onShowLyric }: { componentId: string, onShowLyric: () => void }) => {
  const { width: winWidth, height: winHeight } = useWindowSize()
  const statusBarHeight = useStatusbarHeight()
  // console.log('render pic')

  const size = Math.floor(Math.min(winWidth * 0.84, (winHeight - statusBarHeight - HEADER_HEIGHT) * 0.46))

  return (
    <View style={styles.container}>
      <View style={styles.cover}>
        <Cover componentId={componentId} size={size} />
      </View>
      <View style={{ ...styles.info, width: Math.max(size, winWidth * 0.84) }}>
        <SongInfo />
        <LyricPreview onPress={onShowLyric} />
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  cover: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  square: {
    backgroundColor: 'rgba(0,0,0,0)',
    borderRadius: 14,
  },
  cdCase: {
    borderRadius: 6,
    opacity: 0.92,
  },
  cdDot: {
    position: 'absolute',
    borderWidth: 1,
  },
  cd: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  cdCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cdHole: {
    overflow: 'hidden',
  },
  cdHoleFill: {
    flex: 1,
  },
  info: {
    flexGrow: 0,
    flexShrink: 0,
  },
  songInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  songText: {
    flex: 1,
  },
  originalName: {
    marginBottom: 3,
  },
  songName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  loveBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyric: {
    height: 88,
    justifyContent: 'center',
    marginTop: 6,
  },
  lyricActive: {
    fontWeight: 'bold',
    paddingVertical: 2,
  },
  lyricLine: {
    fontWeight: 'bold',
    paddingVertical: 2,
  },
})
