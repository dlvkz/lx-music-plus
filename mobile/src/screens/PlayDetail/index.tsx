import { useEffect } from 'react'
// import { View, StyleSheet } from 'react-native'
import { useHorizontalMode } from '@/utils/hooks'

import Vertical from './Vertical'
import Horizontal from './Horizontal'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { ThemeContext } from '@/store/theme/state'
import { useCoverTheme } from '@/core/coverTone'
import { useBgPic } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'

export default ({ componentId }: { componentId: string }) => {
  const isHorizontalMode = useHorizontalMode()
  // the dynamic background: the text and the buttons keep their contrast over the cover (core/coverTone.ts)
  const isDynamicBg = useSettingValue('playDetail.isDynamicBg')
  const bgPic = useBgPic()
  const coverTheme = useCoverTheme(isDynamicBg ? bgPic : null)

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ThemeContext.Provider value={coverTheme}>
      <PageContent player>
        <StatusBar />
        {
          isHorizontalMode
            ? <Horizontal componentId={componentId} />
            : <Vertical componentId={componentId} />
        }
      </PageContent>
    </ThemeContext.Provider>
  )
}
