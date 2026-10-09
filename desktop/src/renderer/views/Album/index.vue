<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.left">
        <base-image :src="info?.img" icon="albums" />
      </div>
      <div :class="$style.right">
        <div>
          <h3 :class="$style.title"><common-translatable-text :text="info?.name || name" swap /></h3>
          <p v-if="info?.author" :class="$style.author"><common-artist-names :singer="info.author" :music-info="{ source }" inline /></p>
          <p v-if="info?.desc" :class="[$style.desc, $style.descClickable]" @click="showDesc"><common-translatable-text :text="info.desc" replace compact /></p>
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
            <base-btn :disabled="!songs.list.length" :outline="!downloadState.done" icon :aria-label="$t('download__album')" @click="handleDownload">
              <common-download-state-icon :downloading="downloadState.downloading" :progress="downloadState.progress" :done="downloadState.done" :partial="downloadState.partial" />
            </base-btn>
            <base-btn outline icon :aria-label="$t('back')" @click="router.back()">
              <svg-icon name="back" />
            </base-btn>
          </div>
        </div>
      </div>
    </div>
    <div :class="$style.body">
      <material-online-list
        ref="listRef" :mini-header="false" :page="songs.page" :limit="songs.limit" :total="songs.total" :list="songs.list"
        :no-item="songs.noItem" @play-list="handlePlayList" @toggle-page="loadSongs"
      />
    </div>
  </div>
</template>

<script>
import { getCache, setCache } from '@renderer/utils/dataCache'
import { ref, reactive, computed, watch, onMounted } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { setTempList } from '@renderer/store/list/action'
import { setPlayingFrom } from '@renderer/store/list/playingFrom'
import { playList } from '@renderer/core/player/action'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { LIST_IDS } from '@common/constants'
import { getRandom } from '@common/utils/common'
import { dialog } from '@renderer/plugins/Dialog'
import { getCachedTranslation } from '@renderer/utils/translate'
import { downloadMusics, downloadRest, useDownloadState } from '@renderer/store/download/sync'
import { confirmRemoveDownloads } from '@renderer/store/download/prompt'
import { isCollected, toggleCollection, updateCollectionImg } from '@renderer/store/list/collections'
import { getDownloadList } from '@renderer/store/download/action'
import { getSecondaryAlbum, isSecondarySource } from '@renderer/utils/secondarySources'
import { normalizeAlbum, toList } from '@renderer/utils/albumData'
// sets the requests of the secondary sources (SoundCloud)
import '@renderer/utils/secondaryAudio'

export default {
  name: 'Album',
  setup() {
    const t = useI18n()
    const route = useRoute()
    const router = useRouter()
    const listRef = ref(null)
    const source = computed(() => route.query.source ?? '')
    const id = computed(() => route.query.id ?? '')
    const name = computed(() => route.query.name ?? '')
    const info = ref(null)
    const songs = reactive({ list: [], page: 1, limit: 100, total: 0, noItem: '' })
    let token = 0

    const load = async() => {
      const current = ++token
      // what the album showed last time (kept between the runs of the app) is shown while it loads
      const cacheKey = `album:${String(source.value)}:${String(id.value)}`
      const cached = getCache(cacheKey)
      info.value = cached?.info ?? null
      songs.list = cached ? toList(cached.list) : []
      songs.total = cached?.total ?? 0
      songs.page = 1
      songs.noItem = cached?.list.length ? '' : t('list__loading')
      // an album of a secondary source (SoundCloud, Bandcamp, KHInsider)
      const isSecondary = isSecondarySource(source.value)
      if (!source.value || !id.value || (!isSecondary && !musicSdk[source.value]?.singer?.getAlbumDetail)) {
        if (!cached) songs.noItem = t('list__load_failed')
        return
      }
      try {
        let data
        if (isSecondary) {
          const album = await getSecondaryAlbum(source.value, id.value)
          data = { info: { name: album.name || name.value, img: album.img, author: album.author, desc: '' }, list: album.list, total: album.list.length }
        } else data = normalizeAlbum(source.value, id.value, await musicSdk[source.value].singer.getAlbumDetail(id.value))
        if (current != token) return
        if (data.list.length) setCache(cacheKey, { info: data.info, list: data.list, total: data.total })
        // an empty answer does not replace what is shown
        if (!data.list.length && cached?.list.length) return
        info.value = data.info
        songs.list = toList(data.list)
        songs.total = data.total
        songs.page = 1
        songs.noItem = songs.list.length ? '' : t('no_item')
      } catch (err) {
        console.log(err)
        if (current == token && !cached) songs.noItem = t('list__load_failed')
      }
    }

    const loadSongs = () => {
      // Albums are loaded in a single request; pagination stub keeps OnlineList happy.
    }

    const playSongs = async(list, tempId, index = 0) => {
      if (!list.length) return
      // (the queue shows what is playing)
      const albumName = info.value?.name || String(name.value ?? '')
      setPlayingFrom(tempId, 'album', albumName, { path: '/album', query: { source: String(source.value), id: String(id.value), name: albumName } })
      await setTempList(tempId, [...list])
      playList(LIST_IDS.TEMP, index)
    }
    const handlePlayList = (index) => {
      void playSongs(songs.list, `album_${String(source.value)}_${String(id.value)}`, index)
    }
    void getDownloadList()
    // a ring around the icon shows how far the downloads of the album have gone
    const downloadState = useDownloadState(() => songs.list)
    // a second click on a (partly) downloaded album: its downloads can be removed / cancelled,
    // or the songs that are missing downloaded
    const handleDownload = async() => {
      if (downloadState.value.taskIds.length) {
        await confirmRemoveDownloads(info.value?.name || name.value, downloadState.value, async() => downloadRest([...songs.list]))
        return
      }
      void downloadMusics([...songs.list])
    }

    // the album stays in the library as a link to this page while it is collected
    const collected = computed(() => isCollected('album', String(source.value), String(id.value)))
    const handleCollect = () => {
      toggleCollection({ type: 'album', source: String(source.value), id: String(id.value), name: info.value?.name || name.value, img: info.value?.img ?? null })
    }
    watch(() => info.value, (value) => {
      if (value) updateCollectionImg('album', String(source.value), String(id.value), value.img, value.name)
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

    watch(() => [route.query.source, route.query.id], ([s, i]) => {
      if (route.path == '/album' && s && i) void load()
    }, { immediate: false })
    onMounted(load)

    return {
      collected,
      handleCollect,
      showDesc,
      downloadState,
      handleDownload,
      router,
      listRef,
      source,
      id,
      name,
      info,
      songs,
      loadSongs,
      handlePlayList,
      handlePlayAll,
      handlePlayRandom,
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
    border-radius: 4px;
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
.author {
  padding-top: 4px;
  font-size: 13px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-font-label);
  .mixin-ellipsis(2);
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
  justify-content: space-between;
  margin-top: 15px;
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
</style>
