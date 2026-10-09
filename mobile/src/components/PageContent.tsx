// import { useEffect, useState } from 'react'
import { Dimensions, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import ImageBackground from '@/components/common/ImageBackground'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { useEffect, useMemo, useState } from 'react'
import { getNavBarHeight } from '@/utils/navBar'
import { scaleSizeAbsHR } from '@/utils/pixelRatio'
import { defaultHeaders } from './common/Image'
import SizeView from './SizeView'
import { useBgPic } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'

interface Props {
  children: React.ReactNode
  /**
   * the player: its own dynamic background setting (playDetail.isDynamicBg), the menus: theme.dynamicBg
   */
  player?: boolean
  /**
   * color shown behind the system navigation bar, the page background when not set
   */
  navBarColor?: string
}

// Room left for the system navigation bar, which is drawn over the app
const NavBarSpacer = ({ color }: { color?: string }) => {
  const { keyboardShown } = useKeyboard()
  const [height, setHeight] = useState(getNavBarHeight)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setHeight(getNavBarHeight())
    })
    return () => {
      subscription.remove()
    }
  }, [])
  // the keyboard covers the bar
  if (keyboardShown || !height) return null
  return <View style={{ height, backgroundColor: color ?? 'transparent' }} />
}

const BLUR_RADIUS = Math.max(scaleSizeAbsHR(18), 10)

export default ({ children, navBarColor, player = false }: Props) => {
  const theme = useTheme()
  const windowSize = useWindowSize()
  const bgPic = useBgPic()
  const isPlayerDynamicBg = useSettingValue('playDetail.isDynamicBg')
  const isMenuDynamicBg = useSettingValue('theme.dynamicBg')
  const pic = (player ? isPlayerDynamicBg : isMenuDynamicBg) ? bgPic : null
  // const [wh, setWH] = useState<{ width: number | string, height: number | string }>({ width: '100%', height: Dimensions.get('screen').height })

  // 固定宽高度 防止弹窗键盘时大小改变导致背景被缩放
  // useEffect(() => {
  //   const onChange = () => {
  //     setWH({ width: '100%', height: '100%' })
  //   }

  //   const changeEvent = Dimensions.addEventListener('change', onChange)
  //   return () => {
  //     changeEvent.remove()
  //   }
  // }, [])
  // const handleLayout = (e: LayoutChangeEvent) => {
  //   // console.log('handleLayout', e.nativeEvent)
  //   // console.log(Dimensions.get('screen'))
  //   setWH({ width: e.nativeEvent.layout.width, height: Dimensions.get('screen').height })
  // }
  // console.log('render page content')

  const themeComponent = useMemo(() => (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ImageBackground
        style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height + getNavBarHeight(), width: windowSize.width, backgroundColor: theme['c-content-background'] }}
        source={theme['bg-image']}
        resizeMode="cover"
      >
      </ImageBackground>
      <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-main-background'] }}>
        {children}
        <NavBarSpacer color={navBarColor} />
      </View>
    </View>
  ), [children, navBarColor, theme, windowSize.height, windowSize.width])
  const picComponent = useMemo(() => {
    return (
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <ImageBackground
          style={{ position: 'absolute', left: 0, top: 0, height: windowSize.height + getNavBarHeight(), width: windowSize.width, backgroundColor: theme['c-content-background'] }}
          source={{ uri: pic!, headers: defaultHeaders }}
          resizeMode="cover"
          blurRadius={BLUR_RADIUS}
        >
          <View style={{ flex: 1, flexDirection: 'column', backgroundColor: theme['c-content-background'], opacity: 0.76 }}></View>
        </ImageBackground>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          {children}
          <NavBarSpacer color={navBarColor} />
        </View>
      </View>
    )
  }, [children, navBarColor, pic, theme, windowSize.height, windowSize.width])

  return (
    <>
      <SizeView />
      {pic ? picComponent : themeComponent}
    </>
  )
}
