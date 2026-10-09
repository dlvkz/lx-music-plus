<template>
  <div :class="$style.library">
    <div ref="contentRef" :class="[$style.content, 'scroll']">
      <!-- A playlist / album was picked: only its songs -->
      <div v-if="filter" :class="$style.top">
        <base-btn outline icon :aria-label="$t('download__lib_back')" @click="filter = null">
          <svg-icon name="back" />
        </base-btn>
        <h2 :class="$style.pageTitle"><common-translatable-text :text="filter.title" compact replace /></h2>
      </div>
      <template v-else>
        <!-- "More" of a section: all the items of that type -->
        <div v-if="typeView" :class="$style.top">
          <base-btn outline icon :aria-label="$t('download__lib_back')" @click="typeView = null">
            <svg-icon name="back" />
          </base-btn>
          <h2 :class="$style.pageTitle">{{ $t(TYPE_TITLES[typeView]) }}</h2>
        </div>
        <div v-else :class="$style.top">
          <h2 :class="$style.pageTitle">{{ $t('download') }}</h2>
          <div :class="$style.playBtns">
            <base-btn :disabled="!completedCount" icontext @click="handlePlayAll">
              <svg-icon name="play" />
              {{ $t('play_all') }}
            </base-btn>
            <base-btn :disabled="!completedCount" icontext @click="handlePlayRandom">
              <svg-icon name="list-random" />
              {{ $t('play_random') }}
            </base-btn>
          </div>
        </div>

        <section v-if="playlistIds.length && (!typeView || typeView == 'playlists')" :class="$style.section">
          <div v-if="!typeView" :class="$style.sectionHeader">
            <h3 :class="$style.title">{{ $t('download__lib_playlists') }}</h3>
            <a v-if="playlistIds.length > shownPlaylistIds.length" :class="$style.more" role="link" @click="typeView = 'playlists'">{{ $t('home__more') }}<svg-icon name="angle-right-solid" /></a>
          </div>
          <ul :class="$style.cardGrid">
            <li v-for="id in shownPlaylistIds" :key="id">
              <LibraryListCard :list-id="id" :completed-ids="completedIds" @select="filter = $event" />
            </li>
          </ul>
        </section>

        <section v-if="albums.length && (!typeView || typeView == 'albums')" :class="$style.section">
          <div v-if="!typeView" :class="$style.sectionHeader">
            <h3 :class="$style.title">{{ $t('download__lib_albums') }}</h3>
            <a v-if="albums.length > shownAlbums.length" :class="$style.more" role="link" @click="typeView = 'albums'">{{ $t('home__more') }}<svg-icon name="angle-right-solid" /></a>
          </div>
          <ul :class="$style.cardGrid">
            <li v-for="album in shownAlbums" :key="album.key">
              <a :class="$style.card" role="link" @click="filter = { title: album.name, ids: album.ids }">
                <div :class="$style.cardPic">
                  <base-image :src="album.img" :alt="album.name" icon="albums" />
                </div>
                <h4><common-translatable-text :text="album.name" compact replace /></h4>
                <p>{{ $t('download__lib_count', { num: album.ids.size }) }}</p>
              </a>
            </li>
          </ul>
        </section>
      </template>

      <section v-if="songs.length && (filter || !typeView || typeView == 'songs')" :class="$style.section">
        <div v-if="!filter && !typeView" :class="$style.sectionHeader">
          <h3 :class="$style.title">{{ $t('download__lib_songs') }}</h3>
          <a v-if="songs.length > shownSongs.length" :class="$style.more" role="link" @click="typeView = 'songs'">{{ $t('home__more') }}<svg-icon name="angle-right-solid" /></a>
        </div>
        <ul>
          <li
            v-for="(task, index) in shownSongs" :key="task.id"
            :class="[$style.song, { [$style.playing]: playTaskId == task.id }]" @dblclick="handlePlay(task)"
          >
            <span :class="$style.songIndex">{{ index + 1 }}</span>
            <div :class="$style.songPic">
              <base-image :src="getPic(task)" icon="music" />
              <button v-if="task.isComplate" type="button" :aria-label="$t('home__play')" @click.stop="handlePlay(task)">
                <svg-icon name="play" />
              </button>
            </div>
            <div :class="$style.songInfo">
              <p :class="$style.songName"><common-translatable-text :text="task.metadata.musicInfo.name" compact /></p>
              <p :class="$style.songSinger"><common-artist-names :singer="task.metadata.musicInfo.singer" :music-info="task.metadata.musicInfo" /></p>
            </div>
            <span :class="$style.songAlbum">
              <a v-if="hasAlbumPage(task)" :class="$style.albumLink" role="link" @click.stop="openAlbum(task)" @dblclick.stop>
                <common-translatable-text :text="task.metadata.musicInfo.meta.albumName" compact />
              </a>
              <common-translatable-text v-else :text="task.metadata.musicInfo.meta.albumName ?? ''" compact />
            </span>
            <span v-if="!task.isComplate" :class="$style.songStatus">{{ getStatus(task) }}</span>
            <div :class="$style.songBtns">
              <button v-if="task.isComplate" type="button" :aria-label="$t('download__lib_open_dir')" @click.stop="handleOpenDir(task)">
                <svg-icon name="folder" />
              </button>
              <button type="button" :aria-label="$t('download__lib_remove')" @click.stop="handleRemove(task)">
                <svg-icon name="trash" />
              </button>
            </div>
          </li>
        </ul>
        <div v-if="isAllSongs && songs.length > visibleCount" :class="$style.moreBtn">
          <base-btn min @click="visibleCount += PAGE_SIZE">{{ $t('home__more') }}</base-btn>
        </div>
      </section>

      <material-empty v-if="isEmpty" :label="$t('download__lib_empty')" />
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { checkPath } from '@common/utils/nodejs'
import { useI18n } from '@renderer/plugins/i18n'
import { useRouter } from '@common/utils/vueRouter'
import { playMusicInfo, playInfo } from '@renderer/store/player/state'
import { downloadList, downloadStatus } from '@renderer/store/download/state'
import { getDownloadList, removeDownloadTasks } from '@renderer/store/download/action'
import { activeSyncListIds as syncListIds } from '@renderer/store/download/sync'
import { useNavReselect } from '@renderer/store/navReselect'
import { loveList, userLists } from '@renderer/store/list/state'
import { getListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { openDirInExplorer } from '@renderer/utils/ipc'
import { getThumbnailUrl, getListMusicPic } from '@renderer/utils/listMusicPic'
import { downloadPics, loadDownloadPic } from '@renderer/store/download/pics'
import LibraryListCard from './LibraryListCard.vue'

const PAGE_SIZE = 100

const t = useI18n()
const router = useRouter()
void getDownloadList()

// { title, ids } of the picked playlist / album
const filter = ref(null)
const visibleCount = ref(PAGE_SIZE)
watch(filter, () => {
  visibleCount.value = PAGE_SIZE
})

const completedIds = computed(() => {
  const ids = new Set()
  for (const task of downloadList) {
    if (task.isComplate) ids.add(task.metadata.musicInfo.id)
  }
  return ids
})

// the playlists: the ones kept downloaded, and the ones that are mostly downloaded
// (downloaded once from the playlist page...)
const PLAYLIST_RATIO = 0.5
const listSongIds = shallowRef(new Map())
let loadListsTimeout = null
const loadListSongs = () => {
  if (loadListsTimeout) clearTimeout(loadListsTimeout)
  loadListsTimeout = setTimeout(async() => {
    loadListsTimeout = null
    const map = new Map()
    for (const list of [loveList, ...userLists]) {
      const musics = await getListMusics(list.id)
      map.set(list.id, musics.filter(m => m.source != 'local').map(m => m.id))
    }
    listSongIds.value = map
  }, 300)
}
loadListSongs()
window.app_event.on('myListUpdate', loadListSongs)
onBeforeUnmount(() => {
  window.app_event.off('myListUpdate', loadListSongs)
  if (loadListsTimeout) clearTimeout(loadListsTimeout)
})
const playlistIds = computed(() => {
  const ids = [...syncListIds.value]
  for (const [id, songIds] of listSongIds.value) {
    if (ids.includes(id) || !songIds.length) continue
    let count = 0
    for (const songId of songIds) if (completedIds.value.has(songId)) count++
    if (count && count / songIds.length >= PLAYLIST_RATIO) ids.push(id)
  }
  return ids
})

const albumPics = ref({})
const loadingAlbumPics = new Set()
const loadAlbumPic = (key, musicInfo) => {
  if (loadingAlbumPics.has(key)) return
  loadingAlbumPics.add(key)
  getListMusicPic(musicInfo, null, url => {
    albumPics.value = { ...albumPics.value, [key]: url }
  })
}
const albums = computed(() => {
  const map = new Map()
  for (const task of downloadList) {
    const { id, singer, meta } = task.metadata.musicInfo
    if (!meta.albumName) continue
    const key = meta.albumId ? `${task.metadata.musicInfo.source}_${meta.albumId}` : `${meta.albumName}_${singer}`
    let album = map.get(key)
    if (!album) map.set(key, album = { key, name: meta.albumName, img: null, ids: new Set(), musicInfo: task.metadata.musicInfo, task })
    album.ids.add(id)
    album.img ??= meta.picUrl ? getThumbnailUrl(meta.picUrl, 300) : (downloadPics[task.id] || null)
  }
  // songs downloaded without a cover link: the cover in the file of one of them,
  // or else the one of their album found online
  for (const album of map.values()) {
    if (album.img) continue
    const filePic = downloadPics[album.task.id]
    if (filePic === undefined) {
      loadDownloadPic(album.task)
      continue
    }
    const url = albumPics.value[album.key]
    if (url) album.img = getThumbnailUrl(url, 300)
    else loadAlbumPic(album.key, album.musicInfo)
  }
  return Array.from(map.values())
})

const songs = computed(() => {
  const ids = filter.value?.ids
  return ids ? downloadList.filter(task => ids.has(task.metadata.musicInfo.id)) : downloadList
})
const visibleSongs = computed(() => songs.value.slice(0, visibleCount.value))

// The page shows a part of each type: 2 rows of playlists, 2 rows of albums, 25 songs.
// "More" opens all the items of a type.
const TYPE_TITLES = { playlists: 'download__lib_playlists', albums: 'download__lib_albums', songs: 'download__lib_songs' }
const CARD_ROWS = 2
const SONG_PREVIEW = 25
// same as .cardGrid: columns of 128px min, 14px apart
const CARD_MIN_WIDTH = 128
const CARD_GAP = 14
const typeView = ref(null)
watch(typeView, () => {
  visibleCount.value = PAGE_SIZE
  if (contentRef.value) contentRef.value.scrollTop = 0
})
const contentRef = ref(null)
// the downloads section clicked again: back to the overview, at its top
useNavReselect('/download', () => {
  filter.value = null
  typeView.value = null
  if (contentRef.value) contentRef.value.scrollTop = 0
})
const contentWidth = ref(0)
let resizeObserver = null
onMounted(() => {
  resizeObserver = new ResizeObserver(([entry]) => {
    contentWidth.value = entry.contentRect.width
  })
  resizeObserver.observe(contentRef.value)
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
const cardLimit = computed(() => {
  const columns = Math.max(1, Math.floor((contentWidth.value + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP)))
  return columns * CARD_ROWS
})
const shownPlaylistIds = computed(() => typeView.value == 'playlists' ? playlistIds.value : playlistIds.value.slice(0, cardLimit.value))
const shownAlbums = computed(() => typeView.value == 'albums' ? albums.value : albums.value.slice(0, cardLimit.value))
// all the songs (paged) once a playlist / album or the songs type is opened
const isAllSongs = computed(() => !!filter.value || typeView.value == 'songs')
const shownSongs = computed(() => isAllSongs.value ? visibleSongs.value : songs.value.slice(0, SONG_PREVIEW))
const isEmpty = computed(() => !songs.value.length && (!!filter.value || (!playlistIds.value.length && !albums.value.length)))

const playTaskId = computed(() => playMusicInfo.listId == LIST_IDS.DOWNLOAD ? downloadList[playInfo.playIndex]?.id : '')

// songs without a cover link: the cover in their file, or the one found online,
// or the cover of their album meanwhile
const albumImgs = computed(() => {
  const imgs = new Map()
  for (const album of albums.value) if (album.img) for (const id of album.ids) imgs.set(id, album.img)
  return imgs
})
const getPic = (task) => {
  const url = task.metadata.musicInfo.meta.picUrl
  if (url) return getThumbnailUrl(url, 100)
  return downloadPics[task.id] || albumImgs.value.get(task.metadata.musicInfo.id) || null
}
watch(shownSongs, list => {
  for (const task of list) {
    if (!task.metadata.musicInfo.meta.picUrl && downloadPics[task.id] === undefined) loadDownloadPic(task)
  }
}, { immediate: true })
const getStatus = (task) => {
  switch (task.status) {
    case downloadStatus.RUN: return `${task.progress}%`
    case downloadStatus.ERROR: return t('download__lib_failed')
    default: return t('download__lib_waiting')
  }
}

// downloaded songs still link to the online album page
const hasAlbumPage = (task) => {
  const { source, meta } = task.metadata.musicInfo
  return source != 'local' && !!meta.albumId && !!meta.albumName
}
const openAlbum = (task) => {
  const { source, meta } = task.metadata.musicInfo
  void router.push({ path: '/album', query: { source, id: String(meta.albumId), name: meta.albumName } })
}
// play all / shuffle: the downloaded songs (the ones still downloading are skipped by the player)
const completedCount = computed(() => downloadList.filter(task => task.isComplate).length)
const handlePlayAll = () => {
  const index = downloadList.findIndex(task => task.isComplate)
  if (index > -1) playList(LIST_IDS.DOWNLOAD, index)
}
const handlePlayRandom = () => {
  const indexes = downloadList.map((task, i) => task.isComplate ? i : -1).filter(i => i > -1)
  if (!indexes.length) return
  if (appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
  playList(LIST_IDS.DOWNLOAD, indexes[Math.floor(Math.random() * indexes.length)])
}
const handlePlay = (task) => {
  if (!task.isComplate) return
  playList(LIST_IDS.DOWNLOAD, downloadList.indexOf(task))
}
const handleOpenDir = async(task) => {
  if (!await checkPath(task.metadata.filePath)) return
  void openDirInExplorer(task.metadata.filePath)
}
const handleRemove = (task) => {
  void removeDownloadTasks([task.id], true)
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.library {
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
  gap: 10px;
  align-items: center;
  min-height: 34px;
}
.playBtns {
  display: flex;
  gap: 10px;
  margin-left: auto;
}
.pageTitle {
  min-width: 0;
  font-size: 20px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.section {
  min-width: 0;
  margin-top: 18px;
}
.title {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: bold;
  color: var(--color-font);
}

.sectionHeader {
  display: flex;
  flex-flow: row nowrap;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 10px;
  .title {
    margin-bottom: 0;
  }
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
  }
}
.cardPic {
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(.pic) {
    object-fit: cover;
    transition: transform 0.4s ease-out;
  }
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
    .songPic button, .songBtns {
      opacity: 1;
    }
  }
  &.playing {
    .songName {
      color: var(--color-primary);
    }
  }
}
.songIndex {
  flex: none;
  width: 26px;
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
.songInfo {
  flex: 1 1 45%;
  min-width: 0;
}
.songName {
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.songSinger {
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.songAlbum {
  flex: 1 1 30%;
  min-width: 0;
  font-size: 12px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.albumLink {
  color: inherit;
  cursor: pointer;
  &:hover {
    color: var(--color-primary-font-hover);
    text-decoration: underline;
  }
}
.songStatus {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
}
.songBtns {
  display: flex;
  flex: none;
  gap: 4px;
  opacity: 0;
  transition: opacity @transition-fast;
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--color-button-font);
    cursor: pointer;
    background-color: transparent;
    border: none;
    border-radius: @radius-border;
    transition: background-color @transition-fast;
    &:hover {
      background-color: var(--color-button-background-hover);
    }
  }
}
.moreBtn {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}
</style>
