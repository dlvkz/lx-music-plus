import { memo } from 'react'
import Svg, { Path } from 'react-native-svg'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeW } from '@/utils/pixelRatio'

// The heart of the loved songs: a grey outline, filled with the color of the theme when the song is loved
const HEART = 'M12 20.6s-7.8-4.7-9.6-9.4C1.2 8 3.1 4.4 6.6 4.4c2.1 0 3.6 1.1 5.4 3.2 1.8-2.1 3.3-3.2 5.4-3.2 3.5 0 5.4 3.6 4.2 6.8-1.8 4.7-9.6 9.4-9.6 9.4z'

export default memo(({ loved, size = 24 }: { loved: boolean, size?: number }) => {
  const theme = useTheme()
  const px = scaleSizeW(size)
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24">
      <Path
        d={HEART}
        fill={loved ? theme['c-primary'] : 'none'}
        stroke={loved ? theme['c-primary'] : theme['c-font-label']}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  )
})
