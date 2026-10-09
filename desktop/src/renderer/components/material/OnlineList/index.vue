<template>
  <!-- Ported from Any Listen: components/common/MusicList/{MusicList,MiniHeader,List/index}.svelte -->
  <div :class="$style.songList">
    <common-music-list-mini-header
      v-if="miniHeader"
      :music-count="list.length" :disabled="!!noItem" :multimode="multimode" :finding="isShowSearchBar"
      @play="handlePlayAll" @playrandom="handlePlayRandom" @multi="multimode = !multimode" @find="isShowSearchBar = !isShowSearchBar"
    >
      <template #left><slot name="header-left" /></template>
    </common-music-list-mini-header>
    <common-music-list-table-header
      :multimode="multimode" :pic-width="picWidth" :select-all="list.length > 0 && selectedList.length == list.length"
      :disabled-select="!list.length" @selectall="handleSelectAll"
    />
    <div :class="$style.content">
      <div v-show="!noItem" ref="dom_listContent" :class="$style.listContent">
        <base-virtualized-list
          ref="listRef" :list="list" key-name="id" :item-height="listItemHeight" container-class="scroll" content-class="music-list"
          @contextmenu.capture="handleListRightClick"
        >
          <template #default="{ item, index }">
            <common-music-list-item
              :music-info="item" :index="index" :pic-style="picStyle"
              :active="rightClickSelectedIndex == index" :selected="selectedList.includes(item)"
              :disabled="checkApiSource && !assertApiSupport(item.source)"
              @select="handleListItemClick($event, index)" @menu="handleListItemRightClick($event, index)" @play="handlePlayMusic(index, true)"
            />
          </template>
          <template #footer>
            <div :class="$style.pagination">
              <material-pagination :count="total" :limit="limit" :page="page" @btn-click="$emit('togglePage', $event)" />
            </div>
          </template>
        </base-virtualized-list>
      </div>
      <transition name="fade">
        <material-skeleton v-if="noItem && isLoadingLabel" :row-height="listItemHeight" :pic-size="picWidth" :count="30" />
        <material-empty v-else-if="noItem" :label="noItem" />
      </transition>
    </div>
    <music-search-list :list="searchList ?? list" :visible="isShowSearchBar" @action="handleMusicSearchAction" />
    <common-list-add-modal v-model:show="isShowListAdd" :music-info="selectedAddMusicInfo" teleport="#view" />
    <common-list-add-multiple-modal v-model:show="isShowListAddMultiple" :music-list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <common-download-modal v-model:show="isShowDownload" :music-info="selectedDownloadMusicInfo" teleport="#view" />
    <common-download-multiple-modal v-model:show="isShowDownloadMultiple" :list="selectedList" teleport="#view" @confirm="removeAllSelect" />
    <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { assertApiSupport } from '@renderer/store/utils'
