import { memo, useRef } from 'react'

import { View, StyleSheet, TouchableOpacity } from 'react-native'

import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { Icon } from '@/components/common/Icon'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import SettingPopup, { type SettingPopupType } from '../../components/SettingPopup'
import QueuePopup, { type QueuePopupType } from '../../components/QueuePopup'
import { useStatusbarHeight } from '@/store/common/hook'
import Btn from './Btn'
import TimeoutExitBtn from './TimeoutExitBtn'
import DesktopLyricBtn from '../Player/components/MoreBtn/DesktopLyricBtn'
import CommentBtn from '../Player/components/MoreBtn/CommentBtn'
import Text from '@/components/common/Text'
import { usePlayingFrom } from '@/core/playingFrom'
import { openPlayingFrom } from '@/core/musicLinks'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'

export const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

// what the songs playing come from: "Playing from album · Name" (core/playingFrom.ts)
const PlayingFromLabel = memo(({ onClosePlayer }: { onClosePlayer: () => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const from = usePlayingFrom()
  if (!from) return <View style={styles.space} />
  const type = t(`player__from_${from.type}`)
  const target = from.target
  return (
    // (tapped: the page it comes from opens, the radio has none)
    <TouchableOpacity style={styles.space} disabled={!target} onPress={() => { if (target) openPlayingFrom(target, onClosePlayer) }}>
      <Text size={10} color={theme['c-font-label']} numberOfLines={1} style={styles.fromLabel}>{from.name ? `${t('player__playing_from')} · ${type}` : t('player__playing_from')}</Text>
      <Text size={13} numberOfLines={1} style={styles.fromName}>{from.name || type}</Text>
    </TouchableOpacity>
  )
})


export default memo(({ componentId }: { componentId: string }) => {
  const popupRef = useRef<SettingPopupType>(null)
  const statusBarHeight = useStatusbarHeight()

  // the screen of this player: the shared id is gone when another player was opened and closed above it
  const back = () => {
    void pop(componentId)
  }
  const showSetting = () => {
    popupRef.current?.show()
  }
  // the queue: what plays next, what it plays from
  const queueRef = useRef<QueuePopupType>(null)
  const showQueue = () => {
    queueRef.current?.show()
  }

  return (
    <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_header}>
      <StatusBar />
      <View style={styles.container}>
        <TouchableOpacity onPress={back} style={{ ...styles.backBtn, width: HEADER_HEIGHT }}>
          <Icon name="chevron-left" size={18} style={styles.downIcon} />
        </TouchableOpacity>
        <PlayingFromLabel onClosePlayer={back} />
        <DesktopLyricBtn />
        <CommentBtn />
        <TimeoutExitBtn />
        <Btn icon="menu" onPress={showQueue} />
        <Btn icon="slider" onPress={showSetting} />
      </View>
      <SettingPopup ref={popupRef} direction="vertical" />
      <QueuePopup ref={queueRef} onClosePlayer={back} />
    </View>
  )
})


const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // justifyContent: 'center',
    height: '100%',
    alignItems: 'center',
  },
  backBtn: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // the page closes downwards
  downIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  space: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  fromLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fromName: {
    fontWeight: 'bold',
  },
  icon: {
    paddingLeft: 4,
    paddingRight: 4,
  },
})
