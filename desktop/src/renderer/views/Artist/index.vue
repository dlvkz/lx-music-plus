<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.left">
        <base-image :src="info?.avatar" icon="dj" />
      </div>
      <div :class="$style.right">
        <div>
          <h3 :class="$style.title"><common-translatable-text :text="info?.name || name" swap /></h3>
          <div v-if="info" :class="$style.infoItem">
            <span><svg-icon name="music" />{{ songs.total || info.count?.music || songs.list.length }}</span>
            <span><svg-icon name="albums" />{{ albums.list.length || info.count?.album }}</span>
          </div>
          <p v-if="info" :class="[$style.desc, { [$style.descClickable]: info.desc }]" @click="showDesc"><common-translatable-text v-if="info.desc" :text="info.desc" replace compact /><template v-else>{{ $t('artist__bio_empty') }}</template></p>
        </div>
        <div :class="$style.controlBtns">
          <div :class="$style.btns">
            <base-btn :disabled="!songs.list.length" icontext @click="handlePlayAll">
              <svg-icon name="play" />
              {{ $t('play_all') }}
            </base-btn>
            <base-btn :disabled="!songs.list.length" icontext @click="handlePlayRandom">
              <svg-icon name="list-random" />
              {{ $t('play_random') }}
            </base-btn>
            <base-btn :disabled="!info" icontext :outline="collected" @click="handleCollect">
              <svg-icon :name="collected ? 'check' : 'favorite_folder'" />
              {{ $t(collected ? 'saved_list' : 'save_list') }}
            </base-btn>
          </div>
          <div :class="$style.btns">
            <!-- the select / find buttons come first, so the tabs stay where they are in the albums tab -->
            <base-btn
              v-if="tab == 'songs'" :outline="!listRef?.multimode" icon
              :aria-label="listRef?.multimode ? $t('batch_select_exit') : $t('batch_select')" @click="toggleMulti"
            >
              <svg-icon name="multiple" />
            </base-btn>
            <base-btn
              v-if="tab == 'songs'" :outline="!listRef?.isShowSearchBar" icon
              :aria-label="listRef?.isShowSearchBar ? $t('find_music_exit') : $t('find_music')" @click="toggleFind"
            >
              <svg-icon name="search" />
            </base-btn>
            <base-tab v-model="tab" :list="tabs" />
            <base-btn outline icon :aria-label="$t('back')" @click="router.back()">
              <svg-icon name="back" />
            </base-btn>
          </div>
        </div>
      </div>
    </div>
    <div :class="$style.body">
      <material-online-list
        v-if="tab == 'songs'" ref="listRef" :mini-header="false" :page="songs.page" :limit="songs.limit" :total="songs.total" :list="songs.list"
        :no-item="songs.noItem" :search-list="allSongs" @play-list="handlePlayList" @toggle-page="loadSongs"
        @search-visible="handleSearchVisible" @search-select="handleSearchSelect"
      />
      <!-- the artists similar to this one (Last.fm, else Deezer) -->
      <div v-else-if="tab == 'similar'" :class="[$style.albums, 'scroll']">
        <ul>
          <li v-for="item in similar.list" :key="item.name">
            <a :class="$style.albumItem" @click="openSimilar(item)">
              <div :class="[$style.image, $style.round]"><base-image :src="item.img" icon="dj" /></div>
              <div :class="$style.albumDesc">
                <h4><common-translatable-text :text="item.name" /></h4>
              </div>
            </a>
          </li>
        </ul>
        <material-empty v-if="!similar.list.length" :label="similar.noItem" />
      </div>
      <div v-else :class="[$style.albums, 'scroll']">
        <ul>
          <li v-for="item in albums.list" :key="`${item.source}_${item.id}`">
            <a :class="$style.albumItem" @click="openAlbumPage(item)">
              <div :class="$style.image"><base-image :src="item.info.img" icon="albums" /></div>
              <div :class="$style.albumDesc">
                <h4><common-translatable-text :text="item.info.name" /></h4>
                <p v-if="item.info.time">{{ item.info.time }}</p>
                <p v-if="item.count">{{ item.count }} <svg-icon name="music" /></p>
              </div>
            </a>
          </li>
        </ul>
        <material-empty v-if="!albums.list.length" :label="albums.noItem" />
      </div>
    </div>
  </div>
