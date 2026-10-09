<template>
  <!-- Ported from Any Listen: components/common/MusicList/{MusicList,List/index}.svelte -->
  <div :class="$style.list">
    <ListHeader
      :list-id="listId" :name="listName" :music-count="list.length" :multimode="multimode" :finding="isShowSearchBar"
      @play="handlePlayAll" @playrandom="handlePlayRandom" @multi="toggleMultimode" @find="toggleFind"
      @duplicate="isShowDuplicateMusicModal = true" @sort="isShowListSortModal = true"
    />
    <common-music-list-table-header
      :multimode="multimode" :pic-width="picWidth" :select-all="list.length > 0 && selectedList.length == list.length"
      :disabled-select="!list.length" @selectall="handleSelectAll"
    />
    <div v-show="list.length" ref="dom_listContent" :class="$style.content">
      <base-virtualized-list
        ref="listRef" v-slot="{ item, index }" :list="list" key-name="id"
        :item-height="listItemHeight" container-class="scroll my-list" content-class="music-list"
        @scroll="saveListPosition" @contextmenu.capture="handleListRightClick"
      >
        <common-music-list-item
          :music-info="item" :list-id="listId" :index="index" :pic-style="picStyle"
          :playing="playerInfo.isPlayList && playerInfo.playIndex === index"
          :active="selectedIndex == index || rightClickSelectedIndex == index"
          :selected="selectedList.includes(item)"
          :selectedactive="false"
          :disabled="!assertApiSupport(item.source)"
          @select="handleListItemClick($event, index)" @menu="handleListItemRightClick($event, index)" @play="handlePlayMusic(index, true)"
        />
      </base-virtualized-list>
    </div>
    <material-empty v-if="!list.length" />
    <common-list-add-modal
      v-model:show="isShowListAdd" :is-move="isMove" :from-list-id="listId"
      :music-info="selectedAddMusicInfo" :exclude-list-id="excludeListIds" teleport="#view"
    />
    <common-list-add-multiple-modal
      v-model:show="isShowListAddMultiple" :from-list-id="listId"
      :is-move="isMoveMultiple" :music-list="selectedList" :exclude-list-id="excludeListIds" teleport="#view" @confirm="removeAllSelect"
    />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" :list-id="listId" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" :list-id="listId" @confirm="removeAllSelect" />
    <search-list :list="list" :visible="isShowSearchBar" @action="handleMusicSearchAction" />
    <music-sort-modal v-model:show="isShowMusicSortModal" :music-info="selectedSortMusicInfo" :selected-num="selectedNum" @confirm="sortMusic" />
    <music-toggle-modal v-model:show="isShowMusicToggleModal" :music-info="selectedToggleMusicInfo" @toggle="toggleSource" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
    <DuplicateMusicModal v-model:visible="isShowDuplicateMusicModal" :list-info="listInfoForModal" />
    <ListSortModal v-model:visible="isShowListSortModal" :list-info="listInfoForModal" />
  </div>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import SearchList from './components/SearchList.vue'
