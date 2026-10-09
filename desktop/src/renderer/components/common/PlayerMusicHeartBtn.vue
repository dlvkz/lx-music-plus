<template>
  <div :class="$style.icon">
    <common-music-heart-btn :music-info="musicInfo" link />
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { playMusicInfo } from '@renderer/store/player/state'

// Ported from Any Listen: components/common/PlayerMusicHeartBtn.svelte
const musicInfo = computed(() => {
  const info = playMusicInfo.musicInfo
  if (!info) return null
  return 'progress' in info ? info.metadata.musicInfo : info
})
</script>

<style lang="less" module>
.icon :global {
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    svg {
      filter: drop-shadow(0 0 1px rgb(0 0 0 / 20%));
      &:hover {
        opacity: 0.9;
      }
      &:active {
        opacity: 1;
      }
    }
  }
}
</style>
