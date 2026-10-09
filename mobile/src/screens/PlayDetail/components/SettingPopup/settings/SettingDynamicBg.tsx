import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import CheckBox from '@/components/common/CheckBox'
import styles from './style'

// the background of the player and the play bar from the cover of the song (the menus: Settings → Theme)
export default () => {
  const t = useI18n()
  const isDynamicBg = useSettingValue('playDetail.isDynamicBg')
  const setDynamicBg = (isDynamicBg: boolean) => {
    updateSetting({ 'playDetail.isDynamicBg': isDynamicBg })
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <CheckBox marginBottom={3} check={isDynamicBg} label={t('play_detail_setting_dynamic_bg')} onChange={setDynamicBg} />
      </View>
    </View>
  )
}
