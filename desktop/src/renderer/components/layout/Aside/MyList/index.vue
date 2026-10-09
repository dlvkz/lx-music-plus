<template>
  <div :class="$style.myList">
    <div :class="$style.header">
      <h2 role="link" tabindex="0" :class="{ [$style.headerActive]: isLibraryPage }" @click="openLibrary" @keydown.enter="openLibrary">{{ $t('my_list') }}</h2>
    </div>
    <div :class="$style.list">
      <div :class="[$style.listContainer, 'scroll', 'hide-scrollbar']" @contextmenu.prevent.stop="handleContainerRightClick">
        <ul ref="dom_lists_list" :class="[$style.lists, { [$style.sortable]: isModDown }]">
          <li
            class="default-list" :class="[$style.listItem, { [$style.clicked]: rightClickItemIndex == -2 }]"
            data-index="-2" @contextmenu.prevent.stop="handleListsItemRigthClick($event, -2)"
          >
            <ListItem
              :list-id="defaultList.id" :name="defaultListName" :pic-style="picStyle"
              :active="activeListId == defaultList.id || rightClickItemIndex == -2" :fetching="fetchingListStatus[defaultList.id]"
              :class="{ [$style.active]: activeListId == defaultList.id }" @select="handleListToggle(defaultList.id)"
            />
            <base-input
              :class="$style.listsInput" type="text" :value="defaultListName"
              :placeholder="defaultListName" @keyup.enter="handleSaveListName(-2, $event)" @blur="handleSaveListName(-2, $event)"
            />
          </li>
          <li
            class="default-list" :class="[$style.listItem, { [$style.clicked]: rightClickItemIndex == -1 }]"
            data-index="-1" @contextmenu.prevent.stop="handleListsItemRigthClick($event, -1)"
          >
            <ListItem
              :list-id="loveList.id" :name="loveListName" :pic-style="picStyle"
              :active="activeListId == loveList.id || rightClickItemIndex == -1" :fetching="fetchingListStatus[loveList.id]"
              :class="{ [$style.active]: activeListId == loveList.id }" @select="handleListToggle(loveList.id)"
            />
            <base-input
              :class="$style.listsInput" type="text" :value="loveListName"
              :placeholder="loveListName" @keyup.enter="handleSaveListName(-1, $event)" @blur="handleSaveListName(-1, $event)"
            />
          </li>
          <li
            v-for="(item, index) in userLists" :key="item.id" class="user-list"
            :class="[$style.listItem, { [$style.clicked]: rightClickItemIndex == index }]"
            :data-index="index" @contextmenu.prevent.stop="handleListsItemRigthClick($event, index)"
          >
            <ListItem
              :list-id="item.id" :name="item.name" :pic-style="picStyle"
              :active="activeListId == item.id || rightClickItemIndex == index" :fetching="fetchingListStatus[item.id]"
              :class="{ [$style.active]: activeListId == item.id }" @select="handleListToggle(item.id)"
            />
            <base-input
              :class="$style.listsInput" type="text" :value="item.name"
              :placeholder="item.name" @keyup.enter="handleSaveListName(index, $event)" @blur="handleSaveListName(index, $event)"
            />
          </li>
          <li
            v-for="item in collections" :key="getCollectionKey(item.type, item.source, item.id)" class="collection-item" :class="$style.listItem"
            @contextmenu.prevent.stop="handleCollectionRightClick(item)"
          >
            <CollectionItem :collection="item" :pic-style="picStyle" :active="isCollectionActive(item)" @select="openCollection(item)" />
          </li>
          <transition enter-active-class="animated-fast slideInLeft" leave-active-class="animated-fast fadeOut" @after-leave="isNewListLeave = false" @after-enter="$refs.dom_listsNewInput.focus()">
            <li v-if="isShowNewList" :class="[$style.listItem, $style.listsNew, { [$style.newLeave]: isNewListLeave }]">
              <base-input
                ref="dom_listsNewInput" :class="$style.listsInput" type="text" :placeholder="$t('lists__new_list_input')"
                @keyup.enter="handleCreateList" @blur="handleCreateList"
              />
            </li>
          </transition>
        </ul>
      </div>
    </div>
    <base-menu v-model="isShowMenu" :menus="currentMenus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
    <DuplicateMusicModal v-model:visible="isShowDuplicateMusicModal" :list-info="duplicateListInfo" />
    <ListSortModal v-model:visible="isShowListSortModal" :list-info="sortListInfo" />
    <ListUpdateModal v-model:visible="isShowListUpdateModal" />
  </div>
