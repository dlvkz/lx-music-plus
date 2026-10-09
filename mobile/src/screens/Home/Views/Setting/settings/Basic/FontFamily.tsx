import { memo, useMemo } from 'react'

import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { FONT_FAMILIES } from '@/utils/fontFamily'

const setFontFamily = (family: string) => {
  updateSetting({ 'common.fontFamily': family })
}

const Item = ({ family, name }: {
  family: string
  name: string
}) => {
  const fontFamily = useSettingValue('common.fontFamily')
  return <CheckBox marginBottom={3} check={fontFamily == family} label={name} onChange={() => { setFontFamily(family) }} need />
}

export default memo(() => {
  const t = useI18n()
  const list = useMemo(() => {
    return FONT_FAMILIES.map(({ id, family }) => ({ family, name: t(`setting_basic_font_family_${id}`) }))
  }, [t])

  return (
    <SubTitle title={t('setting_basic_font_family')}>
      <View style={styles.list}>
        {
          list.map(({ family, name }) => <Item name={name} family={family} key={family} />)
        }
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
