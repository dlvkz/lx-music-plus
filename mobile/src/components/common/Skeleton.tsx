import { memo, useEffect, useRef } from 'react'
import { Animated, Dimensions, View, type ViewStyle } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'

// Placeholders shown while a page loads its data for the first time: blocks with the shape of
// what is coming (covers, lines of text), pulsing slowly.

const usePulse = () => {
  const opacity = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]))
    animation.start()
    return () => {
      animation.stop()
    }
  }, [opacity])
  return opacity
}

/**
 * One placeholder block
 */
export const SkeletonBlock = memo(({ width, height, radius = 6, style }: {
  width: number | `${number}%`
  height: number
  radius?: number
  style?: ViewStyle
}) => {
  const theme = useTheme()
  return <View style={{ width, height, borderRadius: radius, backgroundColor: theme['c-primary-light-900-alpha-200'], ...style }} />
})

// the blocks of a placeholder pulse together
const Pulse = ({ children, style }: { children: React.ReactNode, style?: ViewStyle }) => {
  const opacity = usePulse()
  return <Animated.View style={{ ...style, opacity }}>{children}</Animated.View>
}

/**
 * Rows of songs: a cover and two lines of text.
 * Without a count there are enough rows to go past the bottom of the screen.
 */
export const SkeletonSongRows = memo(({ count: _count, rowHeight = 56, picSize = 44 }: { count?: number, rowHeight?: number, picSize?: number }) => {
  const count = _count ?? Math.ceil(Dimensions.get('window').height / rowHeight) + 2
  return (
    <Pulse>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ ...styles.songRow, height: rowHeight }}>
          <SkeletonBlock width={picSize} height={picSize} radius={8} />
          <View style={styles.songText}>
            <SkeletonBlock width={index % 3 == 0 ? '45%' : index % 3 == 1 ? '70%' : '55%'} height={13} />
            <SkeletonBlock width={index % 2 ? '30%' : '40%'} height={10} />
          </View>
          <SkeletonBlock width={34} height={10} />
        </View>
      ))}
    </Pulse>
  )
})

/**
 * Grid of squares with their name under them (charts, playlists)
 */
export const SkeletonGrid = memo(({ size, columns = 3, rows = 4, gap = 12, padding = 12 }: {
  size: number
  columns?: number
  rows?: number
  gap?: number
  padding?: number
}) => {
  return (
    <Pulse style={{ paddingHorizontal: padding, gap: 14 }}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', gap }}>
          {Array.from({ length: columns }, (_, column) => (
            <View key={column} style={{ width: size, alignItems: 'center', gap: 7 }}>
              <SkeletonBlock width={size} height={size} radius={12} />
              <SkeletonBlock width={size * 0.7} height={11} />
            </View>
          ))}
        </View>
      ))}
    </Pulse>
  )
})

/**
 * Row of cards scrolling sideways (playlists, albums, artists of the home page)
 */
export const SkeletonRail = memo(({ size, count = 4, round = false, padding = 16 }: { size: number, count?: number, round?: boolean, padding?: number }) => {
  return (
    <Pulse style={{ flexDirection: 'row', gap: 12, paddingHorizontal: padding, overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={{ width: size, alignItems: 'center', gap: 7 }}>
          <SkeletonBlock width={size} height={size} radius={round ? size / 2 : 12} />
          <SkeletonBlock width={size * 0.7} height={11} />
        </View>
      ))}
    </Pulse>
  )
})

const CHIP_WIDTHS = [84, 120, 66, 104, 92, 72, 130, 80]
/**
 * Rows of chips (searches, categories)
 */
export const SkeletonChips = memo(({ rows = 2, padding = 16 }: { rows?: number, padding?: number }) => {
  return (
    <Pulse style={{ gap: 8, paddingHorizontal: padding, overflow: 'hidden' }}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.chipRow}>
          {CHIP_WIDTHS.map((width, index) => <SkeletonBlock key={index} width={CHIP_WIDTHS[(index + row * 3) % CHIP_WIDTHS.length]} height={30} radius={15} />)}
        </View>
      ))}
    </Pulse>
  )
})

/**
 * Title of a section
 */
export const SkeletonTitle = memo(({ padding = 16 }: { padding?: number }) => {
  return (
    <Pulse style={{ paddingHorizontal: padding, marginBottom: 12 }}>
      <SkeletonBlock width={150} height={20} />
    </Pulse>
  )
})

const styles = createStyle({
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  songText: {
    flex: 1,
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
})
