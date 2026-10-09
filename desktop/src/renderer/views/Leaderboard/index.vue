<template>
  <!-- Ported from Any Listen: views/Online/TopSongs/{TopSongs,detail/Detail}.svelte -->
  <div :class="$style.container">
    <template v-if="!boardId">
      <material-online-header active="topSongs" />
      <div :class="$style.main">
        <!-- the charts of every platform mixed, the platforms chosen in its menu -->
        <AllBoards />
      </div>
    </template>
    <template v-else>
      <div :class="$style.header">
        <div :class="$style.left">
          <base-image :src="boardCover" icon="increase" />
        </div>
        <div :class="$style.right">
          <div>
            <h3 :class="$style.title"><common-translatable-text :text="boardName" replace /></h3>
            <div :class="$style.infoItem">
              <span><svg-icon name="music" />{{ detailInfo?.total || detailInfo?.list.length || 0 }}</span>
            </div>
          </div>
          <div :class="$style.controlBtns">
            <div :class="$style.btns">
              <base-btn :disabled="!detailInfo?.list.length" icontext @click="handlePlay(0)">
                <svg-icon name="play" />
                {{ $t('play_all') }}
              </base-btn>
              <base-btn :disabled="!detailInfo?.list.length" icontext @click="handlePlayRandom">
                <svg-icon name="list-random" />
                {{ $t('play_random') }}
              </base-btn>
              <base-btn :disabled="!detailInfo?.list.length" icontext @click="handleSave">
                <svg-icon name="favorite_folder" />
                {{ $t('save_list') }}
              </base-btn>
            </div>
            <div :class="$style.btns">
              <base-btn :disabled="!detailInfo?.list.length" :outline="!downloadState.done" icon :aria-label="$t('download')" @click="handleDownload">
                <common-download-state-icon :downloading="downloadState.downloading" :progress="downloadState.progress" :done="downloadState.done" :partial="downloadState.partial" />
              </base-btn>
              <base-btn :outline="!onlineList?.multimode" icon :aria-label="onlineList?.multimode ? $t('batch_select_exit') : $t('batch_select')" @click="onlineList.multimode = !onlineList.multimode">
                <svg-icon name="multiple" />
              </base-btn>
              <base-btn :outline="!onlineList?.isShowSearchBar" icon :aria-label="onlineList?.isShowSearchBar ? $t('find_music_exit') : $t('find_music')" @click="onlineList.isShowSearchBar = !onlineList.isShowSearchBar">
                <svg-icon name="search" />
              </base-btn>
              <base-btn outline icon :aria-label="$t('back')" @click="handleBack">
                <svg-icon name="back" />
              </base-btn>
            </div>
          </div>
        </div>
      </div>
      <MusicList ref="musicListRef" :source="source" :board-id="boardId" @show-menu="$refs.boardListRef?.hideMenu()" />
    </template>
  </div>
</template>

<script>
import { computed, ref, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { setPageBackHandler } from '@renderer/core/pageBack'
import { getBoardCovers, getBoardSongCover } from '@renderer/store/leaderboard/covers'
import { boards, sources } from '@renderer/store/leaderboard/state'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getRandom } from '@common/utils/common'
import { addSongListDetail, playSongListDetail } from './action'
import { getListDetailAll } from '@renderer/store/leaderboard/action'
import { getDownloadList } from '@renderer/store/download/action'
import { downloadMusics, downloadRest, useDownloadState } from '@renderer/store/download/sync'
import { confirmRemoveDownloads } from '@renderer/store/download/prompt'
import { getLeaderboardSetting, setLeaderboardSetting } from '@renderer/utils/data'
import AllBoards from './AllBoards.vue'
import MusicList from './MusicList/index.vue'

import { sourceNames } from '@renderer/store'
import { CHART_SOURCES, CHART_SOURCE_NAMES } from '@renderer/utils/chartSources'
import { useRoute, useRouter } from '@common/utils/vueRouter'


const source = ref('')
const boardId = ref(null)

const verifyQueryParams = async function(to, from, next) {
  let _source = to.query.source
  let _boardId = to.query.boardId

  if (_source == null) {
    const setting = await getLeaderboardSetting()
    // Any Listen: the top songs view opens on the board grid of the last used source
    _source = setting.source
    _boardId = undefined
    next({
      path: to.path,
      query: { ...to.query, source: _source, boardId: _boardId },
    })
    return
  }
  next()
  source.value = _source
  boardId.value = _boardId
  if (_boardId) void setLeaderboardSetting({ source: _source, boardId: _boardId })
}


