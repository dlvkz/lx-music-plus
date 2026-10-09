import { useEffect, useMemo, useState } from 'react'
import Home from '../Views/Home'
import Search from '../Views/Search'
import SongList from '../Views/SongList'
import Mylist from '../Views/Library'
import Leaderboard from '../Views/Leaderboard'
import Setting from '../Views/Setting'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import TabStack from '../Vertical/TabStack'


const Main = () => {
  const [id, setId] = useState(commonState.navActiveId)

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      requestAnimationFrame(() => {
        setId(id)
      })
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_songlist': return <SongList />
      case 'nav_top': return <Leaderboard />
      case 'nav_love': return <Mylist />
      case 'nav_setting': return <Setting />
      case 'nav_search': return <Search />
      case 'nav_home':
      default: return <Home />
    }
  }, [id])

  // the pages opened in the tab (album, playlist...) are shown in it
  return <TabStack key={id} navId={id}>{component}</TabStack>
}


export default Main

