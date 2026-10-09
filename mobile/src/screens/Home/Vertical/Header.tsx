import { View } from 'react-native'
import { useNavActiveId, useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import { scaleSizeH } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'
import { type InitState as CommonState } from '@/store/common/state'
import { useLibraryListOpened } from '@/store/libraryView'
import SearchTypeSelector from '@/screens/Home/Views/Search/SearchTypeSelector'

const headerComponents: Partial<Record<CommonState['navActiveId'], React.ReactNode>> = {
  nav_search: <SearchTypeSelector />,
}

// Page title bar. The pages are switched with the bottom tabs, so there is no menu button,
// and the home page has its own greeting instead of a title.
const Header = () => {
  const id = useNavActiveId()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const isLibraryListOpened = useLibraryListOpened()

  return (
    <>
      <StatusBar />
      {
        id == 'nav_home' || (id == 'nav_love' && isLibraryListOpened)
          ? <View style={{ height: statusBarHeight }} />
          : (
              <View style={{
                ...styles.container,
                height: scaleSizeH(HEADER_HEIGHT) + statusBarHeight,
                paddingTop: statusBarHeight,
              }}>
                {
                  // the search page: the tabs of the kinds of results take the room of the title
                  id == 'nav_search'
                    ? <View style={styles.searchTabs}>{headerComponents[id]}</View>
                    : <>
                        <View style={styles.left}>
                          <Text style={styles.title} size={26}>{t(id)}</Text>
                        </View>
                        {headerComponents[id] ?? null}
                      </>
                }
              </View>
            )
      }
    </>
  )
}


const styles = createStyle({
  container: {
    paddingRight: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  searchTabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 10,
  },
  title: {
    paddingLeft: 18,
    paddingRight: 16,
    fontWeight: 'bold',
  },
})

export default Header
