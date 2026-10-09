import { getBuiltInListName } from '@/utils/listName'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { BorderWidths } from '@/theme'
import { useTheme } from '@/store/theme/hook'
import { useActiveListId, useListFetching } from '@/store/list/hook'
import listState from '@/store/list/state'
import { createStyle } from '@/utils/tools'
import { getListPrevSelectId } from '@/utils/data'
import { setActiveList } from '@/core/list'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import Loading from '@/components/common/Loading'
import { useSettingValue } from '@/store/setting/hook'
import { useHorizontalMode } from '@/utils/hooks'

export interface ActiveListProps {
  onShowSearchBar: () => void
  onScrollToTop: () => void
}
export interface ActiveListType {
  setVisibleBar: (visible: boolean) => void
}

export default forwardRef<ActiveListType, ActiveListProps>(({ onShowSearchBar, onScrollToTop }, ref) => {
  const theme = useTheme()
  const currentListId = useActiveListId()
  const fetching = useListFetching(currentListId)
  const langId = useSettingValue('common.langId')
  const currentListName = useMemo(() => {
    switch (currentListId) {
      case LIST_IDS.TEMP:
        return global.i18n.t('list_name_temp')
      case LIST_IDS.DEFAULT:
        return getBuiltInListName(LIST_IDS.DEFAULT)
      case LIST_IDS.LOVE:
        return getBuiltInListName(LIST_IDS.LOVE)
      default:
        return listState.allList.find(l => l.id === currentListId)?.name ?? ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentListId, langId])
  const [visibleBar, setVisibleBar] = useState(true)
  // in the phone layout the lists are picked from the library grid
  const isLibraryGrid = !useHorizontalMode()

  useImperativeHandle(ref, () => ({
    setVisibleBar(visible) {
      setVisibleBar(visible)
    },
  }))

  const showList = () => {
    global.app_event.changeLoveListVisible(true)
  }

  useEffect(() => {
    void getListPrevSelectId().then((id) => {
      setActiveList(id)
    })
  }, [])

  return (
    <TouchableOpacity activeOpacity={1} onPress={isLibraryGrid ? onScrollToTop : showList} onLongPress={onScrollToTop} style={{ ...styles.currentList, opacity: visibleBar ? 1 : 0, borderBottomWidth: isLibraryGrid ? 0 : BorderWidths.normal, borderBottomColor: theme['c-border-background'] }}>
      { isLibraryGrid ? null : <Icon style={styles.currentListIcon} color={theme['c-button-font']} name="chevron-right" size={12} /> }
      { fetching ? <Loading color={theme['c-button-font']} style={styles.loading} /> : null }
      <Text style={isLibraryGrid ? styles.songsTitle : styles.currentListText} numberOfLines={1} color={theme['c-button-font']}>{isLibraryGrid ? global.i18n.t('collection__songs_title') : currentListName}</Text>
      <TouchableOpacity style={styles.currentListBtns} onPress={onShowSearchBar}>
        <Icon color={theme['c-button-font']} name="search-2" />
      </TouchableOpacity>
    </TouchableOpacity>
  )
})


const styles = createStyle({
  currentList: {
    flexDirection: 'row',
    paddingRight: 2,
    height: 36,
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  currentListIcon: {
    paddingLeft: 15,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 0,
  },
  songsTitle: {
    flex: 1,
    paddingLeft: 16,
    fontWeight: 'bold',
  },
  currentListText: {
    flex: 1,
    // minWidth: 70,
    // paddingLeft: 10,
    paddingRight: 10,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
  loading: {
    marginRight: 5,
  },
  currentListBtns: {
    width: 46,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
})
