<template>
  <div :class="['scroll', 'description', $style.info, { [$style.scrolling]: scrolling }]" @scroll="handleScroll">
    <p><span>{{ $t('play_detail__music_name') }}</span><common-translatable-text :text="musicInfo.name" /></p>
    <p><span>{{ $t('play_detail__music_singer') }}</span><common-artist-names :singer="musicInfo.singer" :music-info="playInfoMusic" inline @navigate="closeDetail" /></p>
    <p v-if="musicInfo.album">
      <span>{{ $t('play_detail__music_album') }}</span>
      <common-translatable-text
        v-if="albumInfo" :text="musicInfo.album" :class="$style.album"
        @click.stop="openAlbum"
      />
      <common-translatable-text v-else :text="musicInfo.album" />
    </p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { musicInfo, playMusicInfo, isShowPlayerDetail } from '@renderer/store/player/state'
import { isSecondarySource } from '@renderer/utils/secondarySources'
import { openSecondarySongAlbum } from '@renderer/utils/songLinks'

const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg']
const router = useRouter()

// Ported from Any Listen: components/layout/PlayDetail/LeftInfo/Info.svelte
const playInfoMusic = computed(() => {
  const info = playMusicInfo.musicInfo
  if (!info) return null
  return 'progress' in info ? info.metadata.musicInfo : info
})

const albumInfo = computed(() => {
  const info = playInfoMusic.value
  if (!info) return null
  const source = info.source
  // a song of a secondary source with an album: it is looked for when the album is clicked
  if (isSecondarySource(source) && source != 'yt' && musicInfo.album) return { source, id: '', name: musicInfo.album, secondary: true }
  const albumId = info.meta?.albumId
  if (!ONLINE_SOURCES.includes(source) || !albumId) return null
  return {
    source,
    id: String(albumId),
    name: info.meta.albumName ?? musicInfo.album ?? '',
  }
})

// the scroll bar shows while it scrolls only
const scrolling = ref(false)
let scrollTimeout = null
const handleScroll = () => {
  scrolling.value = true
  if (scrollTimeout) clearTimeout(scrollTimeout)
  scrollTimeout = setTimeout(() => {
    scrolling.value = false
    scrollTimeout = null
  }, 800)
}
onBeforeUnmount(() => {
  if (scrollTimeout) clearTimeout(scrollTimeout)
})

const closeDetail = () => {
  isShowPlayerDetail.value = false
}

const openAlbum = () => {
  if (!albumInfo.value) return
  closeDetail()
  if (albumInfo.value.secondary) {
    void openSecondarySongAlbum(router, playInfoMusic.value)
    return
  }
  void router.push({
    path: '/album',
    query: {
      source: albumInfo.value.source,
      id: albumInfo.value.id,
      name: albumInfo.value.name,
    },
  })
}
</script>

<style lang="less" module>
// (hidden scroll bar: shown while it scrolls, .scrolling)
.info:not(.scrolling) {
  &::-webkit-scrollbar-track,
  &::-webkit-scrollbar-thumb,
  &::-webkit-scrollbar-thumb:hover {
    background-color: transparent;
  }
}
.info {
  flex: auto;
  width: var(--content-width);
  min-height: 0;
  margin-top: 15px;
  p {
    font-size: 16px;
    line-height: 1.5;
    overflow-wrap: break-word;
    > span {
      font-size: 14px;
      color: var(--color-font-label);
    }
  }
}
.album {
  cursor: pointer;
  text-decoration: none;
  &:hover {
    color: var(--color-primary-font-hover);
    text-decoration: underline;
  }
}
</style>
