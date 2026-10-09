import { hasUserListCover } from '@renderer/store/list/userListCovers'
import { computed, ref, reactive, nextTick } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { userLists, defaultList, loveList } from '@renderer/store/list/state'
import musicSdk from '@renderer/utils/musicSdk'
import { addLocalFile } from './actions'
import { hasDefaultListCustom } from '@renderer/store/list/defaultListCustom'

export default ({
  emit,

  handleRename,
  handleDuplicateList,
  handleSortList,
  handleOpenSourceDetailPage,
  handleImportList,
  handleExportList,
  handleUpdateSourceList,
  handleRemove,
  handleChangeCover,
  handleResetCustom,
}) => {
  const menuControl = reactive({
    rename: true,
    duplicate: true,
    sort: true,
    local_file: true,
    sourceDetail: true,
    import: true,
    export: true,
    sync: false,
    remove: true,
    // built-in list (default / love) display customization
    custom: false,
    resetCustom: false,
    builtIn: true,
  })
  const t = useI18n()
  const menuLocation = reactive({ x: 0, y: 0 })
  const isShowMenu = ref(false)

  const menus = computed(() => {
    return [
      {
        name: t('lists__rename'),
        action: 'rename',
        disabled: !menuControl.rename,
      },
      ...(menuControl.custom
        ? [
            {
              name: t('lists__change_cover'),
              action: 'change_cover',
              disabled: false,
            },
            {
              name: t(menuControl.builtIn ? 'lists__reset_custom' : 'lists__remove_cover'),
              action: 'reset_custom',
              disabled: !menuControl.resetCustom,
            },
          ]
        : []),
      {
        name: t('lists__sort_list'),
        action: 'sort',
        disabled: !menuControl.sort,
      },
      {
        name: t('lists__duplicate'),
        action: 'duplicate',
        disabled: !menuControl.duplicate,
      },
      {
        name: t('lists__select_local_file'),
        action: 'local_file',
        disabled: !menuControl.local_file,
      },
      {
        name: t('lists__sync'),
        action: 'sync',
        disabled: !menuControl.sync,
      },
      {
        name: t('lists__source_detail'),
        action: 'sourceDetail',
        disabled: !menuControl.sourceDetail,
      },
      {
        name: t('lists__import'),
        action: 'import',
        disabled: !menuControl.export,
      },
      {
        name: t('lists__export'),
        action: 'export',
        disabled: !menuControl.export,
      },
      {
        name: t('lists__remove'),
        action: 'remove',
        disabled: !menuControl.remove,
      },
    ]
  })

  const assertSupportDetail = (source, index) => {
    if (source) {
      const { sourceListId } = userLists[index]
      if (sourceListId) {
        if (/board__/.test(sourceListId)) {
          // const id = sourceListId.replace(/board__/, '')
          return !!musicSdk[source]?.leaderboard?.getDetailPageUrl
        } else {
          return !!musicSdk[source]?.songList?.getDetailPageUrl
        }
      }
    }
    return false
  }

  const showMenu = (event, index) => {
    let source
    switch (index) {
      case -1:
      case -2:
        // the display name / cover of built-in lists can be customized when the host view supports it
        menuControl.custom = !!handleChangeCover
        menuControl.builtIn = true
        menuControl.rename = menuControl.custom
        menuControl.resetCustom = hasDefaultListCustom(index == -2 ? defaultList.id : loveList.id)
        menuControl.remove = false
        menuControl.sync = false
        break
      default:
        // every list can get a cover
        menuControl.custom = !!handleChangeCover
        menuControl.builtIn = false
        menuControl.rename = true
        menuControl.resetCustom = hasUserListCover(userLists[index].id)
        menuControl.remove = true
        source = userLists[index].source
        menuControl.sync = !!source && !!musicSdk[source]?.songList
        break
    }
    // menuControl.sort = !!getList(this.getTargetListInfo(index)?.id).length
    menuControl.sourceDetail = assertSupportDetail(source, index)

    menuLocation.x = event.pageX
    menuLocation.y = event.pageY

    if (isShowMenu.value) return
    emit('show-menu')
    nextTick(() => {
      isShowMenu.value = true
    })
  }

  const hideMenu = () => {
    isShowMenu.value = false
  }

  const getListInfo = (index) => {
    let list
    switch (index) {
      case -2:
        list = defaultList
        break
      case -1:
        list = loveList
        break
      default:
        list = userLists[index]
        if (!list) return null
        break
    }
    return list
  }

  const menuClick = (action, index) => {
    // console.log(action)
    hideMenu()
    if (!action) return
    const listInfo = getListInfo(index)
    switch (action.action) {
      case 'rename':
        handleRename(index)
        break
      case 'change_cover':
        handleChangeCover(listInfo)
        break
      case 'reset_custom':
        handleResetCustom(listInfo)
        break
      case 'duplicate':
        handleDuplicateList(listInfo)
        break
      case 'sort':
        handleSortList(listInfo)
        break
      case 'local_file':
        addLocalFile(listInfo)
        break
      case 'sourceDetail':
        handleOpenSourceDetailPage(listInfo)
        break
      case 'import':
        handleImportList(listInfo, index)
        break
      case 'export':
        handleExportList(listInfo)
        break
      case 'sync':
        handleUpdateSourceList(listInfo)
        break
      case 'remove':
        handleRemove(listInfo)
        break
    }
  }

  return {
    menus,
    menuLocation,
    isShowMenu,
    showMenu,
    menuClick,
  }
}
