import { memo, useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { View, AppState, type GestureResponderEvent } from 'react-native'
import { pop } from '@/navigation'

import Header from './components/Header'
// import Aside from './components/Aside'
// import Main from './components/Main'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
// import { useTheme } from '@/store/theme/hook'

const LyricPage = ({ activeIndex }: { activeIndex: number }) => {
  const initedRef = useRef(false)
  const lyric = useMemo(() => <Lyric />, [])
  switch (activeIndex) {
    // case 3:
    case 1:
      if (!initedRef.current) initedRef.current = true
      return lyric
    default:
      return initedRef.current ? lyric : null
  }
  // return activeIndex == 0 || activeIndex == 1 ? setting : null
}

const SWIPE_DOWN_DISTANCE = 26

// global.iskeep = false
export default memo(({ componentId }: { componentId: string }) => {
  // const theme = useTheme()
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)
  const pagerRef = useRef<PagerView>(null)
  // A swipe down on the cover page closes the player. The raw touch events are used: they reach
  // the page whatever takes the gesture. Only the start of the swipe is seen (the touch is
  // cancelled by the system after about 30dp), so a short, clearly vertical move is enough.
  const swipeRef = useRef({ x: 0, y: 0, isClosed: false })
  const swipeDownHandlers = useMemo(() => ({
    onTouchStart({ nativeEvent }: GestureResponderEvent) {
      swipeRef.current = { x: nativeEvent.pageX, y: nativeEvent.pageY, isClosed: false }
    },
    onTouchMove({ nativeEvent }: GestureResponderEvent) {
      const swipe = swipeRef.current
      if (swipe.isClosed) return
      const dy = nativeEvent.pageY - swipe.y
      if (dy < SWIPE_DOWN_DISTANCE || dy < Math.abs(nativeEvent.pageX - swipe.x) * 2) return
      swipe.isClosed = true
      void pop(componentId)
    },
  }), [componentId])
  const showLyric = useCallback(() => {
    pagerRef.current?.setPage(1)
  }, [])

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Header componentId={componentId} />
      <View style={styles.container}>
        <PagerView
          ref={pagerRef}
          onPageSelected={onPageSelected}
          // onPageScrollStateChanged={onPageScrollStateChanged}
          style={styles.pagerView}
        >
          <View collapsable={false}>
            <View style={styles.pagerView} {...swipeDownHandlers}>
              <Pic componentId={componentId} onShowLyric={showLyric} />
            </View>
          </View>
          <View collapsable={false}>
            <LyricPage activeIndex={pageIndex} />
          </View>
        </PagerView>
        {/* <View style={styles.pageIndicator} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pageIndicator}>
          <View style={{ ...styles.pageIndicatorItem, backgroundColor: pageIndex == 0 ? theme['c-primary-light-100-alpha-700'] : theme['c-primary-alpha-900'] }}></View>
          <View style={{ ...styles.pageIndicatorItem, backgroundColor: pageIndex == 1 ? theme['c-primary-light-100-alpha-700'] : theme['c-primary-alpha-900'] }}></View>
        </View> */}
        <Player />
      </View>
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
  },
  pagerView: {
    flex: 1,
  },
  // pageIndicator: {
  //   flex: 0,
  //   flexDirection: 'row',
  //   justifyContent: 'center',
  //   paddingTop: 10,
  //   // backgroundColor: 'rgba(0,0,0,0.1)',
  // },
  // pageIndicatorItem: {
  //   height: 3,
  //   width: '5%',
  //   marginLeft: 2,
  //   marginRight: 2,
  //   borderRadius: 2,
  // },
})
