import { LIST_IDS } from '@/config/constant'
import { getBuiltInListName } from '@/utils/listName'
import { useEffect, useState } from 'react'
import state, { type InitState } from './state'
import { getListMusics } from '@/core/list'

const NAME_KEYS: Array<keyof LX.AppSetting> = ['common.langId', 'list.defaultListName', 'list.loveListName']

export const useMyList = () => {
  const [lists, setList] = useState(state.allList)
  lists[0].name = getBuiltInListName(LIST_IDS.DEFAULT)
  lists[1].name = getBuiltInListName(LIST_IDS.LOVE)

  useEffect(() => {
    const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.some(key => NAME_KEYS.includes(key))) return
      setList((lists) => {
        lists[0].name = getBuiltInListName(LIST_IDS.DEFAULT)
        lists[1].name = getBuiltInListName(LIST_IDS.LOVE)
        return [...lists]
      })
    }
    global.state_event.on('mylistUpdated', setList)
    global.state_event.on('configUpdated', handleConfigUpdate)
    return () => {
      global.state_event.off('mylistUpdated', setList)
      global.state_event.off('configUpdated', handleConfigUpdate)
    }
  }, [])

  return lists
}

export const useActiveListId = () => {
  const [id, setId] = useState(state.activeListId)

  useEffect(() => {
    global.state_event.on('mylistToggled', setId)
    return () => {
      global.state_event.off('mylistToggled', setId)
    }
  }, [])

  return id
}


export const useMusicList = () => {
  const [list, setList] = useState<LX.List.ListMusics>([])

  useEffect(() => {
    const handleToggle = (activeListId: string) => {
      void getListMusics(activeListId).then((list) => {
        setList([...list])
      })
    }
    const handleChange = (ids: string[]) => {
      if (!ids.includes(state.activeListId)) return
      void getListMusics(state.activeListId).then((list) => {
        setList([...list])
      })
    }
    global.state_event.on('mylistToggled', handleToggle)
    global.app_event.on('myListMusicUpdate', handleChange)

    handleToggle(state.activeListId)

    return () => {
      global.state_event.off('mylistToggled', handleToggle)
      global.app_event.off('myListMusicUpdate', handleChange)
    }
  }, [])

  return list
}

export const useMusicExistsList = (list: LX.List.MyListInfo, musicInfo: LX.Music.MusicInfo) => {
  const [isExists, setExists] = useState(false)

  useEffect(() => {
    void getListMusics(list.id).then((musics) => {
      setExists(musics.some(s => s.id == musicInfo.id))
    })
  }, [list.id, musicInfo.id])

  return isExists
}

export const useListFetching = (listId: string) => {
  const [fetching, setFetching] = useState(!!state.fetchingListStatus[listId])

  useEffect(() => {
    let prevStatus = state.fetchingListStatus[listId]
    const handleUpdate = (status: InitState['fetchingListStatus']) => {
      let currentStatus = status[listId]
      if (currentStatus == null || prevStatus == status[listId]) return
      setFetching(prevStatus = currentStatus)
    }
    global.state_event.on('fetchingListStatusUpdated', handleUpdate)
    return () => {
      global.state_event.off('fetchingListStatusUpdated', handleUpdate)
    }
  }, [listId])

  return fetching
}

