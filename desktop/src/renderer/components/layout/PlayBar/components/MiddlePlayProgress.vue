<template>
  <div :class="['middle-play-progress', $style.middlePlayProgress]">
    <span>{{ nowPlayTimeStr }}</span>
    <div :class="$style.progress">
      <common-player-progress-bar v-if="!isShowPlayerDetail" />
    </div>
    <span>{{ maxPlayTimeStr }}</span>
  </div>
</template>

<script setup>
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { isShowPlayerDetail } from '@renderer/store/player/state'

// Ported from Any Listen: components/layout/PlayBar/components/MiddlePlayProgress.svelte
const { nowPlayTimeStr, maxPlayTimeStr } = usePlayProgress()
</script>

<style lang="less" module>
.middlePlayProgress {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  // (the window is resized: the song name keeps its room in a small one, the bar grows in a big one)
  width: clamp(170px, 30%, 520px);
  font-size: 13px;
  color: var(--color-550);
}
.progress {
  position: relative;
  flex: auto;
  padding: 8px 0;
  margin: 0 8px;
}
</style>
