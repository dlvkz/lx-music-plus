<template>
  <div :class="$style.container">
    <p :class="[$style.title, $style.clickable]" @click="handleTitleClick">
      <common-translatable-text :text="musicInfo.name" />
    </p>
    <p :class="$style.artists">
      <common-artist-names :singer="musicInfo.singer" :music-info="artistInfo" inline />
    </p>
    <p :class="$style.statusText">{{ statusText }}</p>
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { clipboardWriteText } from '@common/utils/electron'
import { musicInfo, statusText, playMusicInfo } from '@renderer/store/player/state'
import { isSecondarySource } from '@renderer/utils/secondarySources'
import { openSecondarySongAlbum } from '@renderer/utils/songLinks'

const router = useRouter()

// The player state only keeps `id` (`<source>_<songId>`); rebuild what ArtistNames needs
const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg']
const artistInfo = computed(() => {
  const id = musicInfo.id
  if (!id) return null
  const index = id.indexOf('_')
  if (index < 1) return null
  const source = id.slice(0, index)
  if (!ONLINE_SOURCES.includes(source)) return null
  return { source, meta: { songId: id.slice(index + 1) } }
})

// a song played from the downloads is a download task that wraps the song
const playingMusic = computed(() => {
  const info = playMusicInfo.musicInfo
  return info ? 'progress' in info ? info.metadata.musicInfo : info : null
})

const albumInfo = computed(() => {
  const music = playingMusic.value
  const meta = music?.meta
  if (!meta) return null
  const source = music.source
  // a song of a secondary source: its album is looked for when the title is clicked
  if (isSecondarySource(source)) return { source, id: '', name: meta.albumName ?? '', secondary: true }
  if (!ONLINE_SOURCES.includes(source)) return null
  const albumId = meta.albumId
  if (!albumId) return null
  return { source, id: String(albumId), name: meta.albumName ?? musicInfo.album ?? '' }
})

const handleTitleClick = () => {
  if (albumInfo.value?.secondary) {
    void openSecondarySongAlbum(router, playingMusic.value)
  } else if (albumInfo.value) {
    void router.push({
      path: '/album',
      query: {
        source: albumInfo.value.source,
        id: albumInfo.value.id,
        name: albumInfo.value.name,
      },
    })
  } else if (musicInfo.name) {
    clipboardWriteText(musicInfo.name)
  }
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  flex: auto;
  min-width: 0;
  contain: content;
}
.title {
  padding: 1px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-font);
  cursor: default;
  .mixin-ellipsis-1();
  &.clickable {
    cursor: pointer;
    text-decoration: none;
    &:hover {
      color: var(--color-primary-font-hover);
      text-decoration: underline;
    }
  }
}
.artists {
  padding: 1px 0;
  font-size: 12px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.statusText {
  box-sizing: content-box;
  height: 16px;
  padding-bottom: 1px;
  font-size: 13px;
  color: var(--color-primary-font);
  .mixin-ellipsis-1();
}
</style>