import { ref, computed, watch } from '@common/utils/vueTools'
import useList from './useList'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useMusicDownload from './useMusicDownload'
import useMusicAdd from './useMusicAdd'
import useMusicActions from './useMusicActions'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getRandom } from '@common/utils/common'
import MusicSearchList from '@renderer/views/List/MusicList/components/SearchList.vue'
export default {
  name: 'MaterialOnlineList',
  components: {
    MusicSearchList,
  },
  props: {
    /**
     * every song of the list when it has several pages: the song search then covers all of them
     * and not only the page that is shown (`search-select` is emitted for a song of another page)
     */
    searchList: {
      type: Array,
      default: null,
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    page: {
      type: Number,
      required: true,
    },
    limit: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    sourceTag: {
      type: Boolean,
      default: false,
    },
    noItem: {
      type: String,
      default: '',
    },
    checkApiSource: {
      type: Boolean,
      default: false,
    },
    miniHeader: {
      type: Boolean,
      default: true,
    },
    /**
     * how a song is played (the search: with its album), else it is added to the play history
     */
    playSong: {
      type: Function,
      default: null,
    },
  },
  emits: ['show-menu', 'play-list', 'togglePage', 'search-visible', 'search-select'],
  setup(props, { emit }) {
    const multimode = ref(false)
    const isShowSearchBar = ref(false)
    const rightClickSelectedIndex = ref(-1)
    const dom_listContent = ref(null)
    const listRef = ref(null)

    const {
      selectedList,
      listItemHeight,
      handleSelectData,
      handleSelectAllData,
      removeAllSelect,
    } = useList({ props, listRef })

    // Any Listen: pic = listItemHeight * 0.8
    // the loading label is shown as placeholder rows
    const isLoadingLabel = computed(() => props.noItem == window.i18n.t('list__loading'))
    const picWidth = computed(() => Math.ceil(listItemHeight.value * 0.8))
    const picStyle = computed(() => ({ width: picWidth.value + 'px', height: picWidth.value + 'px' }))
    watch(multimode, (val) => {
      if (!val) removeAllSelect()
    })
    const handleSelectAll = (all) => {
      if (all) handleSelectAllData()
      else removeAllSelect()
    }
    const handlePlayAll = () => {
      if (!props.list.length) return
      emit('play-list', 0)
    }
    const handlePlayRandom = () => {
      if (!props.list.length) return
      if (appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
      emit('play-list', getRandom(0, props.list.length))
    }
    // the list can load the songs of its other pages when the search is opened
    watch(isShowSearchBar, visible => {
      emit('search-visible', visible)
    })
    // scroll to / play a song of the shown page
    const showMusic = (index, isPlay = false) => {
      if (isPlay) void handlePlayMusic(index, true)
      else listRef.value?.scrollToIndex(index, 0, true)
    }
    const handleMusicSearchAction = ({ action, data: { index, isPlay } = {} }) => {
      isShowSearchBar.value = false
      if (action != 'listClick' || index == null || index < 0) return
      if (props.searchList) {
        // the index is the one in the whole list: the song may be on another page
        const musicInfo = props.searchList[index]
        if (!musicInfo) return
        const pageIndex = props.list.findIndex(m => m.id == musicInfo.id)
        if (pageIndex < 0) {
          emit('search-select', { musicInfo, index, isPlay: !!isPlay })
          return
        }
        index = pageIndex
      }
      if (isPlay) {
        void handlePlayMusic(index, true)
      } else {
        // the found song is shown at the top of the list
        listRef.value?.scrollToIndex(index, 0, true)
      }
    }

    const {
      handlePlayMusic,
      handlePlayMusicLater,
      doubleClickPlay,
    } = usePlay({ selectedList, props, removeAllSelect, emit })

    const {
      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
    } = useMusicAdd({ selectedList, props })

    const {
      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,
      handleShowDownloadModal,
    } = useMusicDownload({ selectedList, props })

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleDislikeMusic,
    } = useMusicActions({ props })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      props,
      assertApiSupport,
      emit,

      handleShowDownloadModal,
      handlePlayMusic,
      handlePlayMusicLater,
      handleSearch,
      handleShowMusicAddModal,
      handleOpenMusicDetail,
      handleDislikeMusic,
    })

    const handleListItemClick = (isKey, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index, multimode.value)
      if (multimode.value) return
      if (isKey) void handlePlayMusic(index, true)
      else doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, props.list[index], index)
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
      isLoadingLabel,
      listItemHeight,
      handleListItemClick,
      selectedList,
      handleListItemRightClick,
      removeAllSelect,
      rightClickSelectedIndex,
      dom_listContent,
      listRef,

      menus,
      isShowItemMenu,
      menuLocation,
      handleMenuClick,

      handleListRightClick,
      assertApiSupport,

      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,

      isShowDownload,
      isShowDownloadMultiple,
      selectedDownloadMusicInfo,

      scrollToTop,
      multimode,
      isShowSearchBar,
      picWidth,
      picStyle,
      handleSelectAll,
      handlePlayAll,
      handlePlayRandom,
      handlePlayMusic,
      handleMusicSearchAction,
      showMusic,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.songList {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  height: 100%;
  min-width: 0;
  overflow: hidden;
}
.content {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-height: 0;
}
.listContent {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-height: 0;
  margin: 0 6px;
  overflow: hidden;
}
.pagination {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}
</style>
