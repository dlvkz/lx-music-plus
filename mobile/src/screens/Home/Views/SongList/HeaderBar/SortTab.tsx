import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import songlistState, { type SortInfo, type Source } from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'

export interface SortTabProps {
  onSortChange: (id: string) => void
}

export interface SortTabType {
  setSource: (source: Source, activeTab: SortInfo['id']) => void
}


export default forwardRef<SortTabType, SortTabProps>(({ onSortChange }, ref) => {
  const [sortList, setSortList] = useState<SortInfo[]>([])
  const [activeId, setActiveId] = useState<SortInfo['id']>('')
  const t = useI18n()
  const theme = useTheme()
  const scrollViewRef = useRef<ScrollView>(null)

  useImperativeHandle(ref, () => ({
    setSource(source, activeTab) {
      scrollViewRef.current?.scrollTo({ x: 0 })
      setSortList(songlistState.sortList[source]!)
      setActiveId(activeTab)
    },
  }))

  const sorts = useMemo(() => {
    return sortList.map(s => ({ label: t(`songlist_${s.tid}`), id: s.id }))
  }, [sortList, t])

  const handleSortChange = (id: string) => {
    onSortChange(id)
    setActiveId(id)
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} keyboardShouldPersistTaps={'always'} horizontal>
      {
        sorts.map(s => (
          <TouchableOpacity style={styles.button} onPress={() => { handleSortChange(s.id) }} key={s.id}>
            <Text style={{ ...styles.buttonText, fontWeight: activeId == s.id ? 'bold' : 'normal', backgroundColor: activeId == s.id ? theme['c-primary-light-400-alpha-700'] : 'transparent' }} color={activeId == s.id ? theme['c-font'] : theme['c-font-label']}>{s.label}</Text>
          </TouchableOpacity>
        ))
      }
    </ScrollView>
  )
})


const styles = createStyle({
  container: {
    flexGrow: 1,
    flexShrink: 1,
    // paddingLeft: 5,
    // paddingRight: 5,
  },
  button: {
    // height: 38,
    // lineHeight: 38,
    justifyContent: 'center',
    paddingRight: 6,
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
