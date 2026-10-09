import { tempListMeta, userLists } from '@renderer/store/list/state'
import { getListDetail, getListDetailAll } from '@renderer/store/songList/action'
import { createUserList, removeUserList, setTempList } from '@renderer/store/list/action'
import { setUserListCover } from '@renderer/store/list/userListCovers'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'
import { setPlayingFrom } from '@renderer/store/list/playingFrom'
import { listDetailInfo } from '@renderer/store/songList/state'
import { toMD5 } from '@renderer/utils'

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`

/**
 * Id of the list created when a playlist is collected
 */
export const getCollectedListId = (id: string, source: LX.OnlineSource) => `${source}_${toMD5(getListId(id, source))}`

export const isCollected = (id: string, source: LX.OnlineSource) => {
  const listId = getCollectedListId(id, source)
  return userLists.some(l => l.id == listId)
}

/**
 * Collect the playlist (it keeps the picture of the playlist), or remove it from the user's lists
 * when it is collected already
 */
export const addSongListDetail = async(id: string, source: LX.OnlineSource, name?: string, img?: string | null) => {
  const listId = getCollectedListId(id, source)
  if (userLists.some(l => l.id == listId)) {
    await removeUserList([listId])
    setUserListCover(listId, null)
    return
  }

  const list = await getListDetailAll(id, source)
  await createUserList({
    name,
    id: listId,
    list,
    source,
    sourceListId: id,
  })
  setUserListCover(listId, img ?? null)
}

export const playSongListDetail = async(id: string, source: LX.OnlineSource, list?: LX.Music.MusicInfoOnline[], index: number = 0) => {
  let isPlayingList = false
  // console.log(list)
  const listId = getListId(id, source)
  // (the queue shows what is playing: the playlist open)
  setPlayingFrom(listId, 'playlist', listDetailInfo.id == id ? String(listDetailInfo.info.name ?? '') : '', { path: '/songList/detail', query: { source, id } })
  if (!list?.length) list = (await getListDetail(id, source, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(id, source)
  if (!fullList.length) return
  if (isPlayingList) {
    if (tempListMeta.id == listId) {
      await setTempList(listId, [...fullList])
    }
  } else {
    await setTempList(listId, [...fullList])
    playList(LIST_IDS.TEMP, index)
  }
}
