<template>
  <div :class="$style.home">
    <div ref="contentRef" :class="[$style.content, 'scroll']">
      <div :class="$style.top">
        <h2 :class="$style.greeting">{{ greeting }}</h2>
        <base-btn outline icon :aria-label="$t('home__refresh')" :disabled="refreshing" @click="loadAll(true)">
          <svg-icon name="refresh" />
        </base-btn>
      </div>

      <!-- Quick play: loved list + charts -->
      <div :class="$style.hero">
        <div v-if="loveCount" :class="[$style.heroCard, $style.loveCard]" role="button" tabindex="0" @click="openList(loveList.id)" @keydown.enter="openList(loveList.id)">
          <base-image v-if="loveCover" :class="$style.heroBg" :src="loveCover" />
          <div :class="$style.heroMask" />
          <div :class="$style.heroBody">
            <div>
              <h3>{{ loveName }}</h3>
              <span :class="$style.heroBadge"><svg-icon name="music" />{{ loveCount }}</span>
            </div>
            <div :class="$style.heroFooter">
              <ol :class="$style.heroSongs">
                <li v-for="(song, index) in loveSongs" :key="song.id">
                  <span>{{ index + 1 }}</span>
                  <span>{{ song.name }}</span>
                </li>
              </ol>
              <button type="button" :class="$style.heroPlay" :aria-label="$t('play_all')" :disabled="!loveCount" @click.stop="playLove">
                <svg-icon name="play" />
              </button>
            </div>
          </div>
        </div>
        <template v-if="dailyMix.length">
          <div :class="$style.heroCard" role="button" tabindex="0" @click="openMix" @keydown.enter="openMix">
            <base-image v-if="mixCover" :class="$style.heroBg" :src="mixCover" />
            <div :class="$style.heroMask" />
            <div :class="$style.heroBody">
              <div>
                <h3>{{ $t('home__daily_mix') }}</h3>
                <span :class="$style.heroBadge"><svg-icon name="music" />{{ dailyMix.length }}</span>
              </div>
              <div :class="$style.heroFooter">
                <ol :class="$style.heroSongs">
                  <li v-for="(song, index) in dailyMix.slice(0, 3)" :key="song.id">
                    <span>{{ index + 1 }}</span>
                    <span>{{ song.name }}</span>
                  </li>
                </ol>
                <button type="button" :class="$style.heroPlay" :aria-label="$t('play_all')" @click.stop="playMix(0)">
                  <svg-icon name="play" />
                </button>
              </div>
            </div>
          </div>
          <div :class="[$style.heroCard, $style.fmCard]" role="button" tabindex="0" @click="handleFm" @keydown.enter="handleFm">
            <base-image v-if="fmCover" :class="$style.heroBg" :src="fmCover" />
            <div :class="$style.heroMask" />
            <div :class="$style.heroBody">
              <div>
                <h3>{{ $t('home__fm') }}</h3>
                <span :class="$style.heroBadge">{{ $t('home__fm_desc') }}</span>
              </div>
              <div :class="$style.heroFooter">
                <ol :class="$style.heroSongs">
                  <li v-if="fmState.active && fmSong">
                    <span><svg-icon name="music" /></span>
                    <span>{{ fmSong.name }} - {{ fmSong.singer }}</span>
                  </li>
                </ol>
                <button type="button" :class="$style.heroPlay" :aria-label="$t('home__fm')" :disabled="fmState.loading" @click.stop="handleFm">
                  <svg-icon name="play" />
                </button>
              </div>
            </div>
          </div>
        </template>
        <div
          v-for="chart in heroCharts" :key="chart.id" :class="$style.heroCard" role="button" tabindex="0"
          @click="openChart(chart.id)" @keydown.enter="openChart(chart.id)"
        >
          <base-image v-if="chart.cover" :class="$style.heroBg" :src="chart.cover" />
          <div :class="$style.heroMask" />
          <div :class="$style.heroBody">
            <div>
              <h3><common-translatable-text :text="chart.name" replace /></h3>
              <span :class="$style.heroBadge"><svg-icon name="music" />{{ chart.list.length }}</span>
            </div>
            <div :class="$style.heroFooter">
              <ol :class="$style.heroSongs">
                <li v-for="(song, index) in chart.list.slice(0, 3)" :key="song.id">
                  <span>{{ index + 1 }}</span>
                  <span>{{ song.name }}</span>
                </li>
              </ol>
              <button type="button" :class="$style.heroPlay" :aria-label="$t('play_all')" :disabled="!chart.list.length" @click.stop="playChart(chart.id, 0)">
                <svg-icon name="play" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Categories / hot searches -->
      <div v-if="tags.length || hotSearch.length" :class="$style.chipRows">
        <section v-if="tags.length" :class="$style.chipSection">
          <h3 :class="$style.title">{{ $t('home__categories') }}</h3>
          <div :class="$style.chips">
            <button v-for="tag in tags" :key="tag.id" type="button" :class="$style.chip" @click="openTag(tag)">
              <common-translatable-text :text="translateTag(tag.name)" replace />
            </button>
          </div>
        </section>
        <section v-if="hotSearch.length" :class="$style.chipSection">
          <h3 :class="$style.title">{{ $t('home__hot_search') }}</h3>
          <div :class="$style.chips">
            <button v-for="text in hotSearch" :key="text" type="button" :class="$style.chip" @click="openSearch(text)">
              <common-translatable-text :text="text" replace />
            </button>
          </div>
        </section>
      </div>

      <!-- Recommended playlists -->
      <section v-else-if="loading" :class="$style.section">
        <material-skeleton type="grid" :count="12" :min-width="128" />
      </section>
      <!-- Artists for the user: similar to the ones they listen to (Last.fm / Deezer) -->
      <section v-if="forYou.list.length" :class="$style.section">
        <div :class="$style.sectionHeader">
          <h3 :class="$style.title">{{ $t('home__for_you_artists') }}</h3>
          <span :class="$style.subtitle">{{ $t('home__for_you_because', { names: forYou.seeds.slice(0, 3).join(', ') }) }}</span>
        </div>
        <ul :class="[$style.artistGrid, $style.oneRow]">
          <li v-for="item in forYou.list" :key="item.name">
            <a :class="$style.artist" role="link" @click="openArtist(item)">
              <div :class="$style.artistPic">
                <base-image :src="item.img" :alt="item.name" icon="music_heart" />
              </div>
              <span><common-translatable-text :text="item.name" swap /></span>
            </a>
          </li>
        </ul>
      </section>

      <section v-if="playlists.length" :class="$style.section">
        <div :class="$style.sectionHeader">
          <h3 :class="$style.title">{{ $t('home__playlists') }}</h3>
          <a :class="$style.more" role="link" @click="openSongList">{{ $t('home__more') }}<svg-icon name="angle-right-solid" /></a>
        </div>
        <ul :class="[$style.cardGrid, $style.twoRows]">
          <li v-for="item in playlists" :key="`${item.source}_${item.id}`">
            <a :class="$style.card" role="link" @click="openPlaylist(item)">
              <div :class="$style.cardPic">
                <base-image :src="getPic(item.img, 300)" :alt="item.name" icon="playlist" />
                <span v-if="item.play_count" :class="$style.cardCount"><svg-icon name="headphones" />{{ localizeCount(item.play_count) }}</span>
                <button type="button" :class="$style.cardPlay" :aria-label="$t('play_all')" @click.stop="playPlaylist(item)">
                  <svg-icon name="play" />
                </button>
              </div>
              <h4><common-translatable-text :text="item.name" compact replace /></h4>
              <p>{{ item.sourceName }}</p>
            </a>
          </li>
        </ul>
      </section>

      <!-- Hot songs / new songs -->
      <div v-if="hotSongs.length || newSongs.length" :class="$style.songColumns">
        <section v-for="col in songColumns" :key="col.id" :class="$style.section">
          <div :class="$style.sectionHeader">
            <h3 :class="$style.title">{{ col.title }}</h3>
            <a :class="$style.more" role="link" @click="openChart(col.id)">{{ $t('home__more') }}<svg-icon name="angle-right-solid" /></a>
          </div>
          <ul :class="$style.songList">
            <li v-for="(song, index) in col.list" :key="song.id" :class="$style.song" @dblclick="playChart(col.id, index)">
              <span :class="$style.songIndex">{{ index + 1 }}</span>
              <div :class="$style.songPic">
                <base-image :src="getPic(song.meta.picUrl, 100)" icon="music" />
                <button type="button" :aria-label="$t('home__play')" @click.stop="playChart(col.id, index)">
                  <svg-icon name="play" />
                </button>
              </div>
              <p :class="$style.songName"><common-translatable-text :text="song.name" /></p>
              <p :class="$style.songSinger"><common-artist-names :singer="song.singer" :music-info="song" /></p>
              <span :class="$style.songTime">{{ song.interval }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- Hot artists -->
      <section v-else-if="loading" :class="$style.section">
        <material-skeleton type="rows" :count="5" />
      </section>
      <section v-if="artists.length" :class="$style.section">
        <div :class="$style.sectionHeader">
          <h3 :class="$style.title">{{ $t('home__artists') }}</h3>
        </div>
        <ul :class="[$style.artistGrid, $style.twoRows]">
          <li v-for="item in artists" :key="`${item.source}_${item.name}`">
            <a :class="$style.artist" role="link" @click="openArtist(item)">
              <div :class="$style.artistPic">
                <base-image :src="getPic(item.img, 200)" :alt="item.name" icon="music_heart" />
              </div>
              <span><common-translatable-text :text="item.name" swap /></span>
            </a>
          </li>
        </ul>
      </section>

      <!-- New albums -->
      <section v-else-if="loading" :class="$style.section">
        <material-skeleton type="grid" :count="12" :min-width="128" />
      </section>
      <section v-if="albums.length" :class="$style.section">
        <div :class="$style.sectionHeader">
          <h3 :class="$style.title">{{ $t('home__albums') }}</h3>
        </div>
        <ul :class="[$style.cardGrid, $style.twoRows]">
          <li v-for="item in albums" :key="`${item.source}_${item.id}`">
            <a :class="$style.card" role="link" @click="openAlbum(item)">
              <div :class="$style.cardPic">
                <base-image :src="getPic(item.img, 300)" :alt="item.name" icon="albums" />
              </div>
              <h4><common-translatable-text :text="item.name" compact replace /></h4>
              <p><common-translatable-text :text="item.artist" compact /> · {{ item.sourceName }}</p>
            </a>
          </li>
        </ul>
      </section>

      <material-empty v-if="isEmpty" :label="loading ? $t('list__loading') : $t('list__load_failed')" />
    </div>
  </div>
</template>

<script setup>
import { useNavReselect } from '@renderer/store/navReselect'

import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import { LIST_IDS } from '@common/constants'
import { loveList } from '@renderer/store/list/state'
import { getListMusics } from '@renderer/store/list/action'
import { setVisibleListDetail } from '@renderer/store/songList/action'
import { getListDisplayName } from '@renderer/store/list/defaultListCustom'
import { playList } from '@renderer/core/player'
import useListMeta from '@renderer/utils/compositions/useListMeta'
import { translateTagName } from '@renderer/utils/tagTranslate'
import { playSongListDetail as playChartDetail } from '@renderer/views/Leaderboard/action'
import { getListDetailAll as getBoardDetailAll } from '@renderer/store/leaderboard/action'
import { playMusicInfo } from '@renderer/store/player/state'
import { getDailyMix, playDailyMix, startFm, fmState } from '@renderer/core/recommend'
import { getThumbnailUrl, getListMusicPic } from '@renderer/utils/listMusicPic'
import { localizeCount } from '@renderer/utils'
import { playSongListDetail as playPlaylistDetail } from '@renderer/views/songList/Detail/action'
import {

  HOME_SOURCE, getCharts,
  getCached, getPlaylists, getArtists, getAlbums, getArtistsForYou, getChartSongs, getHotTags, getHotSearch, getPic, shuffle,
} from './data'

const SONG_COUNT = 8

// the home section clicked again: to the top
const contentRef = ref(null)
useNavReselect('/home', () => {
  contentRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
})

const router = useRouter()
const t = useI18n()

const loading = ref(true)
const refreshing = ref(false)
const playlists = shallowRef(getCached('playlists_mixed') ?? [])
const artists = shallowRef(getCached('artists_mixed') ?? [])
const albums = shallowRef(getCached('albums_mixed') ?? [])
const forYou = shallowRef(getCached('for_you') ?? { seeds: [], list: [] })
// a random pick each time the page is opened, more than fit: the rows that don't fit are cut off
const CHIP_COUNT = 40
const pickChips = (list) => shuffle(list ?? []).slice(0, CHIP_COUNT)
const tags = shallowRef(pickChips(getCached('tags')))
const hotSearch = shallowRef(pickChips(getCached('hotSearch')))
const chartList = computed(getCharts)
const chartSongs = shallowRef(Object.fromEntries(chartList.value.map(c => [c.id, getCached('chart_' + c.id) ?? []])))
const getChartList = (id) => chartSongs.value[id] ?? []

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 5) return t('home__greeting_night')
  if (hour < 12) return t('home__greeting_morning')
  if (hour < 18) return t('home__greeting_afternoon')
  return t('home__greeting_evening')
})

