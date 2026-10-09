import { createList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/leaderboard'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import leaderboardState from '@/store/leaderboard/state'
import { setPlayingFrom } from '@/core/playingFrom'
import syncSourceList from '@/core/syncSourceList'
import { confirmDialog, toMD5, toast } from '@/utils/tools'


const getListId = (id: string) => `board__${id}`

export const handlePlay = async(id: string, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  let isPlayingList = false
  // console.log(list)
  const listId = getListId(id)
  // (the player shows what is playing: the name of the chart)
  const boardName = leaderboardState.boards[id.split('__')[0] as LX.OnlineSource]?.list.find(board => board.id == id)?.name ?? ''
  setPlayingFrom(listId, 'chart', boardName, { kind: 'collection', info: { type: 'chart', id, name: boardName, source: id.split('__')[0] as LX.OnlineSource } })
  if (!list?.length) list = (await getListDetail(id, 1)).list
  if (list?.length) {
    await setTempList(listId, [...list])
    void playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(id)
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

export const handleCollect = async(id: string, name: string, source: LX.OnlineSource) => {
  const listId = getListId(id)
  const targetList = listState.userList.find(l => l.sourceListId == listId)
  if (targetList) {
    const confirm = await confirmDialog({
      message: global.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    return
  }

  const list = await getListDetailAll(id)
  await createList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source,
    sourceListId: listId,
  })
  toast(global.i18n.t('collect_success'))
}