</template>

<script>
import { normalizeArtistName } from '@renderer/utils/artistName'
import { findArtist, getCombinedAlbums, getCombinedSongs } from '@renderer/utils/artistCombine'
import { getArtistPicture, getSimilarArtists } from '@renderer/utils/discovery'
import { bandcampSinger, isSecondarySource, khinsiderSinger, soundcloudSinger } from '@renderer/utils/secondarySources'
// sets the requests of the secondary sources (SoundCloud)
import '@renderer/utils/secondaryAudio'
import { assertApiSupport } from '@renderer/store/utils'
import { getCache, setCache } from '@renderer/utils/dataCache'
import { ref, shallowRef, reactive, computed, watch, onMounted, nextTick, markRawList } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { toNewMusicInfo } from '@renderer/utils'
import { setTempList } from '@renderer/store/list/action'
import { setPlayingFrom } from '@renderer/store/list/playingFrom'
import { playList } from '@renderer/core/player/action'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { LIST_IDS } from '@common/constants'
import { getRandom } from '@common/utils/common'
import { dialog } from '@renderer/plugins/Dialog'
import { getCachedTranslation } from '@renderer/utils/translate'
import { isCollected, toggleCollection, updateCollectionImg } from '@renderer/store/list/collections'

const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg', 'sc', 'bc', 'kh']
// the sources the artist page is made of, their picture and bio first
// (SoundCloud: the account of the same name)
// (Bandcamp / KHInsider: only when the others do not have the artist)
const ARTIST_SOURCES = ['wy', 'kw', 'tx', 'kg', 'mg', 'sc', 'bc', 'kh']
const ARTIST_ALBUM_LIMIT = 50
const singers = { ...Object.fromEntries(ARTIST_SOURCES.map(source => [source, musicSdk[source]?.singer]).filter(([, singer]) => singer)), sc: soundcloudSinger, bc: bandcampSinger, kh: khinsiderSinger }

// Artist profile page: opened by clicking an artist name (components/common/ArtistNames.vue)