// loved list
const { count: loveCount, cover: loveListCover } = useListMeta(ref(loveList.id))
const loveName = computed(() => getListDisplayName(loveList))
const loveSongs = shallowRef([])
const loveCover = computed(() => loveListCover.value ?? getPic(loveSongs.value[0]?.meta.picUrl, 300))
const loadLoveSongs = () => {
  void getListMusics(loveList.id).then(list => {
    loveSongs.value = list.slice(0, 3)
  })
}
const handleMyListUpdate = (ids) => {
  if (ids.includes(loveList.id)) loadLoveSongs()
}
const playLove = async() => {
  if (!(await getListMusics(loveList.id)).length) return
  playList(LIST_IDS.LOVE, 0)
}

// local recommendations
const dailyMix = shallowRef([])
const mixLoading = ref(false)
const getSongCover = (song) => song?.meta.picUrl ? getThumbnailUrl(song.meta.picUrl, 300) : null
const mixCovers = computed(() => dailyMix.value.filter(song => song.meta.picUrl).slice(0, 2).map(getSongCover))
const mixCover = computed(() => mixCovers.value[0] ?? null)
// some sources list songs without a cover
const loadMixCovers = (list) => {
  for (const song of list) {
    if (song.meta.picUrl) continue
    getListMusicPic(song, null, url => {
      song.meta.picUrl = url
      if (dailyMix.value == list) dailyMix.value = list = [...list]
    })
  }
}
const loadMix = (isRefresh = false) => {
  if (mixLoading.value) return
  mixLoading.value = true
  void getDailyMix(isRefresh).then(list => {
    if (!list.length) return
    dailyMix.value = list
    loadMixCovers(list)
  }).catch(err => {
    console.log(err)
  }).finally(() => {
    mixLoading.value = false
  })
}
const playMix = (index) => {
  void playDailyMix(dailyMix.value, index)
}
const fmSong = computed(() => {
  const info = playMusicInfo.musicInfo
  return info ? 'progress' in info ? info.metadata.musicInfo : info : null
})
const fmCover = computed(() => fmState.active ? getSongCover(fmSong.value) : mixCovers.value[1] ?? null)
const handleFm = () => {
  if (fmState.active || fmState.loading) return
  void startFm()
}

