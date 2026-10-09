import { memo, useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'
import Text from './Text'
import { TranslatedText } from './TranslatedText'
import { BackButton, PlayButton } from './ActionIcons'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'

/**
 * Banner shown at the top of a list page once its header has been scrolled away:
 * back button, title of the list and the play button
 */
export default memo(({ visible, title, onBack, onPlay, withStatusBar = true }: {
  visible: boolean
  title: string
  onBack: () => void
  onPlay: () => void
  /** the banner starts under the status bar, as the page does */
  withStatusBar?: boolean
}) => {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start()
  }, [visible, opacity])

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{ ...styles.container, paddingTop: withStatusBar ? statusBarHeight : 0, backgroundColor: theme['c-content-background'], opacity }}
    >
      <View style={styles.content}>
        <BackButton onPress={onBack} />
        <Text size={17} numberOfLines={1} style={styles.title}><TranslatedText text={title} replace /></Text>
        <PlayButton onPress={onPlay} size={34} />
      </View>
    </Animated.View>
  )
})

/**
 * Scroll offset after which the banner is shown
 */
export const STICKY_OFFSET = 120

const styles = createStyle({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    zIndex: 5,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 5,
  },
  title: {
    flex: 1,
    fontWeight: 'bold',
  },
})
