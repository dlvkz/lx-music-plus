import { useEffect, useMemo, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'

import { createStyle } from '@/utils/tools'
import { type SearchType } from '@/store/search/state'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { getSearchSetting } from '@/utils/data'
import { clearTabPages } from '@/store/tabPages'

const SEARCH_TYPE_LIST = [
  'music',
  'songlist',
  'artist',
  'album',
] as const

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [type, setType] = useState<SearchType>('music')

  useEffect(() => {
    void getSearchSetting().then(info => {
      setType(info.type)
    })
  }, [])

  const list = useMemo(() => {
    return SEARCH_TYPE_LIST.map(type => ({ label: t(`search_type_${type}`), id: type }))
  }, [t])

  const handleTypeChange = (type: SearchType) => {
    // a playlist / album / artist opened from the search is closed: back to the results of the tab chosen
    clearTabPages('nav_search')
    setType(type)
    global.app_event.searchTypeChanged(type)
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps={'always'} horizontal={true}>
      {
        list.map(t => (
          <TouchableOpacity style={styles.button} onPress={() => { handleTypeChange(t.id) }} key={t.id}>
            <Text style={{ ...styles.buttonText, fontWeight: type == t.id ? 'bold' : 'normal', backgroundColor: type == t.id ? theme['c-primary-light-400-alpha-700'] : 'transparent' }} color={type == t.id ? theme['c-font'] : theme['c-font-label']}>{t.label}</Text>
          </TouchableOpacity>
        ))
      }
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    height: '100%',
    flexGrow: 0,
    flexShrink: 1,
    // paddingLeft: 5,
    // paddingRight: 5,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  button: {
    // height: 38,
    // lineHeight: 38,
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 4,
    // width: 80,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  buttonText: {
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
    overflow: 'hidden',
  },
})
