import { memo } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Icon } from './Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'

// Icon buttons of the list pages (playlist, album, artist, chart...)

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 }

/**
 * Back arrow at the top left of a page
 */
export const BackButton = memo(({ onPress, size = 40 }: { onPress: () => void, size?: number }) => {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={HIT_SLOP} style={{ ...styles.center, width: size, height: size }}>
      <Icon name="chevron-left" size={18} />
    </TouchableOpacity>
  )
})

/**
 * Play all: a filled circle with the play icon
 */
export const PlayButton = memo(({ onPress, disabled = false, size = 40 }: { onPress: () => void, disabled?: boolean, size?: number }) => {
  const theme = useTheme()
  const btnSize = scaleSizeW(size)
  return (
    <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
      style={{ ...styles.center, width: btnSize, height: btnSize, borderRadius: btnSize / 2, backgroundColor: theme['c-primary-font-active'], opacity: disabled ? 0.5 : 1 }}>
      <Icon name="play" rawSize={btnSize * 0.4} color="#fff" style={styles.playIcon} />
    </TouchableOpacity>
  )
})

/**
 * Collect: a circled plus, a check in a filled circle once collected
 */
export const CollectButton = memo(({ onPress, collected = false, disabled = false, size = 30 }: { onPress: () => void, collected?: boolean, disabled?: boolean, size?: number }) => {
  const theme = useTheme()
  const btnSize = scaleSizeW(size)
  const barLength = btnSize * 0.46
  const barWidth = Math.max(1.5, btnSize * 0.06)
  const color = theme['c-font']
  if (collected) {
    return (
      <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
        style={{ ...styles.center, width: btnSize, height: btnSize, borderRadius: btnSize / 2, backgroundColor: color, opacity: disabled ? 0.5 : 1 }}>
        <View style={{ width: btnSize * 0.26, height: btnSize * 0.48, marginTop: -btnSize * 0.08, borderRightWidth: barWidth * 1.2, borderBottomWidth: barWidth * 1.2, borderColor: theme['c-content-background'], transform: [{ rotate: '45deg' }] }} />
      </TouchableOpacity>
    )
  }
  return (
    <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
      style={{ ...styles.center, width: btnSize, height: btnSize, borderRadius: btnSize / 2, borderWidth: barWidth, borderColor: color, opacity: disabled ? 0.5 : 1 }}>
      <View style={{ position: 'absolute', width: barLength, height: barWidth, borderRadius: barWidth, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: barWidth, height: barLength, borderRadius: barWidth, backgroundColor: color }} />
    </TouchableOpacity>
  )
})

/**
 * Ring around a button filling up clockwise (0 - 1): small segments placed around the circle
 * (clipped half circles with colored border sides are not drawn on Android)
 */
const RING_SEGMENTS = 60
const RGBA_RXP = /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/
// the segments overlap: they are drawn opaque and the alpha of the color is applied to all of them at once
const splitAlpha = (color: string) => {
  const result = RGBA_RXP.exec(color)
  return result ? { color: `rgb(${result[1]}, ${result[2]}, ${result[3]})`, alpha: parseFloat(result[4]) } : { color, alpha: 1 }
}
const ProgressRing = memo(({ size, width, progress, color: rawColor, trackColor }: { size: number, width: number, progress: number, color: string, trackColor: string }) => {
  const { color, alpha } = splitAlpha(rawColor)
  const count = Math.round(Math.min(Math.max(progress, 0.02), 1) * RING_SEGMENTS)
  const half = size / 2
  const radius = half - width / 2
  // a bit longer than the space between them so the segments make a continuous line
  const length = 2 * Math.PI * radius / RING_SEGMENTS * 1.3
  const segments = []
  for (let i = 0; i < count; i++) {
    segments.push(
      <View key={i} style={{ position: 'absolute', left: half - length / 2, top: half - width / 2, width: length, height: width, backgroundColor: color, transform: [{ rotate: `${(i + 0.5) * 360 / RING_SEGMENTS}deg` }, { translateY: -radius }] }} />,
    )
  }
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size, height: size }}>
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: half, borderWidth: width, borderColor: trackColor }} />
      <View needsOffscreenAlphaCompositing style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, opacity: alpha }}>
        {segments}
      </View>
    </View>
  )
})

/**
 * Download: a down arrow in a circle, the circle is filled when the list is kept downloaded
 * and becomes a solid circle with a check mark once its songs are downloaded (`done`). While songs download the arrow
 * takes the theme color and a ring around the button fills up (`downloading`, `progress`). When only some of the songs
 * are downloaded and nothing is downloading, the ring stays at the part that is downloaded (`partial`, 0 - 1).
 */
