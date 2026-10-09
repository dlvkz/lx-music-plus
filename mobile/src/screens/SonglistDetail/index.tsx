import { useEffect, useRef } from 'react'

import MusicList, { type MusicListType } from './MusicList'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { type ListInfoItem } from '@/store/songlist/state'
import PlayerBar from '@/components/player/PlayerBar'
import { ListInfoContext } from './state'
import { useTabPageInfo } from '@/store/tabPages'
import { View } from 'react-native'


export default ({ componentId, info }: { componentId: string, info: ListInfoItem }) => {
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  // shown in a tab (store/tabPages): the home screen has the status bar and the player bar
  const { embedded, isTop } = useTabPageInfo()

  // the playlist data is shared by the playlist pages: shown again (back from a page opened above),
  // the page loads its playlist again
  const wasTopRef = useRef(isTop)
  useEffect(() => {
    if (isTop && !wasTopRef.current) musicListRef.current?.loadList(info.source, info.id)
    wasTopRef.current = isTop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTop])

  useEffect(() => {
    if (!embedded) setComponentId(COMPONENT_IDS.songlistDetail, componentId)

    isUnmountedRef.current = false

    musicListRef.current?.loadList(info.source, info.id)


    return () => {
      isUnmountedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  const content = (
    <ListInfoContext.Provider value={info}>
      <MusicList ref={musicListRef} componentId={componentId} />
    </ListInfoContext.Provider>
  )
  if (embedded) return <View style={{ flex: 1 }}>{content}</View>
  return (
    <PageContent>
      <StatusBar />
      {content}
      <PlayerBar />
    </PageContent>
  )
}

// const styles = createStyle({
//   container: {
//     width: '100%',
//     flex: 1,
//     flexDirection: 'row',
//     borderTopWidth: BorderWidths.normal,
//   },
//   content: {
//     flex: 1,
//   },
// })
