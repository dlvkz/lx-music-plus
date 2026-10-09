<template>
  <!-- Ported from Any Listen: views/Online/Songlist/detail/Detail.svelte + components/common/MusicList/Header.svelte -->
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.left">
        <base-image :src="picUrl || listDetailInfo.info.img" icon="music_library" />
      </div>
      <div :class="$style.right">
        <div>
          <h3 :class="$style.title" :aria-label="listDetailInfo.info.name"><common-translatable-text :text="listDetailInfo.info.name" swap /></h3>
          <div :class="$style.infoItem">
            <span><svg-icon name="music" />{{ listDetailInfo.total || listDetailInfo.list.length }}</span>
            <span v-if="listDetailInfo.info.play_count"><svg-icon name="headphones" />{{ localizeCount(listDetailInfo.info.play_count) }}</span>
          </div>
          <p v-if="listDetailInfo.info.desc" :class="$style.desc" :aria-label="listDetailInfo.info.desc"><common-translatable-text :text="listDetailInfo.info.desc" replace compact /></p>
        </div>
        <div :class="$style.controlBtns">
          <div :class="$style.btns">
            <base-btn :disabled="!!listDetailInfo.noItemLabel" icontext @click="playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list)">
              <svg-icon name="play" />
              {{ $t('play_all') }}
            </base-btn>
            <base-btn :disabled="!!listDetailInfo.noItemLabel" icontext @click="handlePlayRandom">
              <svg-icon name="list-random" />
              {{ $t('play_random') }}
            </base-btn>
            <base-btn :disabled="!!listDetailInfo.noItemLabel" icontext :outline="collected" @click="addSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.info.name, picUrl || listDetailInfo.info.img)">
              <svg-icon :name="collected ? 'check' : 'favorite_folder'" />
              {{ $t(collected ? 'saved_list' : 'save_list') }}
            </base-btn>
          </div>
          <div :class="$style.btns">
            <!-- the same download button as the album pages: a ring shows the progress -->
            <base-btn :disabled="!!listDetailInfo.noItemLabel" :outline="!downloadState.done" icon :aria-label="$t(collected ? (syncing ? 'download__sync_off' : 'download__sync_on') : 'download')" @click="handleDownload">
              <common-download-state-icon :downloading="downloadState.downloading" :progress="downloadState.progress" :done="downloadState.done" :partial="downloadState.partial" />
            </base-btn>
            <base-btn :outline="!listRef?.multimode" icon :aria-label="listRef?.multimode ? $t('batch_select_exit') : $t('batch_select')" @click="listRef.multimode = !listRef.multimode">
              <svg-icon name="multiple" />
            </base-btn>
            <base-btn :outline="!listRef?.isShowSearchBar" icon :aria-label="listRef?.isShowSearchBar ? $t('find_music_exit') : $t('find_music')" @click="listRef.isShowSearchBar = !listRef.isShowSearchBar">
              <svg-icon name="search" />
            </base-btn>
            <base-btn outline icon :aria-label="$t('back')" @click="handleBack">
              <svg-icon name="back" />
            </base-btn>
          </div>
        </div>
      </div>
    </div>
    <div :class="$style.list">
      <material-online-list
        ref="listRef"
        :mini-header="false"
        :page="listDetailInfo.page"
        :limit="listDetailInfo.limit"
        :total="listDetailInfo.total"
        :list="listDetailInfo.list"
        :no-item="listDetailInfo.noItemLabel"
        :search-list="allSongs"
        @play-list="handlePlayList"
        @toggle-page="togglePage"
        @search-visible="handleSearchVisible"
        @search-select="handleSearchSelect"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { localizeCount } from '@renderer/utils'
import { ref, computed, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { setPageBackHandler } from '@renderer/core/pageBack'
import { listDetailInfo } from '@renderer/store/songList/state'
import { setVisibleListDetail, getListDetailAll } from '@renderer/store/songList/action'
import { useRouter } from '@common/utils/vueRouter'
import { addSongListDetail, playSongListDetail, getCollectedListId } from './action'
import { userLists } from '@renderer/store/list/state'
import { isSyncList, setListSync, downloadMusics, downloadRest, useListDownloadState, useDownloadState } from '@renderer/store/download/sync'
import { confirmRemoveDownloads } from '@renderer/store/download/prompt'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getRandom } from '@common/utils/common'
import useList from './useList'
import useKeyBack from './useKeyBack'


const source = ref<LX.OnlineSource>('kw')
const id = ref<string>('')
const page = ref<number>(1)
const picUrl = ref<string>('')
const refresh = ref<boolean>(false)


interface Query {
  source?: string
  id?: string
  page?: string
  picUrl?: string
  refresh?: 'true'
  fromName?: string
}

