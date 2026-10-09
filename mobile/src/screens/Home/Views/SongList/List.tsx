import { getCache, setCache } from '@/utils/dataCache'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import Songlist, { type SonglistProps, type SonglistType } from './components/Songlist'
import { clearList, getList, setList, setListInfo } from '@/core/songlist'
import songlistState from '@/store/songlist/state'
import { type Source } from '@/store/songlist/state'


const getCacheKey = (source: Source, sortId: string, tagId: string) => `slist:${source}:${sortId}:${tagId}`

export interface ListType {
  loadList: (source: Source, sortId: string, tagId: string) => void
}

export default forwardRef<ListType, {}>((props, ref) => {
  const listRef = useRef<SonglistType>(null)
  const isUnmountedRef = useRef(false)
  const loadIdRef = useRef('')
  useImperativeHandle(ref, () => ({
    async loadList(source, sortId, tagId) {
      const listInfo = songlistState.listInfo
      if (listInfo.tagId == tagId && listInfo.sortId == sortId && listInfo.source == source && listInfo.list.length) {
        requestAnimationFrame(() => {
          listRef.current?.setList(listInfo.list)
        })
      } else {
        // What is shown stays until the new playlists are loaded. The playlists this category showed
        // last time (kept between the runs of the app) are shown in the meantime.
        const cacheKey = getCacheKey(source, sortId, tagId)
        loadIdRef.current = cacheKey
        const cached = getCache<Parameters<typeof setList>[0]>(cacheKey)
        setListInfo(source, tagId, sortId)
        const page = 1
        if (cached?.list.length) {
          const result = setList(cached, tagId, sortId, page)
          listRef.current?.setList(result.list)
        }
        listRef.current?.setStatus('loading')
        return getList(source, tagId, sortId, page, !!cached).then((info) => {
          if (loadIdRef.current != cacheKey) return
          const result = setList(info, tagId, sortId, page)
          if (info.list.length) setCache(cacheKey, info)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            listRef.current?.setList(result.list)
            listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
          })
        }).catch(() => {
          if (loadIdRef.current != cacheKey) return
          // the cached playlists stay when the new ones could not be loaded
          if (cached?.list.length) {
            listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
            return
          }
          if (songlistState.listInfo.list.length && page == 1) clearList()
          listRef.current?.setList([])
          listRef.current?.setStatus('error')
        })
      }
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handleRefresh: SonglistProps['onRefresh'] = () => {
    const page = 1
    listRef.current?.setStatus('refreshing')
    getList(songlistState.listInfo.source, songlistState.listInfo.tagId, songlistState.listInfo.sortId, page, true).then((info) => {
      const result = setList(info, songlistState.listInfo.tagId, songlistState.listInfo.sortId, page)
      if (info.list.length) setCache(getCacheKey(songlistState.listInfo.source, songlistState.listInfo.sortId, songlistState.listInfo.tagId), info)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      // what is shown stays when the refresh failed
      listRef.current?.setStatus(songlistState.listInfo.list.length ? 'idle' : 'error')
    })
  }
  const handleLoadMore: SonglistProps['onLoadMore'] = () => {
    listRef.current?.setStatus('loading')
    const page = songlistState.listInfo.list.length ? songlistState.listInfo.page + 1 : 1
    getList(songlistState.listInfo.source, songlistState.listInfo.tagId, songlistState.listInfo.sortId, page).then((info) => {
      const result = setList(info, songlistState.listInfo.tagId, songlistState.listInfo.sortId, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (songlistState.listInfo.list.length && page == 1) clearList()
      listRef.current?.setStatus('error')
    })
  }

  return <Songlist
    ref={listRef}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
   />
})

