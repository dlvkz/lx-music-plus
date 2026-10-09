import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import HistorySearch, { type HistorySearchType } from './HistorySearch'
import HotSearch, { type HotSearchType } from './HotSearch'

interface BlankViewProps {
  onSearch: (keyword: string) => void
}
type Source = LX.OnlineSource | 'all'

export interface BlankViewType {
  show: (source: Source) => void
}

export default forwardRef<BlankViewType, BlankViewProps>(({ onSearch }, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  const [visible, setVisible] = useState(false)
  const hotSearchRef = useRef<HotSearchType>(null)
  const historySearchRef = useRef<HistorySearchType>(null)
  const isShowHistorySearch = useSettingValue('search.isShowHistorySearch')

  const handleShow = (source: Source) => {
    hotSearchRef.current?.show(source)
    historySearchRef.current?.show()
  }

  useImperativeHandle(ref, () => ({
    show(source) {
      if (visible) handleShow(source)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          handleShow(source)
        })
      }
    },
  }), [visible])

  return (
    visible
      ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <HotSearch ref={hotSearchRef} onSearch={onSearch} />
              { isShowHistorySearch ? <HistorySearch ref={historySearchRef} onSearch={onSearch} /> : null }
            </View>
          </ScrollView>
        )
      : null

  )
})


const styles = createStyle({
  content: {
    // paddingTop: 15,
    paddingBottom: 15,
    paddingLeft: 18,
    paddingRight: 18,
  },
})