export default {
  name: 'Artist',
  setup() {
    const t = useI18n()
    const route = useRoute()
    const router = useRouter()
    const listRef = ref(null)
    // the tab is kept in the address of the page: coming back from an album shows the albums again
    const routeTab = () => route.query.tab == 'albums' || route.query.tab == 'similar' ? route.query.tab : 'songs'
    const tab = ref(routeTab())
    watch(tab, (value) => {
      if (route.path != '/artist' || routeTab() == value) return
      void router.replace({ path: route.path, query: { ...route.query, tab: value } })
    })
    const tabs = computed(() => [{ id: 'songs', label: t('artist__songs') }, { id: 'albums', label: t('artist__albums') }, { id: 'similar', label: t('artist__similar') }])
    const name = computed(() => route.query.name ?? '')
    const source = ref('')
    const info = ref(null)
    const songs = reactive({ list: [], page: 1, limit: 100, total: 0, noItem: '' })
    const albums = reactive({ list: [], noItem: '' })
    // the artist on every source that has it (the songs and albums of all of them together)
    let artist = null
    let token = 0

    // the shown profile is only replaced when the loaded one differs: no flash when it is the cached one
    const setInfo = (value) => {
      if (info.value && JSON.stringify(info.value) == JSON.stringify(value)) return
      info.value = value
    }

    // the artists similar to this one (Last.fm, else Deezer), with their pictures (Deezer)
    const similar = reactive({ list: [], noItem: '' })
    const loadSimilar = async(current, artistName) => {
      similar.list = []
      similar.noItem = t('list__loading')
      try {
        const list = (await getSimilarArtists(artistName, 24)).map(item => ({ name: item.name, img: item.img }))
        if (current != token) return
        similar.list = list
        similar.noItem = list.length ? '' : t('no_item')
        await Promise.all(list.map(async(item, index) => {
          if (item.img) return
          const img = await getArtistPicture(item.name)
          if (current == token && img) similar.list.splice(index, 1, { ...item, img })
        }))
      } catch (err) {
        console.log(err)
        if (current == token) similar.noItem = t('list__load_failed')
      }
    }
    const openSimilar = (item) => {
      void router.push({ path: '/artist', query: { name: item.name } })
    }

    const load = async() => {
      const current = ++token
      artist = null
      fullSongs = null
      allSongs.value = null
      source.value = ''
      // what the artist page showed last time (kept between the runs of the app) is shown while it loads
      const artistName = normalizeArtistName(String(name.value))
      const cacheKey = `artist:${artistName.toLowerCase()}`
      const cached = getCache(cacheKey)
      info.value = cached?.info ?? null
      // the cached songs are converted already
      songs.list = cached ? markRawList(cached.songs) : []
      songs.page = 1
      songs.total = cached?.total ?? cached?.songs.length ?? 0
      albums.list = cached?.albums ?? []
      songs.noItem = cached?.songs.length ? '' : t('list__loading')
      // the picture and the bio: NetEase first (its artist pictures are the most complete), then Kuwo, then
      // the others; a source that only has a similar looking artist is left out (the one clicked is taken
      // when no source has the exact artist)
      let found = null
      try {
        found = await findArtist(artistName, singers, ARTIST_SOURCES, route.query.source)
      } catch (err) {
        console.log(err)
      }
      if (current != token) return
      if (!found) {
        if (!cached) {
          songs.noItem = t('artist__not_found')
          albums.noItem = t('artist__not_found')
        }
        return
      }
      artist = found
      source.value = found.matches[0].source
      setInfo(found.info)
      void loadAllSongs()
      void loadSimilar(current, artistName)
      void getCombinedAlbums(found.matches, singers, ARTIST_ALBUM_LIMIT).then(list => {
        if (current != token) return
        // swapped in only when the albums changed
        if (list.length != albums.list.length || list.some((item, i) => item.id != albums.list[i].id || item.source != albums.list[i].source)) albums.list = list
        saveCache()
      }).catch(() => {
        if (!cached) albums.noItem = t('artist__not_found')
      })
    }

    // the first page of songs, the albums and the info are kept for the next time
    const saveCache = () => {
      if (!info.value || songs.page != 1 || !songs.list.length) return
      setCache(`artist:${normalizeArtistName(String(name.value)).toLowerCase()}`, { info: info.value, songs: songs.list, albums: albums.list, total: songs.total })
    }

    // every song of the artist (all the sources, the same song once: played from NetEase, then Kuwo, then the
    // others), shown by pages: the number of songs is the one after the merge
    let fullSongs = null
    const showPage = (page, keepSame = false) => {
      const list = fullSongs.slice((page - 1) * songs.limit, page * songs.limit)
      // nothing to swap in when the songs did not change (the cached ones)
      const isSame = keepSame && list.length == songs.list.length && list.every((m, i) => m.id == songs.list[i].id)
      if (!isSame) songs.list = list
      songs.page = page
      songs.noItem = songs.list.length ? '' : t('no_item')
    }

    const loadAllSongs = async() => {
      const current = token
      // the songs that are shown (the cached ones) stay until the new ones have arrived
      const isRefresh = songs.list.length > 0
      if (!isRefresh) songs.noItem = t('list__loading')
      try {
        const list = markRawList(await getCombinedSongs(artist.matches, singers, m => toNewMusicInfo(m), source => isSecondarySource(source) || assertApiSupport(source)))
        if (current != token) return
        fullSongs = list
        allSongs.value = list
        songs.total = list.length
        showPage(1, isRefresh)
        saveCache()
      } catch (err) {
        console.log(err)
        if (current == token && !isRefresh) songs.noItem = t('list__load_failed')
      }
    }

    const loadSongs = (page = 1) => {
      if (fullSongs) showPage(page)
    }

    // Song search: it covers every song of the artist, not only the page that is shown
    const allSongs = shallowRef(null)
    const handleSearchVisible = () => {}
    // a song of another page was picked in the search: its page is shown first
    const handleSearchSelect = async({ musicInfo, isPlay }) => {
      const index = fullSongs?.findIndex(m => m.id == musicInfo.id) ?? -1
      if (index < 0) return
      showPage(Math.floor(index / songs.limit) + 1, true)
      await nextTick()
      const pageIndex = songs.list.findIndex(m => m.id == musicInfo.id)
      if (pageIndex > -1) listRef.value?.showMusic(pageIndex, isPlay)
    }

    const playSongs = async(list, tempId, index = 0) => {
      if (!list.length) return
      // (the queue shows what is playing)
      setPlayingFrom(tempId, 'artist', String(name.value ?? ''), { path: '/artist', query: { name: String(name.value ?? '') } })
      await setTempList(tempId, [...list])
      playList(LIST_IDS.TEMP, index)
    }
    // every song of the artist is played, from the one picked on the page shown
    const handlePlayList = (index) => {
      const list = fullSongs ?? songs.list
      void playSongs(list, `artist_${normalizeArtistName(String(name.value)).toLowerCase()}`, fullSongs ? (songs.page - 1) * songs.limit + index : index)
    }
    // the artist stays in the library as a link to this page while collected
    const collected = computed(() => isCollected('artist', undefined, String(name.value)))
    const handleCollect = () => {
      toggleCollection({ type: 'artist', source: source.value || undefined, id: String(name.value), name: info.value?.name || name.value, img: info.value?.avatar ?? null })
    }
    watch(() => info.value, (value) => {
      if (value) updateCollectionImg('artist', undefined, String(name.value), value.avatar)
    })

    // the description is capped on the page, a click shows the whole text
    const showDesc = () => {
      if (!info.value?.desc) return
      // the translation shown on the page, when there is one
      void dialog({ message: getCachedTranslation(info.value.desc) ?? info.value.desc, selection: true, confirmButtonText: window.i18n.t('close') })
    }

    const handlePlayAll = () => {
      handlePlayList(0)
    }
    const handlePlayRandom = () => {
      if (!songs.list.length) return
      if (appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
      handlePlayList(getRandom(0, songs.list.length))
    }
    const toggleMulti = () => {
      if (listRef.value) listRef.value.multimode = !listRef.value.multimode
    }
    const toggleFind = () => {
      if (listRef.value) listRef.value.isShowSearchBar = !listRef.value.isShowSearchBar
    }

    // the album of the source it is from (the albums cached before had the source of the page)
    const openAlbumPage = (item) => {
      const albumSource = item.source ?? source.value
      if (!ONLINE_SOURCES.includes(albumSource)) return
      void router.push({
        path: '/album',
        query: {
          source: albumSource,
          id: String(item.id),
          name: item.info?.name ?? '',
        },
      })
    }

    watch(() => [route.query.name, route.query.source], ([n]) => {
      if (route.path != '/artist' || !n) return
      tab.value = routeTab()
      void load()
    }, { immediate: false })
    onMounted(load)

    return {
      collected,
      handleCollect,
      showDesc,
      allSongs,
      handleSearchVisible,
      handleSearchSelect,
      router,
      listRef,
      tab,
      tabs,
      name,
      source,
      info,
      songs,
      albums,
      similar,
      openSimilar,
      loadSongs,
      handlePlayList,
      handlePlayAll,
      handlePlayRandom,
      toggleMulti,
      toggleFind,
      openAlbumPage,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
}
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  padding: 10px 15px 0 12px;
}
.left {
  flex: none;
  width: 140px;
  height: 140px;
  :global(.pic) {
    border-radius: 50%;
  }
}
.right {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  justify-content: space-between;
  min-width: 0;
  padding-top: 2px;
  padding-left: 15px;
}
.title {
  font-size: 24px;
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
  .mixin-ellipsis(6);
}
.descClickable {
  cursor: pointer;
  &:hover {
    color: var(--color-font);
  }
}
.controlBtns {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 15px;
  // the play buttons sit a bit above the bottom, the tabs / icons stay on it
  > .btns:first-child {
    padding-bottom: 10px;
  }
}
.btns {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  gap: 10px;
}
.body {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-height: 0;
}
.albums {
  flex: auto;
  min-height: 0;
  ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 20px;
    padding: 18px 16px 16px;
  }
}
.round {
  border-radius: 50% !important;
}
.albumItem {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 0.7;
  }
}
.image {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.albumDesc {
  h4 {
    font-size: 13px;
    line-height: 1.3;
    .mixin-ellipsis-2();
  }
  p {
    font-size: 12px;
    color: var(--color-font-label);
  }
}
.albumDetail {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
}
.albumBar {
  flex: none;
  padding: 10px 15px 0;
}
</style>