const verifyQueryParams = async function(this: any, to: { query: Query, path: string }, from: any, next: (route?: { path: string, query: Query }) => void) {
  let _source = to.query.source
  let _id = to.query.id
  let _page: string | undefined = to.query.page
  let _picUrl: string | undefined = to.query.picUrl
  let _refresh: 'true' | undefined = to.query.refresh

  if (_source == null || _id == null) {
    if (listDetailInfo.key) {
      _source = listDetailInfo.source
      _id = listDetailInfo.id
      _page = listDetailInfo.page.toString()
      _picUrl = listDetailInfo.info.img
    } else {
      setVisibleListDetail(false)
      next({ path: '/songList/list', query: {} })
      return
    }

    next({
      path: to.path,
      query: { ...to.query, source: _source, id: _id, page: _page, picUrl: _picUrl, refresh: _refresh },
    })
    return
  }
  next()
  setVisibleListDetail(true)
  source.value = _source as LX.OnlineSource
  id.value = _id
  page.value = _page ? parseInt(_page) : 1
  picUrl.value = _picUrl ?? ''
  refresh.value = _refresh ? _refresh == 'true' : false
  if (to.query.fromName) window.lx.songListInfo.fromName = to.query.fromName
}


export default {
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const router = useRouter()

    const {
      listRef,
      listDetailInfo,
      getListData,
      handlePlayList,
      allSongs,
      handleSearchVisible,
      handleSearchSelect,
    } = useList()


    const togglePage = (page: number) => {
      void getListData(source.value, id.value, page, refresh.value)
    }

    // collected: the playlist is one of the user's lists; syncing: it is kept downloaded
    const collectedListId = computed(() => getCollectedListId(id.value, source.value))
    const collected = computed(() => userLists.some(l => l.id == collectedListId.value))
    const syncing = computed(() => collected.value && isSyncList(collectedListId.value))
    // a ring around the icon shows how far the downloads of the playlist have gone:
    // all the songs of the collected list, or the songs of the playlist
    const listDownloadState = useListDownloadState(computed(() => collected.value ? collectedListId.value : null))
    const pageDownloadState = useDownloadState(() => allSongs.value ?? listDetailInfo.list)
    const downloadState = computed(() => listDownloadState.value.taskIds.length ? listDownloadState.value : pageDownloadState.value)
    // a second click on a (partly) downloaded playlist: its downloads can be removed / cancelled,
    // or the songs that are missing downloaded
    const handleDownload = async() => {
      if (downloadState.value.taskIds.length || syncing.value) {
        const removed = await confirmRemoveDownloads(listDetailInfo.info.name ?? '', downloadState.value, async() => {
          await downloadRest(await getListDetailAll(id.value, source.value))
        })
        if (!removed) return
        // it is not kept downloaded any more either
        if (syncing.value) await setListSync(collectedListId.value, false)
        return
      }
      if (collected.value) {
        await setListSync(collectedListId.value, true)
        return
      }
      const list = await getListDetailAll(id.value, source.value)
      await downloadMusics(list)
    }

    const handleBack = () => {
      setVisibleListDetail(false)
      if (window.lx.songListInfo.fromName) void router.replace({ name: window.lx.songListInfo.fromName })
      else router.back()
    }
    onBeforeUnmount(setPageBackHandler(() => {
      handleBack()
      return true
    }))

    useKeyBack(handleBack)

    const handlePlayRandom = () => {
      const list = listDetailInfo.list
      if (!list.length) return
      if (appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
      void playSongListDetail(listDetailInfo.id, listDetailInfo.source, list, getRandom(0, list.length))
    }

    watch([source, id, page, refresh], async([_source, _id, _page, _refresh]) => {
      if (!_source || !_id) return router.replace({ path: '/songList/list' })
      // console.log(_source, _id, _page, _refresh, picUrl.value)
      // source.value = _source
      // id.value = _id
      // refresh.value = _refresh
      // page.value = _page ?? 1
      void getListData(_source, _id, _page, _refresh)
    }, {
      immediate: true,
    })

    return {
      localizeCount,
      source,
      id,
      page,
      picUrl,
      listDetailInfo,
      listRef,
      togglePage,
      addSongListDetail,
      playSongListDetail,
      handlePlayList,
      handleBack,
      handlePlayRandom,
      allSongs,
      handleSearchVisible,
      handleSearchSelect,
      collected,
      syncing,
      downloadState,
      handleDownload,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex-flow: column nowrap;
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
  min-width: 0;
  .mixin-ellipsis-1();
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
.desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-font-label);
  .mixin-ellipsis(2);
}
.controlBtns {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}
.btns {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 10px;
}
.list {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  width: 100%;
  min-height: 0;
}
</style>
