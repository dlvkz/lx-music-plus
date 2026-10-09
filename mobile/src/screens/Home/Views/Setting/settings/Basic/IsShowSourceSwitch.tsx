import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'


import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const showSourceSwitch = useSettingValue('common.isShowSourceSwitch')
  const setShowSourceSwitch = (showSourceSwitch: boolean) => {
    updateSetting({ 'common.isShowSourceSwitch': showSourceSwitch })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={showSourceSwitch} label={t('setting_basic_source_switch')} onChange={setShowSourceSwitch} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
    // marginBottom: 15,
  },
})