// charts
const charts = computed(() => chartList.value.map(chart => {
  const list = getChartList(chart.id)
  return {
    ...chart,
    list,
    cover: getPic(list[0]?.meta.picUrl, 300),
  }
}))
// the recommendation cards take the place of two chart cards
const heroCharts = computed(() => dailyMix.value.length ? charts.value.slice(0, 1) : charts.value)
const hotSongs = computed(() => getChartList(chartList.value[0].id).slice(0, SONG_COUNT))
const newSongs = computed(() => getChartList(chartList.value[1].id).slice(0, SONG_COUNT))
const songColumns = computed(() => [
  { id: chartList.value[0].id, title: t('home__hot_songs'), list: hotSongs.value },
  { id: chartList.value[1].id, title: t('home__new_songs'), list: newSongs.value },
].filter(col => col.list.length))

const isEmpty = computed(() => {
  return !playlists.value.length && !artists.value.length && !albums.value.length && !hotSongs.value.length && !newSongs.value.length
})

const translateTag = (name) => translateTagName(name)

// every section loads on its own, a failed one is just left out
const loadAll = async(isRefresh = false) => {
  if (isRefresh) refreshing.value = true
  const run = async(loader, apply) => loader(isRefresh).then(apply).catch(err => {
    console.log(err)
  })
  await Promise.all([
    run(getPlaylists, data => { playlists.value = data }),
    run(getArtists, data => { artists.value = data }),
    run(getAlbums, data => { albums.value = data }),
    run(getArtistsForYou, data => { forYou.value = data }),
    run(getHotTags, data => { if (isRefresh || !tags.value.length) tags.value = pickChips(data) }),
    run(getHotSearch, data => { if (isRefresh || !hotSearch.value.length) hotSearch.value = pickChips(data) }),
    ...chartList.value.map(async chart => run(async refresh => getChartSongs(chart.id, refresh), data => {
      chartSongs.value = { ...chartSongs.value, [chart.id]: data }
      loadChartCovers(chart.id, data)
    })),
  ])
  loading.value = false
  refreshing.value = false
}