export default {
  components: {
    AllBoards,
    MusicList,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const musicListRef = ref(null)
    const boardListRef = ref(null)
    // the charts of the main sources (NetEase first), then Spotify and SoundCloud
    const allSources = computed(() => {
      const main = ['wy', 'kw', 'tx', 'kg', 'mg'].filter(s => sources.includes(s))
      return [
        ...main.map(s => ({ id: s, name: sourceNames.value[s] })),
        ...CHART_SOURCES.map(s => ({ id: s, name: CHART_SOURCE_NAMES[s] })),
      ]
    })
    const sourceList = computed(() => {
      return sources.map(s => ({ id: s, name: sourceNames.value[s] }))
    })
    const router = useRouter()
    const route = useRoute()
    const handleToggleSource = (id) => {
      void router.replace({
        path: route.path,
        query: {
          source: id,
        },
      })
    }

    const onlineList = computed(() => musicListRef.value?.listRef ?? null)
    const detailInfo = computed(() => musicListRef.value?.listDetailInfo ?? null)
    // (a playlist / album opened from the home page is not in the charts: its name is given)
    const boardName = computed(() => boards[source.value]?.list.find(b => b.id == boardId.value)?.name ?? route.query.name ?? '')
    // official chart cover, the cover of the first song otherwise
    const boardCover = ref(null)
    watch(boardId, async(id) => {
      boardCover.value = null
      if (!id) return
      const [boardSource, bangId] = id.split('__')
      const cover = (await getBoardCovers(boardSource))[bangId] ?? await getBoardSongCover(id)
      if (id == boardId.value) boardCover.value = cover
    }, { immediate: true })
    const handlePlay = (index) => {
      const info = detailInfo.value
      if (!info?.list.length) return
      void playSongListDetail(boardId.value, info.list, index)
    }
    const handlePlayRandom = () => {
      const info = detailInfo.value
      if (!info?.list.length) return
      if (appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
      handlePlay(getRandom(0, info.list.length))
    }
    const handleSave = () => {
      void addSongListDetail(boardId.value, boardName.value, source.value)
    }
    // download button like the album / playlist pages: a ring shows how far the downloads have gone,
    // a second click asks to remove / cancel them or to download the songs that are missing
    void getDownloadList()
    const allSongs = computed(() => musicListRef.value?.allSongs ?? null)
    const downloadState = useDownloadState(() => allSongs.value ?? detailInfo.value?.list)
    const handleDownload = async() => {
      const id = boardId.value
      if (!id) return
      if (downloadState.value.taskIds.length) {
        await confirmRemoveDownloads(boardName.value, downloadState.value, async() => {
          await downloadRest(await getListDetailAll(id))
        })
        return
      }
      await downloadMusics(await getListDetailAll(id))
    }
    const handleBack = () => {
      void router.replace({
        path: route.path,
        query: {
          source: source.value,
        },
      })
    }
    // only an opened chart has somewhere to go back to
    onBeforeUnmount(setPageBackHandler(() => {
      if (!boardId.value) return false
      handleBack()
      return true
    }))

    return {
      appSetting,
      onlineList,
      detailInfo,
      boardName,
      boardCover,
      handlePlay,
      handlePlayRandom,
      handleSave,
      downloadState,
      handleDownload,
      handleBack,
      source,
      boardId,
      sourceList,
      allSources,
      handleToggleSource,
      musicListRef,
      boardListRef,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.allBoards {
  flex: auto;
  min-height: 0;
  padding-bottom: 10px;
}
.sectionTitle {
  font-size: 16px;
  color: var(--color-font);
  padding: 4px 16px 10px;
}

.container {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
}
.main {
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
  min-height: 0;
  padding-top: 10px;
}
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  padding: 10px 15px 10px 12px;
}
.left {
  flex: none;
  width: 140px;
  height: 140px;
}
.right {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  justify-content: space-between;
  min-width: 0;
  padding-top: 2px;
  padding-bottom: 5px;
  padding-left: 15px;
}
.title {
  font-size: 24px;
  line-height: 1.3;
  word-break: break-word;
}
.infoItem {
  display: flex;
  flex-flow: row wrap;
  gap: 10px;
  padding-top: 5px;
  font-size: 13px;
  color: var(--color-font-label);
  :global(svg) {
    margin-right: 5px;
  }
}
.controlBtns {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-between;
  margin-top: 15px;
}
.btns {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 10px;
}
</style>
