import { createList, removeUserList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import { toMD5 } from '@/utils/tools'
import { useMyList } from '@/store/list/hook'
import { setListCover } from '@/utils/listCover'
import songlistState, { type Source } from '@/store/songlist/state'
import { setPlayingFrom } from '@/core/playingFrom'

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`

export const handlePlay = async(id: string, source: Source, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  const listId = getListId(id, source)
  // (the player shows what is playing: the playlist open)
  const playlistName = songlistState.listDetailInfo.id == id ? String(songlistState.listDetailInfo.info.name ?? '') : ''
  setPlayingFrom(listId, 'playlist', playlistName, { kind: 'songlist', source, id, name: playlistName })
  let isPlayingList = false
  // console.log(list)
  if (!list?.length) list = (await getListDetail(id, source, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    void playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(source, id)
  if (!fullList.length) return
  if (isPlayingList) {
    if (listState.tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    void playList(LIST_IDS.TEMP, index)
  }
}

/**
 * Id of the list created when a playlist is collected
 */
export const getCollectedListId = (id: string, source: Source) => `${source}_${toMD5(getListId(id, source))}`

/**
 * Whether the playlist is in the user's lists
 */
export const useIsCollected = (id: string, source: Source) => {
  const lists = useMyList()
  const listId = getCollectedListId(id, source)
  return lists.some(l => l.id == listId)
}

/**
 * Collect the playlist, or remove it from the user's lists when it is collected already
 */
export const handleCollect = async(id: string, source: Source, name: string, img?: string | null) => {
  const listId = getCollectedListId(id, source)

  if (listState.userList.some(l => l.id == listId)) {
    await removeUserList([listId])
    void setListCover(listId, null)
    return
  }

  const list = await getListDetailAll(source, id)
  await createList({
    name,
    id: listId,
    list,
    source,
    sourceListId: id,
  })
  void setListCover(listId, img)
}
