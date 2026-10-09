import { getCachedTranslation } from '@/utils/translate'
import { showThemedDialog, createStyle } from '@/utils/tools'
import { localizeCount } from '@/utils'
import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { BorderWidths } from '@/theme'
import ButtonBar from './ActionBar'
import { pop, useNavigationComponentDidAppear } from '@/navigation'
import { BackButton } from '@/components/common/ActionIcons'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import Text, { AnimatedText } from '@/components/common/Text'
import Image from '@/components/common/Image'
import { TranslatedText } from '@/components/common/TranslatedText'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTabPageInfo } from '@/store/tabPages'

const IMAGE_WIDTH = scaleSizeW(110)

const CountText = memo(({ count }: { count: string }) => {
  const [animFade] = useAnimateOnecNumber(0, 1, 250, false)
  const [animTranslateY] = useAnimateOnecNumber(10, 0, 250, false)
  return (
    <AnimatedText style={{
      ...styles.playCount,
      opacity: animFade,
      transform: [
        { translateY: animTranslateY },
      ],
    }} numberOfLines={ 1 }>{count}</AnimatedText>
  )
}, (prevProps, nextProps) => {
  return true
})

const Pic = ({ componentId, playCount, imgUrl }: {
  componentId: string
  playCount: string
  imgUrl?: string
}) => {
  const [pic, setPic] = useState(imgUrl)
  // a page in a tab has no opening animation (the picture is shown at once)
  const { embedded } = useTabPageInfo()
  const [animated, setAnimated] = useState(embedded)
  const info = useListInfo()
  useEffect(() => {
    if (animated) setPic(imgUrl)
  }, [imgUrl, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  return (
    <View style={{ ...styles.listItemImg, width: IMAGE_WIDTH, height: IMAGE_WIDTH }}>
      <Image nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`} url={pic} style={{ flex: 1, borderRadius: 12 }} />
      {
        playCount && animated ? <CountText count={localizeCount(playCount)} /> : null
      }
    </View>
  )
}

export interface HeaderProps {
  componentId: string
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  playCount: string
  imgUrl?: string
}

export default forwardRef<HeaderType, HeaderProps>(({ componentId }: { componentId: string }, ref) => {
  const { embedded } = useTabPageInfo()
  const realStatusBarHeight = useStatusbarHeight()
  const statusBarHeight = embedded ? 0 : realStatusBarHeight
  const theme = useTheme()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })
  const back = () => {
    void pop(componentId)
  }
  // the description is capped, a tap shows the whole text
  const showDesc = () => {
    if (!detailInfo.desc) return
    void showThemedDialog({ message: getCachedTranslation(detailInfo.desc) ?? detailInfo.desc, buttons: [{ text: global.i18n.t('close'), value: true }] })
  }

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    <View style={{ ...styles.container, paddingTop: statusBarHeight, borderBottomColor: theme['c-border-background'] }}>
      <View style={styles.top}>
        <BackButton onPress={back} />
      </View>
      <View style={{ flexDirection: 'row', flexGrow: 0, flexShrink: 0, paddingHorizontal: 14, paddingBottom: 10 }}>
        <Pic componentId={componentId} playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} />
        <View style={{ flexDirection: 'column', flexGrow: 1, flexShrink: 1, paddingLeft: 14 }} nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}>
          <Text size={17} numberOfLines={ 2 } style={styles.name}><TranslatedText text={detailInfo.name} translationFirst /></Text>
          <View style={{ flexGrow: 0, flexShrink: 1 }}>
            <Text size={13} color={theme['c-font-label']} numberOfLines={ 2 } onPress={showDesc}><TranslatedText text={detailInfo.desc} replace /></Text>
          </View>
          <ButtonBar />
        </View>
      </View>
      {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexGrow: 0, flexShrink: 1, paddingTop: 5, paddingRight: 5 }}>
              <Text style={{ fontSize: 12, color: AppColors.normal20 }} numberOfLines={ 1 }>{localizeCount(playCount) || '-'}</Text>
              <Text style={{ fontSize: 12, color: AppColors.normal30 }} numberOfLines={ 1 }>{this.props.selectListInfo.author || this.props.listDetailData.info.author}</Text>
            </View>
      </View> */}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    borderBottomWidth: BorderWidths.normal,
  },
  top: {
    paddingLeft: 4,
    paddingTop: 4,
  },
  name: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    // width: 70,
    // height: 70,
    // ...Platform.select({
    //   ios: {
    //     shadowColor: '#000',
    //     shadowOffset: {
    //       width: 0,
    //       height: 1,
    //     },
    //     shadowOpacity: 0.20,
    //     shadowRadius: 1.41,
    //   },
    //   android: {
    //     elevation: 2,
    //   },
    // }),
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 12,
    paddingLeft: 3,
    paddingRight: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
})
