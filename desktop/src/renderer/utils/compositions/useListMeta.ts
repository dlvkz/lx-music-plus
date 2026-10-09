import { ref, computed, watch, onBeforeUnmount, type Ref } from '@common/utils/vueTools'
import { getListMusics } from '@renderer/store/list/action'
import { getListMusicPic } from '@renderer/utils/listMusicPic'
import { LIST_IDS } from '@common/constants'
import { getDefaultListCover } from '@renderer/store/list/defaultListCustom'
import { getUserListCover } from '@renderer/store/list/userListCovers'
import { appSetting } from '@renderer/store/setting'

/**
 * Song count and cover of a "My list" entry (Any Listen: useListCover + meta.songCount)
 * The cover of a list is the one picked by the user, the picture of the collected playlist,
 * the art of a song of the list otherwise (an empty loved list shows a heart)
 */
export default (listId: Ref<string>) => {
  const count = ref(0)
  const songCover = ref<string | null>(null)
  const cover = computed(() => getDefaultListCover(listId.value) ?? getUserListCover(listId.value) ?? songCover.value)
  let cancelPic: (() => void) | null = null

  let prevId = ''
  const update = () => {
    const id = listId.value
    // another list: its cover / count must not be the ones of the previous list while it loads (or if it has none)
    if (id != prevId) {
      prevId = id
      cancelPic?.()
      cancelPic = null
      songCover.value = null
      count.value = 0
    }
    void getListMusics(id).then(list => {
      if (id != listId.value) return
      count.value = list.length
      cancelPic?.()
      cancelPic = null
      // the loved list shows the song added last, the other lists their first song
      const first = id == LIST_IDS.LOVE && appSetting['list.addMusicLocationType'] != 'top' ? list[list.length - 1] : list[0]
      if (!first) {
        songCover.value = null
        return
      }
      cancelPic = getListMusicPic(first, id, (url) => {
        cancelPic = null
        if (id == listId.value) songCover.value = url
      })
    })
  }

  const handleListUpdate = (ids: string[]) => {
    if (ids.includes(listId.value)) update()
  }

  watch(listId, update, { immediate: true })
  window.app_event.on('myListUpdate', handleListUpdate)
  onBeforeUnmount(() => {
    cancelPic?.()
    window.app_event.off('myListUpdate', handleListUpdate)
  })

  return { count, cover }
}
