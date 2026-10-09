<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <div :class="$style.left">
        <base-image :src="cover" icon="music_heart" />
      </div>
      <div :class="$style.right">
        <div>
          <h3 :class="$style.title">{{ $t('home__daily_mix') }}</h3>
          <p :class="$style.author">{{ $t('home__daily_mix_desc') }}</p>
        </div>
        <div :class="$style.controlBtns">
          <div :class="$style.btns">
            <base-btn :disabled="!list.length" icontext @click="handlePlayList(0)">
              <svg-icon name="play" />
              {{ $t('play_all') }}
            </base-btn>
            <base-btn :disabled="!list.length" icontext @click="handlePlayRandom">
              <svg-icon name="list-random" />
              {{ $t('play_random') }}
            </base-btn>
          </div>
          <div :class="$style.btns">
            <base-btn :disabled="loading" outline icon :aria-label="$t('home__mix_change')" @click="load(true)">
              <svg-icon name="refresh" />
            </base-btn>
            <base-btn :disabled="!list.length" :outline="!downloadState.done" icon :aria-label="$t('list__download')" @click="handleDownload">
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
        :mini-header="false" :page="1" :limit="limit" :total="list.length" :list="list"
        :no-item="noItem" @play-list="handlePlayList"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getRandom } from '@common/utils/common'
import { getDailyMix, playDailyMix } from '@renderer/core/recommend'
import { downloadMusics, downloadRest, useDownloadState } from '@renderer/store/download/sync'
import { confirmRemoveDownloads } from '@renderer/store/download/prompt'
import { getDownloadList } from '@renderer/store/download/action'
import { getThumbnailUrl } from '@renderer/utils/listMusicPic'

// The daily mix (core/recommend.ts) shown as a playlist, opened from the home page
const t = useI18n()
const router = useRouter()

const list = shallowRef([])
const loading = ref(false)
const limit = computed(() => Math.max(list.value.length, 30))
const noItem = computed(() => list.value.length ? '' : t(loading.value ? 'list__loading' : 'no_item'))
const cover = computed(() => {
  for (const song of list.value) {
    if (song.meta.picUrl) return getThumbnailUrl(song.meta.picUrl, 300)
  }
  return null
})

const load = (isRefresh = false) => {
  if (loading.value) return
  loading.value = true
  void getDailyMix(isRefresh).then(songs => {
    if (songs.length) list.value = songs
  }).catch(err => {
    console.log(err)
  }).finally(() => {
    loading.value = false
  })
}

const handlePlayList = (index) => {
  void playDailyMix(list.value, index)
}
const handlePlayRandom = () => {
  if (!list.value.length) return
  if (appSetting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
  handlePlayList(getRandom(0, list.value.length))
}

void getDownloadList()
// a ring shows how far the downloads have gone, a second click asks to remove / cancel them
// or to download the songs that are missing
const downloadState = useDownloadState(() => list.value)
const handleDownload = async() => {
  if (downloadState.value.taskIds.length) {
    await confirmRemoveDownloads(t('home__daily_mix'), downloadState.value, async() => downloadRest([...list.value]))
    return
  }
  await downloadMusics([...list.value])
}

onMounted(load)
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
  .mixin-ellipsis(3);
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
