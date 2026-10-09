import * as React from 'react'
import {
  Animated,
  type GestureResponderEvent,
  StyleSheet,
  View,
  Pressable,
} from 'react-native'

import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

export interface Props {
  /**
   * Status of checkbox.
   */
  status: 'checked' | 'unchecked' | 'indeterminate'
  /**
   * Whether checkbox is disabled.
   */
  disabled?: boolean
  /**
   * Function to execute on press.
   */
  onPress?: (e: GestureResponderEvent) => void

  size?: number

  /**
   * Custom color for checkbox.
   */
  tintColors: {
    true: string
    false: string
  }
}

const ANIMATION_DURATION = 200
const PADDING = scaleSizeW(4)

/**
 * Checkboxes allow the selection of multiple options from a set.
 * This component follows platform guidelines for Android, but can be used
 * on any platform.
 */
const Checkbox = ({
  status,
  disabled,
  size = 1,
  onPress,
  tintColors,
  ...rest
}: Props) => {
  const checked = status === 'checked'
  const indeterminate = status === 'indeterminate'

  const theme = useTheme()
  const boxSize = scaleSizeW(21 * size)
  const lineWidth = Math.max(1.5, boxSize * 0.09)

  const { current: scaleAnim } = React.useRef<Animated.Value>(
    new Animated.Value(checked ? 1 : 0),
  )

  const isFirstRendering = React.useRef<boolean>(true)


  React.useEffect(() => {
    // Do not run animation on very first rendering
    if (isFirstRendering.current) {
      isFirstRendering.current = false
      return
    }

    Animated.timing(scaleAnim, {
      toValue: checked ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start()
  }, [checked, scaleAnim])


  return (
    <Pressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ disabled, checked }}
      accessibilityLiveRegion="polite"
      style={{ ...styles.container, padding: PADDING, marginLeft: -PADDING }}
    >
      <View style={{ width: boxSize, height: boxSize, borderRadius: boxSize / 2, borderWidth: lineWidth, borderColor: tintColors.false }} />
      <View style={[StyleSheet.absoluteFill, styles.fillContainer]}>
        <Animated.View style={{ ...styles.fillContainer, width: boxSize, height: boxSize, borderRadius: boxSize / 2, backgroundColor: tintColors.true, transform: [{ scale: scaleAnim }] }}>
          {
            indeterminate
              ? <View style={{ width: boxSize * 0.5, height: lineWidth, borderRadius: lineWidth, backgroundColor: theme['c-content-background'] }} />
              : <View style={{ width: boxSize * 0.28, height: boxSize * 0.5, marginTop: -boxSize * 0.1, borderRightWidth: lineWidth, borderBottomWidth: lineWidth, borderColor: theme['c-content-background'], transform: [{ rotate: '45deg' }] }} />
          }
        </Animated.View>
      </View>
    </Pressable>
  )
}

Checkbox.displayName = 'Checkbox'

const styles = createStyle({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  fillContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})

export default Checkbox

