import { loadCache, setCache } from '@/utils/dataCache'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import StickyBanner, { STICKY_OFFSET } from '@/components/common/StickyBanner'
import { useTabPageInfo } from '@/store/tabPages'
import { pop } from '@/navigation'
import { createStyle } from '@/utils/tools'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { clearListDetail, getListDetail, setListDetail, setListDetailInfo } from '@/core/songlist'
import songlistState from '@/store/songlist/state'
import { handlePlay } from './listAction'
import Header, { type HeaderType } from './Header'
import { useListInfo } from './state'

export interface MusicListProps {
  componentId: string
}

export interface MusicListType {
  loadList: (source: LX.OnlineSource, listId: string) => void
}

export default forwardRef<MusicListType, MusicListProps>(({ componentId }, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const headerRef = useRef<HeaderType>(null)
  const isUnmountedRef = useRef(false)
  const info = useListInfo()

  useImperativeHandle(ref, () => ({
    async loadList(source, id) {
      clearListDetail()
      const listDetailInfo = songlistState.listDetailInfo
      listRef.current?.setList([])
      if (listDetailInfo.id == id && listDetailInfo.source == source && listDetailInfo.list.length) {
        requestAnimationFrame(() => {
          listRef.current?.setList(listDetailInfo.list)
          headerRef.current?.setInfo({
            name: (info.name || listDetailInfo.info.name) ?? '',
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            desc: listDetailInfo.info.desc || info.desc || '',
            playCount: (info.play_count ?? listDetailInfo.info.play_count) ?? '',
            imgUrl: info.img ?? listDetailInfo.info.img,
          })
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        setListDetailInfo(info.source, info.id)
        headerRef.current?.setInfo({
          name: (info.name || listDetailInfo.info.name) ?? '',
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          desc: listDetailInfo.info.desc || info.desc || '',
          playCount: (info.play_count ?? listDetailInfo.info.play_count) ?? '',
          imgUrl: info.img ?? listDetailInfo.info.img,
        })
        // the songs the playlist had last time are shown until the new ones are loaded
        const cacheKey = `detail:songlist:${source}:${id}`
        let isLoaded = false
        void loadCache<Awaited<ReturnType<typeof getListDetail>>>(cacheKey).then(cached => {
          if (isLoaded || isUnmountedRef.current || !cached?.list.length) return
          listRef.current?.setList(cached.list)
          headerRef.current?.setInfo({
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            name: info.name || cached.info.name || '',
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            desc: cached.info.desc || info.desc || '',
            playCount: (info.play_count ?? cached.info.play_count) ?? '',
            imgUrl: info.img ?? cached.info.img,
          })
        })
        return getListDetail(id, source, page).then((listDetail) => {
          isLoaded = true
          if (listDetail.list.length) setCache(cacheKey, listDetail)
          const result = setListDetail(listDetail, id, page)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            headerRef.current?.setInfo({
              name: (info.name || listDetailInfo.info.name) ?? '',
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              desc: listDetailInfo.info.desc || info.desc || '',
              playCount: (info.play_count ?? listDetailInfo.info.play_count) ?? '',
              imgUrl: info.img ?? listDetailInfo.info.img,
            })
            listRef.current?.setList(result.list)
            listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          isLoaded = true
          if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
          listRef.current?.setStatus('error')
        })
      }
    },
  }))

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handlePlayList: OnlineListProps['onPlayList'] = (index) => {
    const listDetailInfo = songlistState.listDetailInfo
    // console.log(songlistState.listDetailInfo)
    void handlePlay(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index)
  }
  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const page = 1
    listRef.current?.setStatus('refreshing')
    getListDetail(songlistState.listDetailInfo.id, songlistState.listDetailInfo.source, page, true).then((listDetail) => {
      const result = setListDetail(listDetail, songlistState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    listRef.current?.setStatus('loading')
    const page = songlistState.listDetailInfo.list.length ? songlistState.listDetailInfo.page + 1 : 1
    getListDetail(songlistState.listDetailInfo.id, songlistState.listDetailInfo.source, page).then((listDetail) => {
      const result = setListDetail(listDetail, songlistState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list, true)
      listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const header = useMemo(() => <Header ref={headerRef} componentId={componentId} />, [])

  const [isSticky, setSticky] = useState(false)
  const handleScroll = useCallback<NonNullable<OnlineListProps['onScroll']>>(({ nativeEvent }) => {
    setSticky(nativeEvent.contentOffset.y > STICKY_OFFSET)
  }, [])
  const back = useCallback(() => {
    void pop(componentId)
  }, [componentId])
  const { embedded } = useTabPageInfo()
  const playAll = useCallback(() => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }, [info])

  return (
    <View style={styles.container}>
      <OnlineList
        ref={listRef}
        onPlayList={handlePlayList}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        ListHeaderComponent={header}
        onScroll={handleScroll}
        // progressViewOffset={}
      />
      <StickyBanner visible={isSticky} withStatusBar={!embedded} title={songlistState.listDetailInfo.info.name ? songlistState.listDetailInfo.info.name : info.name} onBack={back} onPlay={playAll} />
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
})