export const DownloadButton = memo(({ onPress, active = false, done = false, downloading = false, progress = 0, partial, disabled = false, size = 30 }: { onPress: () => void, active?: boolean, done?: boolean, downloading?: boolean, progress?: number, partial?: number, disabled?: boolean, size?: number }) => {
  const theme = useTheme()
  const btnSize = scaleSizeW(size)
  const lineWidth = Math.max(1.5, btnSize * 0.06)
  const color = active ? theme['c-content-background'] : downloading ? theme['c-primary-font-active'] : theme['c-font']
  const headSize = btnSize * 0.24
  const isPartial = partial != null && !downloading && !done
  if ((downloading || isPartial) && !done) {
    const arrow = splitAlpha(isPartial ? theme['c-font'] : color)
    return (
      <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
        style={{ ...styles.center, width: btnSize, height: btnSize, opacity: disabled ? 0.5 : 1 }}>
        {
          isPartial
            ? <ProgressRing size={btnSize} width={lineWidth} progress={partial} color={theme['c-font']} trackColor={theme['c-font-label']} />
            : <ProgressRing size={btnSize} width={lineWidth * 1.3} progress={progress} color={theme['c-primary-font-active']} trackColor={theme['c-primary-light-400-alpha-700']} />
        }
        <View needsOffscreenAlphaCompositing style={{ ...styles.center, position: 'absolute', left: 0, top: 0, width: btnSize, height: btnSize, opacity: arrow.alpha }}>
          <View style={{ width: lineWidth, height: btnSize * 0.42, borderRadius: lineWidth, backgroundColor: arrow.color }} />
          {/* no border here: the same place as the arrow head of the button with a border */}
          <View style={{ position: 'absolute', top: btnSize * 0.5 - headSize * 0.42, width: headSize, height: headSize, borderRightWidth: lineWidth, borderBottomWidth: lineWidth, borderColor: arrow.color, transform: [{ rotate: '45deg' }] }} />
        </View>
      </TouchableOpacity>
    )
  }
  if (done) {
    // a solid circle with the check cut out, like a collected list: clearly different from the outlined arrow
    return (
      <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
        style={{ ...styles.center, width: btnSize, height: btnSize, borderRadius: btnSize / 2, backgroundColor: theme['c-font'], opacity: disabled ? 0.5 : 1 }}>
        <View style={{ width: btnSize * 0.26, height: btnSize * 0.48, marginTop: -btnSize * 0.08, borderRightWidth: lineWidth * 1.2, borderBottomWidth: lineWidth * 1.2, borderColor: theme['c-content-background'], transform: [{ rotate: '45deg' }] }} />
      </TouchableOpacity>
    )
  }
  return (
    <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
      style={{ ...styles.center, width: btnSize, height: btnSize, borderRadius: btnSize / 2, borderWidth: lineWidth, borderColor: active ? theme['c-primary-font-active'] : theme['c-font'], backgroundColor: active ? theme['c-primary-font-active'] : 'transparent', opacity: disabled ? 0.5 : 1 }}>
      <View style={{ width: lineWidth, height: btnSize * 0.42, borderRadius: lineWidth, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: btnSize * 0.5 - headSize * 0.42 - lineWidth, width: headSize, height: headSize, borderRightWidth: lineWidth, borderBottomWidth: lineWidth, borderColor: color, transform: [{ rotate: '45deg' }] }} />
    </TouchableOpacity>
  )
})

/**
 * A plain icon button of the same size as the collect button
 */
export const IconButton = memo(({ icon, onPress, disabled = false, size = 30 }: { icon: string, onPress: () => void, disabled?: boolean, size?: number }) => {
  const btnSize = scaleSizeW(size)
  return (
    <TouchableOpacity activeOpacity={0.7} disabled={disabled} onPress={onPress} hitSlop={HIT_SLOP}
      style={{ ...styles.center, width: btnSize, height: btnSize, opacity: disabled ? 0.5 : 1 }}>
      <Icon name={icon} rawSize={btnSize * 0.76} />
    </TouchableOpacity>
  )
})

/**
 * Buttons of a list page, on the right under its description: the secondary ones (download)
 * first, then the main ones (collect, play)
 */
export const ActionRow = ({ left, right }: { left?: React.ReactNode, right?: React.ReactNode }) => {
  return (
    <View style={styles.actionRow}>
      {left}
      {right}
    </View>
  )
}

const styles = createStyle({
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 8,
    paddingRight: 2,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    // the triangle looks off centre otherwise
    marginLeft: 2,
  },
})