</template>

<script>
import { ref, computed, watch, nextTick, onBeforeUnmount } from '@common/utils/vueTools'
import { setListMenuHandler } from '@renderer/store/list/listMenu'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { openUrl } from '@common/utils/electron'
import { LIST_IDS } from '@common/constants'
import musicSdk from '@renderer/utils/musicSdk'
import { defaultList, loveList, userLists, fetchingListStatus } from '@renderer/store/list/state'
import { removeUserList } from '@renderer/store/list/action'
import { appSetting } from '@renderer/store/setting'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'
import { saveListPrevSelectId } from '@renderer/utils/data'
import { showSelectDialog } from '@renderer/utils/ipc'
import { getListDisplayName, setDefaultListCover, resetDefaultListCustom, isDefaultListId } from '@renderer/store/list/defaultListCustom'
import { setUserListCover, setUserListCoverFromFile } from '@renderer/store/list/userListCovers'

import DuplicateMusicModal from '@renderer/views/List/MyList/components/DuplicateMusicModal.vue'
import ListSortModal from '@renderer/views/List/MyList/components/ListSortModal.vue'
import ListUpdateModal from '@renderer/views/List/MyList/components/ListUpdateModal.vue'
import useShare from '@renderer/views/List/MyList/useShare'
import useMenu from '@renderer/views/List/MyList/useMenu'
import useListUpdate from '@renderer/views/List/MyList/useListUpdate'
import useSort from '@renderer/views/List/MyList/useSort'
import useDarg from '@renderer/views/List/MyList/useDarg'
import useEditList from '@renderer/views/List/MyList/useEditList'
import useListScroll from '@renderer/views/List/MyList/useListScroll'
import useDuplicate from '@renderer/views/List/MyList/useDuplicate'
import ListItem from './ListItem.vue'
import CollectionItem from './CollectionItem.vue'
import { collections, getCollectionKey, removeCollection } from '@renderer/store/list/collections'

