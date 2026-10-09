import { memo } from 'react'

import Theme from '../Theme'
import Section from '../../components/Section'
import Language from './Language'
import FontSize from './FontSize'
import FontFamily from './FontFamily'
import ShareType from './ShareType'
import IsStartupAutoPlay from './IsStartupAutoPlay'
import IsStartupPushPlayDetailScreen from './IsStartupPushPlayDetailScreen'
import IsAutoHidePlayBar from './IsAutoHidePlayBar'
import IsAllowProgressBarSeek from './IsAllowProgressBarSeek'
import IsUseSystemFileSelector from './IsUseSystemFileSelector'
import IsAlwaysKeepStatusbarHeight from './IsAlwaysKeepStatusbarHeight'
import IsShowBackBtn from './IsShowBackBtn'
import IsShowExitBtn from './IsShowExitBtn'
import DrawerLayoutPosition from './DrawerLayoutPosition'
import { useI18n } from '@/lang/i18n'

export default memo(() => {
  const t = useI18n()


  return (
    <Section title={t('setting_basic')}>
      <IsStartupAutoPlay />
      <IsStartupPushPlayDetailScreen />
      <IsShowBackBtn />
      <IsShowExitBtn />
      <IsAutoHidePlayBar />
      <IsAllowProgressBarSeek />
      <IsUseSystemFileSelector />
      <IsAlwaysKeepStatusbarHeight />
      <Theme />
      <DrawerLayoutPosition />
      <Language />
      <FontSize />
      <FontFamily />
      <ShareType />
    </Section>
  )
})
