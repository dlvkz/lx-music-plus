import { memo } from 'react'
import { View } from 'react-native'
import { Icon } from './Icon'
import { scaleSizeW } from '@/utils/pixelRatio'

/**
 * Next / previous song icon: one triangle against a bar
 */
export default memo(({ direction, color, size, rawSize }: {
  direction: 'next' | 'prev'
  color: string
  /** size of the icon, scaled like the font icons */
  size?: number
  rawSize?: number
}) => {
  const iconSize = rawSize ?? scaleSizeW(size ?? 20)
  const triangleSize = iconSize * 0.8
  const barWidth = Math.max(2, iconSize * 0.13)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: iconSize, transform: [{ scaleX: direction == 'next' ? 1 : -1 }] }}>
      <Icon name="play" color={color} rawSize={triangleSize} />
      <View style={{ width: barWidth, height: triangleSize * 0.92, borderRadius: barWidth / 2, marginLeft: iconSize * 0.04, backgroundColor: color }} />
    </View>
  )
})
