<template>
  <div :class="$style.cover">
    <span :class="$style.topDot" />
    <span :class="$style.bottomDot" />
    <svg :class="[$style.coverCd, { [$style.playing]: isPlay && visible }]" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <mask id="play-detail-cd-hole">
          <rect width="100" height="100" fill="white" />
          <circle cx="50" cy="50" r="11.6" fill="black" />
        </mask>
      </defs>
      <circle cx="50" cy="50" r="50" fill="var(--color-primary-light-400)" mask="url(#play-detail-cd-hole)" />
      <foreignObject style="mix-blend-mode: multiply" x="2" y="2" width="96" height="96" mask="url(#play-detail-cd-hole)">
        <base-image :src="musicInfo.pic" />
      </foreignObject>
      <circle cx="50" cy="50" r="20" style="mix-blend-mode: multiply" fill="var(--color-primary-light-300-alpha-600)" mask="url(#play-detail-cd-hole)" />
      <circle
        cx="50" cy="50" r="11" fill="none" stroke="var(--color-primary-light-300)" stroke-width="1.2"
        style="mix-blend-mode: exclusion" filter="drop-shadow(0 0 1 rgba(0,0,0,0.5))"
      />
      <circle cx="50" cy="50" r="11.6" fill="none" stroke="var(--color-primary-light-300)" stroke-width="0.4" />
    </svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { musicInfo, isPlay } from '@renderer/store/player/state'

// Ported from Any Listen: components/layout/PlayDetail/LeftInfo/CoverCD.svelte
const visible = ref(!document.hidden)
const handleVisibilityChange = () => {
  visible.value = !document.hidden
}
onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.mixin-dot(@color: var(--color-primary-light-300-alpha-800)) {
  .mixin-after();
  width: 7%;
  aspect-ratio: 1 / 1;
  background-color: @color;
  border-radius: 50%;
  box-shadow: inset 0 0 4px var(--color-primary-dark-300-alpha-800);
}
.cover {
  position: relative;
  flex: none;
  width: var(--content-width);
  aspect-ratio: 1 / 1;
  padding: 5%;
  contain: strict;
  background-color: var(--color-primary-light-300-alpha-800);
  border-radius: 6px;
  box-shadow: 0 0 6px var(--color-primary-alpha-500);
  opacity: 0.8;
  backdrop-filter: blur(4px);
}
.topDot {
  &::before {
    top: 5%;
    left: 5%;
    .mixin-dot();
  }
  &::after {
    top: 5%;
    right: 5%;
    .mixin-dot();
  }
}
.bottomDot {
  &::before {
    bottom: 5%;
    left: 5%;
    .mixin-dot();
  }
  &::after {
    right: 5%;
    bottom: 5%;
    .mixin-dot();
  }
}
.coverCd {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  box-shadow: 0 0 4px var(--color-primary-alpha-400);
  animation: spin 120s linear infinite;
  animation-play-state: paused;
  &.playing {
    animation-play-state: running;
  }
  :global(.pic) {
    border-radius: 50%;
    box-shadow: none;
  }
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