// the songs shown without a cover (the songs of Spotify / Deezer found on the main sources): their covers
const loadChartCovers = (id, list) => {
  for (const song of list.slice(0, SONG_COUNT)) {
    if (song.meta.picUrl) continue
    getListMusicPic(song, null, url => {
      if (!url || chartSongs.value[id] != list) return
      song.meta.picUrl = url
      chartSongs.value = { ...chartSongs.value, [id]: [...list] }
      list = chartSongs.value[id]
    })
  }
}

const playChart = (id, index) => {
  void playChartDetail(id, getChartList(id), index)
}
const playPlaylist = (item) => {
  if (item.open == 'chart') {
    void getBoardDetailAll(item.id).then(async list => playChartDetail(item.id, list, 0))
    return
  }
  void playPlaylistDetail(item.id, item.source)
}

const openMix = () => {
  void router.push({ path: '/dailyMix' })
}
const openList = (id) => {
  void router.push({ path: '/list', query: { id } })
}
const openChart = (id) => {
  // (the name: the charts of Spotify / Deezer may not be loaded on the charts page yet)
  const name = chartList.value.find(chart => chart.id == id)?.name
  void router.push({ path: '/leaderboard', query: { source: id.split('__')[0], boardId: id, name } })
}
// the playlist page reopens the last viewed playlist unless it is marked as closed
const openSongList = () => {
  setVisibleListDetail(false)
  void router.push({ path: '/songList/list', query: { source: HOME_SOURCE } })
}
const openTag = (tag) => {
  setVisibleListDetail(false)
  void router.push({ path: '/songList/list', query: { source: tag.source, tagId: tag.id } })
}
const openSearch = (text) => {
  void router.push({ path: '/search', query: { text } })
}
// a playlist of Spotify / Deezer is a chart (its songs found on the main sources)
const openBoard = (item) => {
  void router.push({ path: '/leaderboard', query: { source: item.source, boardId: item.id, name: item.name } })
}
const openPlaylist = (item) => {
  if (item.open == 'chart') {
    openBoard(item)
    return
  }
  void router.push({
    path: '/songList/detail',
    query: {
      source: item.source,
      id: item.id,
      picUrl: item.img,
      fromName: 'Home',
    },
  })
}
const openArtist = (item) => {
  void router.push({ path: '/artist', query: { name: item.name, source: item.source } })
}
const openAlbum = (item) => {
  if (item.open == 'chart') {
    openBoard(item)
    return
  }
  void router.push({ path: '/album', query: { source: item.source, id: item.id, name: item.name } })
}

