import { toast } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import { selectFile, privateStorageDirectoryPath } from '@/utils/fs'
import { isSyncList, setListSync } from '@/core/download'
import { isBuiltInListId, DEFAULT_LIST_SETTING_KEYS } from '@/utils/listName'
import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import Menu, { type Menus, type MenuType, type Position } from '@/components/common/Menu'
import { LIST_IDS } from '@/config/constant'
import musicSdk from '@/utils/musicSdk'
import { scaleSizeW } from '@/utils/pixelRatio'
import listState from '@/store/list/state'

export interface SelectInfo {
  listInfo: LX.List.MyListInfo
  // selectedList: LX.Music.MusicInfo[]
  index: number
  // listId: string
  // single: boolean
}
const initSelectInfo = {}

const menuItemWidth = scaleSizeW(110)


export interface ListMenuProps {
  onNew: (position: number) => void
  onRename: (listInfo: LX.List.UserListInfo) => void
  onSort: (listInfo: LX.List.MyListInfo) => void
  onDuplicateMusic: (listInfo: LX.List.MyListInfo) => void
  onImport: (listInfo: LX.List.MyListInfo, index: number) => void
  onExport: (listInfo: LX.List.MyListInfo, index: number) => void
  onSync: (listInfo: LX.List.UserListInfo) => void
  onSelectLocalFile: (listInfo: LX.List.MyListInfo, index: number) => void
  onRemove: (listInfo: LX.List.UserListInfo) => void
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type {
  Position,
}

export default forwardRef<ListMenuType, ListMenuProps>(({
  onNew,
  onRename,
  onSort,
  onDuplicateMusic,
  onImport,
  onExport,
  onSync,
  onSelectLocalFile,
  onRemove,
}, ref) => {
  const t = useI18n()
  const menuRef = useRef<MenuType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<Menus>([])
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    show(selectInfo, position) {
      selectInfoRef.current = selectInfo
      handleSetMenu(selectInfo.listInfo)
      if (visible) menuRef.current?.show(position)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show(position)
        })
      }
    },
  }))

  const handleSetMenu = (listInfo: LX.List.MyListInfo) => {
    let rename = false
    let sync = false
    let remove = false
    let local_file = !listState.fetchingListStatus[listInfo.id]
    let userList: LX.List.UserListInfo
    switch (listInfo.id) {
      case LIST_IDS.DEFAULT:
      case LIST_IDS.LOVE:
        // only the display name / cover of the built-in lists change
        rename = true
        break
      default:
        userList = listInfo as LX.List.UserListInfo
        rename = true
        remove = true
        sync = !!(userList.source && musicSdk[userList.source]?.songList)
        break
    }

    setMenus([
      { action: 'new', label: t('list_create') },
      { action: 'rename', disabled: !rename, label: t('list_rename') },
      ...(isBuiltInListId(listInfo.id) ? [
        { action: 'cover', label: t('list_change_cover') },
        { action: 'resetCustom', label: t('list_reset_custom'), disabled: !settingState.setting[DEFAULT_LIST_SETTING_KEYS[listInfo.id].name] && !settingState.setting[DEFAULT_LIST_SETTING_KEYS[listInfo.id].cover] },
      ] as const : []),
      { action: 'keepDownloaded', label: t(isSyncList(listInfo.id) ? 'download__sync_off' : 'download__sync_on') },
      { action: 'sort', label: t('list_sort') },
      { action: 'duplicateMusic', label: t('lists__duplicate') },
      { action: 'local_file', disabled: !local_file, label: t('list_select_local_file') },
      { action: 'sync', disabled: !sync || !local_file, label: t('list_sync') },
      { action: 'import', label: t('list_import') },
      { action: 'export', label: t('list_export') },
      // { action: 'changePosition', label: t('change_position') },
      { action: 'remove', disabled: !remove, label: t('list_remove') },
    ])
  }

  const handleChangeCover = async(listId: string) => {
    if (!isBuiltInListId(listId)) return
    const file = await selectFile({ extTypes: ['jpg', 'jpeg', 'png', 'webp'], toPath: privateStorageDirectoryPath })
    if (!file?.data) return
    updateSetting({ [DEFAULT_LIST_SETTING_KEYS[listId].cover]: file.data })
  }

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'new':
        onNew(Math.max(selectInfo.index - 1, 0))
        break
      case 'rename':
        onRename(selectInfo.listInfo as LX.List.UserListInfo)
        break
      case 'cover':
        void handleChangeCover(selectInfo.listInfo.id)
        break
      case 'resetCustom':
        if (isBuiltInListId(selectInfo.listInfo.id)) {
          const keys = DEFAULT_LIST_SETTING_KEYS[selectInfo.listInfo.id]
          updateSetting({ [keys.name]: '', [keys.cover]: '' })
        }
        break
      case 'keepDownloaded':
        void setListSync(selectInfo.listInfo.id, !isSyncList(selectInfo.listInfo.id)).then(() => {
          toast(t(isSyncList(selectInfo.listInfo.id) ? 'download__sync_on_tip' : 'download__sync_off_tip'))
        })
        break
      case 'sort':
        onSort(selectInfo.listInfo)
        break
      case 'duplicateMusic':
        onDuplicateMusic(selectInfo.listInfo)
        break
      case 'import':
        onImport(selectInfo.listInfo, selectInfo.index)
        break
      case 'export':
        onExport(selectInfo.listInfo, selectInfo.index)
        break
      case 'sync':
        onSync(selectInfo.listInfo as LX.List.UserListInfo)
        break
        // case 'changePosition':

        //   break
      case 'local_file':
        onSelectLocalFile(selectInfo.listInfo, selectInfo.index)
        break
      case 'remove':
        onRemove(selectInfo.listInfo as LX.List.UserListInfo)
        break

      default:
        break
    }
  }

  return (
    visible
      ? <Menu
          ref={menuRef}
          menus={menus}
          onPress={handleMenuPress}
          width={menuItemWidth}
        />
      : null
  )
})