// Ported from Any Listen: components/layout/Aside/MyList/{index,Header,List}.svelte,
// list actions are LX Music's (views/List/MyList)
export default {
  components: {
    ListItem,
    CollectionItem,
    DuplicateMusicModal,
    ListSortModal,
    ListUpdateModal,
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const t = useI18n()

    const dom_lists_list = ref(null)
    const rightClickItemIndex = ref(-10)
    const isContainerMenu = ref(false)

    const activeListId = computed(() => route.path == '/list' ? route.query.id : null)

    // Any Listen: useListItemHeight(3.2), pic = height * 0.64
    const picStyle = computed(() => {
      const fontSize = appSetting['common.fontSize']
      const size = Math.ceil(fontSize * 3.2 * 0.64) + 'px'
      return { width: size, height: size }
    })

    const { handleImportList, handleExportList } = useShare()
    const { isShowListUpdateModal, handleUpdateSourceList } = useListUpdate()
    const { isShowListSortModal, sortListInfo, handleSortList } = useSort()
    const { isShowDuplicateMusicModal, duplicateListInfo, handleDuplicateList } = useDuplicate()
    const { handleRename, handleSaveListName, isShowNewList, isNewListLeave, handleCreateList } = useEditList({ dom_lists_list })
    useListScroll({ dom_lists_list })

    const handleOpenSourceDetailPage = async(listInfo) => {
      const { source, sourceListId } = listInfo
      if (!sourceListId) return
      let url
      if (/board__/.test(sourceListId)) {
        const id = sourceListId.replace(/board__/, '')
        url = musicSdk[source].leaderboard.getDetailPageUrl(id)
      } else if (musicSdk[source]?.songList?.getDetailPageUrl) {
        url = await musicSdk[source].songList.getDetailPageUrl(sourceListId)
      }
      if (!url) return
      void openUrl(url)
    }

    const handleListToggle = (id) => {
      if (id == activeListId.value) return
      void router[route.path == '/list' ? 'replace' : 'push']({
        path: '/list',
        query: { id },
      }).catch(_ => _)
    }

    const handleRemove = (listInfo) => {
      void dialog.confirm({
        message: t('lists__remove_tip', { name: listInfo.name }),
        confirmButtonText: t('lists__remove_tip_button'),
      }).then(isRemove => {
        if (!isRemove) return
        void removeUserList([listInfo.id])
        if (activeListId.value == listInfo.id) handleListToggle(LIST_IDS.DEFAULT)
      })
    }

    const defaultListName = computed(() => getListDisplayName(defaultList))
    const loveListName = computed(() => getListDisplayName(loveList))

    const handleChangeCover = async(listInfo) => {
      const { canceled, filePaths } = await showSelectDialog({
        title: t('lists__change_cover'),
        properties: ['openFile'],
        filters: [{ name: t('lists__change_cover_filter'), extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
      })
      if (canceled || !filePaths.length) return
      const setCover = isDefaultListId(listInfo.id) ? setDefaultListCover : setUserListCoverFromFile
      void setCover(listInfo.id, filePaths[0]).catch(err => {
        console.log(err)
      })
    }
    const handleResetCustom = (listInfo) => {
      if (isDefaultListId(listInfo.id)) resetDefaultListCustom(listInfo.id)
      else setUserListCover(listInfo.id, null)
    }

    const {
      menus,
      menuLocation,
      isShowMenu,
      showMenu,
      menuClick,
    } = useMenu({
      emit() {},
      handleImportList,
      handleExportList,
      handleUpdateSourceList,
      handleOpenSourceDetailPage,
      handleSortList,
      handleDuplicateList,
      handleRename,
      handleRemove,
      handleChangeCover,
      handleResetCustom,
    })

    // Any Listen puts "create list" first in the list menu and alone in the blank area menu
    const createMenu = computed(() => ({ name: t('user_list_menu__create'), action: 'create', disabled: false }))
    // the import of the library of another platform (views/Import)
    const importMenu = computed(() => ({ name: t('import__menu'), action: 'import_platform', disabled: false }))
    const currentMenus = computed(() => {
      return isContainerMenu.value
        ? [createMenu.value, importMenu.value, { name: t('list_update_modal__title'), action: 'update_all', disabled: false }]
        : [createMenu.value, importMenu.value, ...menus.value]
    })

    const handleListsItemRigthClick = (event, index) => {
      isContainerMenu.value = false
      rightClickItemIndex.value = index
      showMenu(event, index)
    }
    // the library page opens this menu for its lists
    setListMenuHandler((event, listId) => {
      const index = listId == defaultList.id ? -2 : listId == loveList.id ? -1 : userLists.findIndex(l => l.id == listId)
      if (index < -2) return
      handleListsItemRigthClick(event, index)
    })
    onBeforeUnmount(() => {
      setListMenuHandler(null)
    })

    const handleContainerRightClick = (event) => {
      isContainerMenu.value = true
      rightClickItemIndex.value = -3
      menuLocation.x = event.pageX
      menuLocation.y = event.pageY
      if (isShowMenu.value) return
      void nextTick(() => {
        isShowMenu.value = true
      })
    }

    const handleMenuClick = (action) => {
      if (rightClickItemIndex.value < -3) return
      const index = rightClickItemIndex.value
      rightClickItemIndex.value = -10
      switch (action?.action) {
        case 'create':
          isShowMenu.value = false
          isShowNewList.value = true
          return
        case 'update_all':
          isShowMenu.value = false
          isShowListUpdateModal.value = true
          return
        case 'import_platform':
          isShowMenu.value = false
          void router.push({ path: '/import' })
          return
      }
      if (index == -3) {
        isShowMenu.value = false
        return
      }
      menuClick(action, index)
    }

    const { isModDown } = useDarg({ dom_lists_list, handleMenuClick, handleSaveListName })

    watch(activeListId, (listId) => {
      if (listId) saveListPrevSelectId(listId)
    })

    watch(() => userLists, (lists) => {
      if (!activeListId.value || activeListId.value == defaultList.id || activeListId.value == loveList.id) return
      if (lists.some(l => l.id == activeListId.value)) return
      handleListToggle(defaultList.id)
    })

    // the heading opens the whole library as a page
    const isLibraryPage = computed(() => route.path == '/library')
    const openLibrary = () => {
      void router.push({ path: '/library' })
    }

    // collected albums / artists: a link to their page
    const openCollection = (item) => {
      void router.push(item.type == 'artist'
        ? { path: '/artist', query: { name: item.id, source: item.source || undefined } }
        : { path: '/album', query: { source: item.source, id: item.id, name: item.name } })
    }
    const isCollectionActive = (item) => {
      if (item.type == 'artist') return route.path == '/artist' && route.query.name == item.id
      return route.path == '/album' && route.query.source == item.source && String(route.query.id) == item.id
    }
    const handleCollectionRightClick = (item) => {
      void dialog.confirm({
        message: t('collection__remove_tip', { name: item.name }),
        confirmButtonText: t('confirm_button_text'),
      }).then(confirmed => {
        if (confirmed) removeCollection(item)
      })
    }

    return {
      isLibraryPage,
      openLibrary,
      collections,
      getCollectionKey,
      openCollection,
      isCollectionActive,
      handleCollectionRightClick,

      dom_lists_list,
      rightClickItemIndex,
      activeListId,
      picStyle,
      defaultList,
      loveList,
      defaultListName,
      loveListName,
      userLists,
      fetchingListStatus,
      isShowListUpdateModal,
      isShowListSortModal,
      sortListInfo,
      isShowDuplicateMusicModal,
      duplicateListInfo,
      handleSaveListName,
      isShowNewList,
      isNewListLeave,
      handleCreateList,
      handleListsItemRigthClick,
      handleContainerRightClick,
      isShowMenu,
      handleMenuClick,
      currentMenus,
      menuLocation,
      handleListToggle,
      isModDown,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.myList {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  margin-top: 10px;
  overflow: hidden;
}
.header {
  flex: none;
  padding: 6px 12px;
  h2 {
    display: inline-block;
    font-size: 12px;
    color: var(--color-primary-light-300);
    // opens the library page
    cursor: pointer;
    transition: color 0.3s ease;
    &:hover, &.headerActive {
      color: var(--color-primary-font);
    }
  }
}
.list {
  position: relative;
  flex: auto;
  min-height: 0;
}
.listContainer {
  position: relative;
  display: block;
  height: 100%;
}
.lists {
  &.sortable {
    .listItem {
      cursor: move;
    }
  }
}
.listItem {
  position: relative;
  padding: 0 6px;
  &.clicked {
    > div {
      background-color: var(--color-primary-background-hover);
    }
  }
  &.editing {
    > div {
      visibility: hidden;
    }
    .listsInput {
      display: block;
    }
  }
}
// used by LX's useListScroll to find the active list
.active {
  opacity: 1;
}
.dragingItem {
  opacity: 0.6;
}
.listsInput {
  display: none;
  position: absolute;
  top: 50%;
  left: 12px;
  right: 12px;
  transform: translateY(-50%);
  font-size: 13px;
}
.listsNew {
  height: 40px;
  .listsInput {
    display: block;
  }
  &.newLeave {
    .listsInput {
      opacity: 0;
    }
  }
}
</style>
