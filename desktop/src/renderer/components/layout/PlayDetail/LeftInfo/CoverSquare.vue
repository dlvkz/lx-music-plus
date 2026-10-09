<template>
  <div :class="$style.cover">
    <base-image :src="musicInfo.pic" />
  </div>
</template>

<script setup>
import { musicInfo } from '@renderer/store/player/state'
// Ported from Any Listen: components/layout/PlayDetail/LeftInfo/CoverSquare.svelte
</script>

<style lang="less" module>
.cover {
  position: relative;
  flex: none;
  width: var(--content-width);
  aspect-ratio: 1 / 1;
  contain: strict;
  background-color: var(--color-primary-light-300-alpha-800);
  border: 1px solid var(--color-primary-alpha-800);
  border-radius: 6px;
  box-shadow: 0 0 6px var(--color-primary-dark-200-alpha-600);
  :global {
    .pic {
      width: 100%;
      height: 100%;
      object-fit: cover;
      &.empty-pic {
        background-color: var(--color-primary-light-300-alpha-700);
      }
    }
  }
}
</style>