import ListHeader from './components/ListHeader.vue'
import DuplicateMusicModal from '../MyList/components/DuplicateMusicModal.vue'
import ListSortModal from '../MyList/components/ListSortModal.vue'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getListDisplayName } from '@renderer/store/list/defaultListCustom'
import { appSetting as _appSetting, updateSetting } from '@renderer/store/setting'
import { playList } from '@renderer/core/player'
import { getRandom } from '@common/utils/common'
import MusicSortModal from './components/MusicSortModal.vue'
import MusicToggleModal from './components/MusicToggleModal.vue'
import useListInfo from './useListInfo'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useSort from './useSort'
import useMusicActions from './useMusicActions'
import useSearch from './useSearch'
import useListScroll from './useListScroll'
import useMusicToggle from './useMusicToggle'
export default {
  name: 'MusicList',
  components: {
    SearchList,
    ListHeader,
    DuplicateMusicModal,
    ListSortModal,
    MusicSortModal,
    MusicToggleModal,
  },
  props: {
    listId: {
      type: String,
      required: true,
    },
  },
  emits: ['show-menu'],
  setup(props, { emit }) {
    let scrollIndex = null
    let isAnimation = false
    const handleRestoreScroll = (_scrollIndex, _isAnimation) => {
      scrollIndex = _scrollIndex
      isAnimation = _isAnimation
      if (isAnimation) void restoreScroll(scrollIndex, isAnimation)
      // console.log('handleRestoreScroll', scrollIndex, isAnimation)
    }
    const onLoadedList = () => {
      // console.log('restoreScroll', scrollIndex, isAnimation)
      void restoreScroll(scrollIndex, isAnimation)
    }

    const {
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      list,
      playerInfo,
      setSelectedIndex,
      isShowSource,
      excludeListIds,
    } = useListInfo({ props, onLoadedList })

    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      handleSelectAllData,
      removeAllSelect,
    } = useList({ listRef, list })

    const multimode = ref(false)
    const isShowDuplicateMusicModal = ref(false)
    const isShowListSortModal = ref(false)
    // Any Listen: pic = listItemHeight * 0.8
    const picWidth = computed(() => Math.ceil(listItemHeight.value * 0.8))
    const picStyle = computed(() => ({ width: picWidth.value + 'px', height: picWidth.value + 'px' }))
    const listName = computed(() => {
      if (props.listId == defaultList.id) return getListDisplayName(defaultList)
      if (props.listId == loveList.id) return getListDisplayName(loveList)
      return userLists.find(l => l.id == props.listId)?.name ?? ''
    })
    const listInfoForModal = computed(() => ({ id: props.listId, name: listName.value }))
    watch(() => props.listId, () => {
      multimode.value = false
    })
    watch(multimode, (val) => {
      if (!val) removeAllSelect()
    })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ props, selectedList, list, removeAllSelect })

    const {
      isShowListAdd,
      isMove,
      isShowListAddMultiple,
      isMoveMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
      handleShowMusicMoveModal,
    } = useMusicAdd({ selectedList, list })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, list, props })

    const {
      isShowMusicSortModal,
      selectedNum,
      selectedSortMusicInfo,
      handleShowSortModal,
      sortMusic,
    } = useSort({ props, list, selectedList, removeAllSelect })

    const {
      handleShowMusicToggleModal,
      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    } = useMusicToggle(props, list)

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    } = useMusicActions({ props, list, removeAllSelect, selectedList })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleShowMusicToggleModal,
      handleSearch,
      handleShowMusicAddModal,
      handleShowMusicMoveModal,
      handleShowSortModal,
      handleOpenMusicDetail,
      handleCopyName,
      handleDislikeMusic,
      handleRemoveMusic,
    })

    const {
      isShowSearchBar,
      searchList,
      handleMusicSearchAction,
    } = useSearch({
      setSelectedIndex,
      handlePlayMusic,
      listRef,
    })

    const { saveListPosition, restoreScroll } = useListScroll({ props, listRef, list, handleRestoreScroll })


    const handleListItemClick = (isKey, index) => {
      if (rightClickSelectedIndex.value > -1) return
      setSelectedIndex(index)
      handleSelectData(index, multimode.value)
      if (multimode.value) return
      if (isKey) handlePlayMusic(index, true)
      else doubleClickPlay(index)
    }
    const handlePlayAll = () => {
      if (!list.value.length) return
      playList(props.listId, 0)
    }
    const handlePlayRandom = async() => {
      if (!list.value.length) return
      if (_appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
      playList(props.listId, getRandom(0, list.value.length))
    }
    const toggleMultimode = () => {
      multimode.value = !multimode.value
    }
    const toggleFind = () => {
      isShowSearchBar.value = !isShowSearchBar.value
    }
    const handleSelectAll = (all) => {
      if (all) handleSelectAllData()
      else removeAllSelect()
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, list.value[index], index)
    }
    const handleMenuClick = (action) => {
      let index = rightClickSelectedIndex.value
      rightClickSelectedIndex.value = -1
      menuClick(action, index)
    }
    const handleListRightClick = (event) => {
      if (!event.target.classList.contains('select')) return
      event.stopImmediatePropagation()
      let classList = dom_listContent.value.classList
      classList.add('copying')
      window.requestAnimationFrame(() => {
        let str = window.getSelection().toString()
        classList.remove('copying')
        str = str.split(/\n\n/).map(s => s.replace(/\n/g, '  ')).join('\n').trim()
        if (!str.length) return
        clipboardWriteText(str)
      })
    }
    const scrollToTop = () => {
      listRef.value.scrollTo(0, true)
    }

    return {
      listItemHeight,
      handleListItemClick,
      selectedList,
      handleListItemRightClick,
      removeAllSelect,
      rightClickSelectedIndex,
      selectedIndex,
      dom_listContent,
      listRef,
      excludeListIds,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isMove,
      isShowListAddMultiple,
      isMoveMultiple,
      selectedAddMusicInfo,

      isShowMusicSortModal,
      selectedNum,
      selectedSortMusicInfo,
      sortMusic,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,

      isShowSearchBar,
      searchList,
      handleMusicSearchAction,

      list,
      playerInfo,

      saveListPosition,
      isShowSource,
      multimode,
      picWidth,
      picStyle,
      listName,
      listInfoForModal,
      isShowDuplicateMusicModal,
      isShowListSortModal,
      handlePlayAll,
      handlePlayRandom,
      toggleMultimode,
      toggleFind,
      handleSelectAll,
      handlePlayMusic,
      handleRestoreScroll,


      isShowMusicToggleModal,
      selectedToggleMusicInfo,
      toggleSource,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  height: 100%;
  overflow: hidden;
}
.content {
  flex: auto;
  min-height: 0;
  margin: 0 6px;
  overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
}
</style>