// the music api is initialized after the page: the charts may switch source then
watch(chartList, () => {
  void loadAll()
})

onMounted(() => {
  loadLoveSongs()
  loadMix()
  void loadAll()
})
window.app_event.on('myListUpdate', handleMyListUpdate)
onBeforeUnmount(() => {
  window.app_event.off('myListUpdate', handleMyListUpdate)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.home {
  position: relative;
  height: 100%;
  overflow: hidden;
}
.content {
  height: 100%;
  padding: 4px 16px 24px 12px;
}

.top {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.greeting {
  font-size: 22px;
  color: var(--color-font);
}

// hero cards
.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  // one row: the cards that do not fit are hidden (not a half empty second row)
  grid-template-rows: auto;
  grid-auto-rows: 0;
  row-gap: 0;
  overflow: hidden;
}
.heroCard {
  position: relative;
  height: 150px;
  overflow: hidden;
  color: #fff;
  cursor: pointer;
  background-color: var(--color-primary-dark-300);
  border-radius: 8px;
  box-shadow: 0 0 3px 0 rgb(0 0 0 / 20%);
  transition: box-shadow @transition-normal;
  &:hover {
    box-shadow: 0 2px 10px 0 rgb(0 0 0 / 30%);
    .heroBg {
      transform: scale(1.05);
    }
  }
}
.loveCard {
  background-color: var(--color-primary);
}
.fmCard {
  .heroBadge {
    max-width: 100%;
  }
  .heroSongs :global(svg) {
    width: 11px;
    height: 11px;
  }
}
.heroBg {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
  transition: transform 0.6s ease-out;
}
.heroMask {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgb(0 0 0 / 65%), rgb(0 0 0 / 35%) 60%, rgb(0 0 0 / 20%));
}
.heroBody {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  justify-content: space-between;
  height: 100%;
  padding: 12px 14px;
  h3 {
    font-size: 18px;
    font-weight: bold;
    line-height: 1.3;
    .mixin-ellipsis-1();
  }
}
.heroBadge {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  padding: 1px 6px;
  margin-top: 4px;
  font-size: 11px;
  color: rgb(255 255 255 / 80%);
  background-color: rgb(255 255 255 / 15%);
  border-radius: 4px;
}
.heroFooter {
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
  align-items: flex-end;
  justify-content: space-between;
}
.heroSongs {
  flex: auto;
  min-width: 0;
  font-size: 12px;
  line-height: 1.5;
  li {
    display: flex;
    gap: 6px;
    color: rgb(255 255 255 / 90%);
    span:first-child {
      flex: none;
      color: rgb(255 255 255 / 45%);
    }
    span:last-child {
      .mixin-ellipsis-1();
    }
  }
}
.heroPlay {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: #222;
  cursor: pointer;
  background-color: rgb(255 255 255 / 90%);
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 6px 0 rgb(0 0 0 / 30%);
  transition: transform @transition-fast, background-color @transition-fast;
  &:hover {
    background-color: #fff;
    transform: scale(1.1);
  }
  &:disabled {
    cursor: default;
    opacity: 0.5;
    transform: none;
  }
  :global(svg) {
    width: 16px;
    height: 16px;
  }
}

// sections
.section {
  min-width: 0;
  margin-top: 22px;
}
.sectionHeader {
  display: flex;
  flex-flow: row nowrap;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
}
.subtitle {
  flex: auto;
  min-width: 0;
  margin-left: 10px;
  font-size: 12px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.title {
  font-size: 16px;
  font-weight: bold;
  color: var(--color-font);
}
.more {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  font-size: 12px;
  color: var(--color-font-label);
  cursor: pointer;
  transition: color @transition-fast;
  &:hover {
    color: var(--color-primary-font-hover);
  }
  :global(svg) {
    width: 10px;
    height: 10px;
  }
}

// categories / hot searches
.chipRows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 0 24px;
}
.chipSection {
  min-width: 0;
  margin-top: 22px;
  .title {
    margin-bottom: 10px;
  }
}
// three full rows: the chips stretch to fill each row, the rows that don't fit are hidden
@chip-height: 26px;
@chip-gap: 8px;
.chips {
  display: flex;
  flex-flow: row wrap;
  gap: @chip-gap;
  max-height: @chip-height * 3 + @chip-gap * 2;
  overflow: hidden;
}
.chip {
  flex: 1 0 auto;
  max-width: 100%;
  height: @chip-height;
  padding: 0 12px;
  overflow: hidden;
  font-size: 12px;
  line-height: @chip-height;
  text-align: center;
  white-space: nowrap;
  color: var(--color-button-font);
  cursor: pointer;
  background-color: var(--color-button-background);
  border: none;
  border-radius: 14px;
  transition: background-color @transition-fast;
  &:hover {
    background-color: var(--color-button-background-hover);
  }
  &:active {
    background-color: var(--color-button-background-active);
  }
}

// playlist / album cards
.cardGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 16px 14px;
}
.card {
  display: block;
  min-width: 0;
  cursor: pointer;
  h4 {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.3;
    color: var(--color-font);
    .mixin-ellipsis-2();
  }
  p {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.3;
    color: var(--color-font-label);
    .mixin-ellipsis-1();
  }
  &:hover {
    .cardPic :global(.pic) {
      transform: scale(1.05);
    }
    .cardPlay {
      opacity: 1;
      transform: none;
    }
  }
}
.cardPic {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(.pic) {
    object-fit: cover;
    transition: transform 0.4s ease-out;
  }
}
.cardCount {
  position: absolute;
  top: 5px;
  right: 5px;
  display: inline-flex;
  gap: 3px;
  align-items: center;
  padding: 1px 6px;
  font-size: 11px;
  color: #fff;
  background-color: rgb(0 0 0 / 45%);
  border-radius: 9px;
}
.cardPlay {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #222;
  cursor: pointer;
  background-color: rgb(255 255 255 / 90%);
  border: none;
  border-radius: 50%;
  box-shadow: 0 2px 6px 0 rgb(0 0 0 / 30%);
  opacity: 0;
  transition: opacity @transition-fast, transform @transition-fast;
  transform: translateY(6px);
  :global(svg) {
    width: 14px;
    height: 14px;
  }
}

