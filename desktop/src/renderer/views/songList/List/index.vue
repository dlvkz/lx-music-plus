<template>
  <!-- Layout ported from Any Listen: views/Online/Songlist/Songlist.svelte + list/header/Header.svelte -->
  <div :class="$style.container">
    <material-online-header active="songlist">
      <base-btn min link :class="$style.openBtn" @click="visibleOpenSongListModal = true">{{ $t('songlist__import_input_show_btn') }}</base-btn>
      <tag-list :source="source" :tag-id="tagId" :sort-id="sortId" />
      <sort-tab :source="source" :tag-id="tagId" :sort-id="sortId" />
      <base-btn min outline icon :aria-label="$t('songlist__view_toggle')" @click="toggleCompactView">
        <svg-icon :name="isCompactView ? 'playlist' : 'albums'" />
      </base-btn>
    </material-online-header>
    <div :class="$style.main">
      <material-source-list v-if="appSetting['common.isShowSourceSwitch']" :model-value="source" :list="sourceList" @change="handleToggleSource" />
      <list-view :source="source" :tag-id="tagId" :sort-id="sortId" :page="page" />
    </div>
    <open-list-modal v-model="visibleOpenSongListModal" :source-list="sourceList" />
  </div>
</template>

<script lang="ts">
import { computed, ref } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { isCompactView, toggleCompactView } from '@renderer/views/songList/viewMode'
import { getSongListSetting, setSongListSetting } from '@renderer/utils/data'
import TagList from './components/TagList.vue'
import SortTab from './components/SortTab.vue'
import OpenListModal from './components/OpenListModal.vue'
import ListView from './ListView.vue'
import { sources, listInfo, isVisibleListDetail } from '@renderer/store/songList/state'
import { sourceNames } from '@renderer/store'
import { useRoute, useRouter } from '@common/utils/vueRouter'

const source = ref<LX.OnlineSource>('kw')
const tagId = ref<string>('')
const sortId = ref<string>('')
const page = ref<number>(1)


interface Query {
  source?: string
  tagId?: string
  sortId?: string
  page?: string
}

const verifyQueryParams = async function(this: any, to: { query: Query, path: string }, from: any, next: (route?: { path: string, query: Query }) => void) {
  let _source = to.query.source
  let _tagId = to.query.tagId
  let _sortId = to.query.sortId
  let _page: string | undefined = to.query.page

  if (isVisibleListDetail.value) {
    next({ path: '/songList/detail', query: {} })
    return
  } else if (_source == null) {
    if (listInfo.key) {
      _source = listInfo.source
      _tagId = listInfo.tagId
      _sortId = listInfo.sortId
      _page = listInfo.page.toString()
    } else {
      const setting = await getSongListSetting()
      _source = setting.source
      _tagId = setting.tagId
      _sortId = setting.sortId
      _page = '1'
    }

    next({
      path: to.path,
      query: { ...to.query, source: _source, tagId: _tagId, sortId: _sortId, page: _page },
    })
    return
  }
  next()
  source.value = _source as LX.OnlineSource
  tagId.value = _tagId ?? ''
  sortId.value = _sortId ?? ''
  page.value = _page ? parseInt(_page) : 1
  void setSongListSetting({ source: _source, tagId: _tagId, sortId: _sortId })
}


export default {
  components: {
    TagList,
    SortTab,
    ListView,
    OpenListModal,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const visibleOpenSongListModal = ref(false)

    const sourceList = computed(() => {
      return sources.map(s => ({ id: s, name: sourceNames.value[s] }))
    })
    const router = useRouter()
    const route = useRoute()
    const handleToggleSource = (id: LX.OnlineSource) => {
      if (id == source.value) return
      void router.replace({
        path: route.path,
        query: {
          source: id,
          tagId: '',
        },
      })
    }

    return {
      appSetting,
      isCompactView,
      toggleCompactView,
      source,
      tagId,
      sortId,
      page,
      sourceList,
      handleToggleSource,
      visibleOpenSongListModal,
    }
  },
}
</script>

<style lang="less" module>
.container {
  display: flex;
  flex-flow: column nowrap;
}
.main {
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
  min-height: 0;
  padding-top: 10px;
}
.openBtn {
  --btn-font: var(--color-font);
}
</style>
