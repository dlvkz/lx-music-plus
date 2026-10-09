import { memo, useEffect, useRef } from 'react'
import { FlatList, type FlatListProps } from 'react-native'

import Basic from '../settings/Basic'
import Addons from '../settings/Addons'
import Player from '../settings/Player'
import LyricDesktop from '../settings/LyricDesktop'
import Search from '../settings/Search'
import List from '../settings/List'
import Sync from '../settings/Sync'
import Lastfm from '../settings/Lastfm'
import Backup from '../settings/Backup'
import Other from '../settings/Other'
import Version from '../settings/Version'
import About from '../settings/About'
import { createStyle } from '@/utils/tools'
import { SETTING_SCREENS, type SettingScreenIds } from '../Main'
import { onSettingSection } from '@/core/sourcePrompt'

type FlatListType = FlatListProps<SettingScreenIds>


const styles = createStyle({
  content: {
    paddingLeft: 15,
    paddingRight: 15,
    paddingTop: 15,
    paddingBottom: 15,
    flex: 0,
  },
})

const ListItem = memo(({
  id,
}: { id: SettingScreenIds }) => {
  switch (id) {
    case 'addons': return <Addons />
    case 'player': return <Player />
    case 'lyric_desktop': return <LyricDesktop />
    case 'search': return <Search />
    case 'list': return <List />
    case 'sync': return <Sync />
    case 'lastfm': return <Lastfm />
    case 'backup': return <Backup />
    case 'other': return <Other />
    case 'version': return <Version />
    case 'about': return <About />
    case 'basic': return <Basic />
  }
}, () => true)

export default () => {
  const renderItem: FlatListType['renderItem'] = ({ item }) => <ListItem id={item} />
  const getkey: FlatListType['keyExtractor'] = item => item
  const listRef = useRef<FlatList<SettingScreenIds>>(null)

  // a section asked (e.g. the sources, from the player)
  useEffect(() => onSettingSection(id => {
    const index = SETTING_SCREENS.indexOf(id)
    if (index < 0) return
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index, animated: true })
    })
  }), [])
  // the sections not drawn yet: near it first, then to it
  const handleScrollToIndexFailed: FlatListType['onScrollToIndexFailed'] = info => {
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false })
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, animated: true })
    }, 100)
  }

  return (
    <FlatList
      ref={listRef}
      onScrollToIndexFailed={handleScrollToIndexFailed}
      data={SETTING_SCREENS}
      keyboardShouldPersistTaps={'always'}
      renderItem={renderItem}
      keyExtractor={getkey}
      contentContainerStyle={styles.content}
      maxToRenderPerBatch={2}
      // updateCellsBatchingPeriod={80}
      windowSize={2}
      // removeClippedSubviews={true}
      initialNumToRender={1}
    />
  )
}
