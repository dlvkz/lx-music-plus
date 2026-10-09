import { getCache, setCache } from '@/utils/dataCache'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { type Source, type InitState } from '@/store/hotSearch/state'
import Button from '@/components/common/Button'
import { getList } from '@/core/hotSearch'
import Text from '@/components/common/Text'
import { TranslatedText } from '@/components/common/TranslatedText'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'


const CACHE_KEY = 'hotSearch'

interface ListProps {
  onSearch: (keyword: string) => void
}
export interface HotSearchType {
  show: (source: Source) => void
}


export type List = NonNullable<InitState['sourceList'][keyof InitState['sourceList']]>

const ListItem = ({ keyword, onSearch }: {
  keyword: string
  onSearch: (keyword: string) => void
}) => {
  const theme = useTheme()
  return (
    <Button style={{ ...styles.button, backgroundColor: theme['c-button-background'] }} onPress={() => { onSearch(keyword) }}>
      <Text color={theme['c-button-font']} size={13}><TranslatedText text={keyword} replace /></Text>
    </Button>
  )
}

export default forwardRef<HotSearchType, ListProps>((props, ref) => {
  // const [listType, setListType] = useState<SearchState['searchType']>('music')
  // const listRef = useRef<MusicListType>(null)
  // the terms shown last time are shown until the new ones are loaded
  const [list, setList] = useState<List>(() => getCache<List>(CACHE_KEY) ?? [])
  const t = useI18n()
  // const theme = useTheme()

  const isUnmountedRef = useRef(false)
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])

  useImperativeHandle(ref, () => ({
    show(source) {
      void getList(source).then((list) => {
        if (!list.length) return
        setCache(CACHE_KEY, list)
        if (isUnmountedRef.current) return
        setList(list)
      }).catch(err => { console.log(err) })
    },
  }), [])

  return (
    list.length
      ? (
          <ScrollView>
            <Text style={styles.title} size={20}>{t('search_hot_search')}</Text>
            <View style={styles.list}>
              {
                list.map(keyword => <ListItem keyword={keyword} key={keyword} onSearch={props.onSearch} />)
              }
            </View>
          </ScrollView>
        )
      : null
  )
})


const styles = createStyle({
  title: {
    // paddingLeft: 15,
    paddingTop: 10,
    paddingBottom: 4,
    fontWeight: 'bold',
  },
  list: {
    // paddingLeft: 15,
    // paddingRight: 15,
    flexDirection: 'row',
    flexWrap: 'wrap',
    // paddingBottom: 15,
  },
  button: {
    textAlign: 'center',
    paddingLeft: 13,
    paddingRight: 13,
    paddingTop: 7,
    paddingBottom: 7,
    borderRadius: 17,
    marginRight: 8,
    marginTop: 8,
  },
})