// songs
.songColumns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 0 24px;
}
.song {
  display: flex;
  flex-flow: row nowrap;
  gap: 10px;
  align-items: center;
  padding: 5px 8px;
  border-radius: @radius-border;
  transition: background-color @transition-fast;
  &:hover {
    background-color: var(--color-primary-background-hover);
    .songPic button {
      opacity: 1;
    }
  }
}
.songIndex {
  flex: none;
  width: 18px;
  font-size: 12px;
  color: var(--color-font-label);
  text-align: center;
}
.songPic {
  position: relative;
  flex: none;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 4px;
  button {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    background-color: rgb(0 0 0 / 40%);
    border: none;
    opacity: 0;
    transition: opacity @transition-fast;
    :global(svg) {
      width: 14px;
      height: 14px;
    }
  }
}
// name and artist side by side like the rows of the song lists, translations under the originals
.songName {
  flex: 1 1 55%;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-font);
  .mixin-ellipsis-1();
  // original name with its translation under it, like the rows of the song lists
  > span {
    max-width: 100%;
    > span {
      .mixin-ellipsis-1();
    }
  }
}
.songSinger {
  flex: 1 1 35%;
  min-width: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.songTime {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
}

// artists
.artistGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 14px 10px;
}
// two full rows (as many columns as the width fits), the items that do not fit are hidden: the rows are never
// left half empty
.twoRows {
  grid-template-rows: auto auto;
  grid-auto-rows: 0;
  row-gap: 0;
  overflow: hidden;
  > li {
    padding-bottom: 16px;
  }
  margin-bottom: -16px;
}
// a single row: the artists that do not fit are hidden
.oneRow {
  grid-template-rows: auto;
  grid-auto-rows: 0;
  row-gap: 0;
  overflow: hidden;
}
.artist {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  color: var(--color-font);
  text-align: center;
  cursor: pointer;
  span {
    max-width: 100%;
    .mixin-ellipsis-1();
  }
  &:hover {
    .artistPic :global(.pic) {
      transform: scale(1.06);
    }
  }
}
.artistPic {
  width: 76px;
  height: 76px;
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(.pic) {
    object-fit: cover;
    transition: transform 0.4s ease-out;
  }
}
</style>
