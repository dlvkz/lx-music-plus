<template>
  <!-- Layout ported from Any Listen: views/Online/{index,Search/Search,Search/Music/Music}.svelte -->
  <div :class="$style.container">
    <material-online-header active="search">
      <base-tab v-model="searchType" :list="searchTypes" min @change="handleTypeChange" />
    </material-online-header>
    <div :class="$style.main">
      <material-source-list v-if="isShowSourceSwitch && !isEntitySearch" v-model="source" :list="sources" item-label="label" @change="handleSourceChange" />
      <div :class="$style.content">
        <song-list-list v-if="searchType == 'songlist'" v-show="searchText" :page="page" :source-id="source" />
        <entity-list v-else-if="isEntitySearch" v-show="searchText" :type="searchType" />
        <music-list v-else v-show="searchText" :page="page" :source-id="source" />
        <blank-view :visible="!searchText" :source="source" />
      </div>
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import { sources as _sources } from '@renderer/store/search/music'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import BlankView from './components/BlankView.vue'
import EntityList from './EntityList/index.vue'
import { computed, ref } from '@common/utils/vueTools'
import { sourceNames } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { useNavReselect } from '@renderer/store/navReselect'

const source = ref('kw')
const searchType = ref(null)
const page = ref(1)

const verifyQueryParams = async(to, from, next) => {
  let _source = to.query.source
  let _type = to.query.type
  let _page = to.query.page

  if (_source == null || _type == null) {
    const setting = await getSearchSetting()
    _source ??= setting.source
    _type ??= setting.type
    // without the source selector the search always aggregates all sources
    if (!appSetting['common.isShowSourceSwitch']) _source = 'all'

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  if (!appSetting['common.isShowSourceSwitch'] && _source != 'all') {
    next({
      path: to.path,
      query: { ...to.query, source: 'all' },
    })
    return
  }
  source.value = _source
  searchType.value = _type

  if (_page) page.value = parseInt(_page)

  if (to.query.text != null) {
    searchText.value = to.query.text
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  components: {
    MusicList,
    SongListList,
    BlankView,
    EntityList,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()
    // the search section clicked again: the search is cleared, back to the hot searches
    useNavReselect('/search', () => {
      searchText.value = ''
    })

    const sources = _sources.map(id => {
      return {
        id,
        label: sourceNames.value[id],
      }
    })
    const handleSourceChange = (id) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          source: id,
          page: 1,
        },
      })
    }

    const searchTypes = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
        { label: window.i18n.t('search__type_artist'), id: 'artist' },
        { label: window.i18n.t('search__type_album'), id: 'album' },
      ]
    })
    const handleTypeChange = (type) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          page: 1,
        },
      })
    }


    const isShowSourceSwitch = computed(() => appSetting['common.isShowSourceSwitch'])
    // artists / albums: every source at once, no source to choose
    const isEntitySearch = computed(() => searchType.value == 'artist' || searchType.value == 'album')

    return {
      isShowSourceSwitch,
      isEntitySearch,
      sources,
      source,
      handleSourceChange,
      searchTypes,
      searchType,
      handleTypeChange,
      page,
      searchText,
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
.content {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-width: 0;
  overflow: hidden;
}
</style>
