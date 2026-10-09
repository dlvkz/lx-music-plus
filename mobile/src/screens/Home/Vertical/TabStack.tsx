import { useCallback, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Navigation } from 'react-native-navigation'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { useNavActiveId } from '@/store/common/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { type NAV_ID_Type } from '@/config/constant'
import { popLastTabPage, TabPageContext, useTabPages } from '@/store/tabPages'
import Collection from '@/screens/Collection'
import SonglistDetail from '@/screens/SonglistDetail'
import { createStyle } from '@/utils/tools'

// A tab with the pages opened in it (album, artist, chart, playlist): the last one is shown in place of
// the tab, the others stay as they are (hidden) to be shown again with the back button

/**
 * Whether the home screen is the one shown (no player / other screen above it)
 */
const useIsHomeVisibleRef = () => {
  const isHomeVisibleRef = useRef(true)
  const [homeId, setHomeId] = useState(commonState.componentIds.home)
  useEffect(() => {
    const handleIdsUpdated = (ids: CommonState['componentIds']) => {
      setHomeId(ids.home)
    }
    global.state_event.on('componentIdsUpdated', handleIdsUpdated)
    return () => {
      global.state_event.off('componentIdsUpdated', handleIdsUpdated)
    }
  }, [])
  useEffect(() => {
    if (!homeId) return
    const subscription = Navigation.events().registerComponentListener({
      componentDidAppear() {
        isHomeVisibleRef.current = true
      },
      componentDidDisappear() {
        isHomeVisibleRef.current = false
      },
    }, homeId)
    return () => {
      subscription.remove()
    }
  }, [homeId])
  return isHomeVisibleRef
}

export default ({ navId, children }: { navId: NAV_ID_Type, children: React.ReactNode }) => {
  const pages = useTabPages(navId)
  const navActiveId = useNavActiveId()
  const isHomeVisibleRef = useIsHomeVisibleRef()

  useBackHandler(useCallback(() => {
    if (navActiveId != navId || !pages.length || !isHomeVisibleRef.current) return false
    return popLastTabPage(navId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navActiveId, navId, pages]))

  return (
    <View style={styles.container}>
      <View style={{ ...styles.container, display: pages.length ? 'none' : 'flex' }}>{children}</View>
      {
        pages.map((page, index) => {
          const isTop = index == pages.length - 1
          return (
            <View key={page.id} style={{ ...styles.container, display: isTop ? 'flex' : 'none' }}>
              <TabPageContext.Provider value={{ embedded: true, isTop }}>
                {
                  page.type == 'collection'
                    ? <Collection componentId={page.id} info={page.info} />
                    : <SonglistDetail componentId={page.id} info={page.info} />
                }
              </TabPageContext.Provider>
            </View>
          )
        })
      }
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
})
