<template>
  <Container padding>
    <div :class="$style.progress">
      <common-player-progress-bar v-if="!isShowPlayerDetail" />
    </div>
    <Pic />
    <PlayInfo />
    <Times />
    <ControlBtns />
    <PlayBtns />
  </Container>
</template>

<script setup>
// Ported from Any Listen: components/layout/PlayBar/FullBar.svelte
import { isShowPlayerDetail } from '@renderer/store/player/state'
import Container from './components/Container.vue'
import Pic from './components/Pic.vue'
import PlayInfo from './components/PlayInfo.vue'
import Times from './components/Times.vue'
import ControlBtns from './components/ControlBtns.vue'
import PlayBtns from './components/PlayBtns.vue'
</script>

<style lang="less" module>
.progress {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  padding-bottom: 6px;
  margin: 0 10px;
  :global {
    .progress {
      height: 2px;
      background-color: transparent;
      border-radius: 0;
    }
    .progress-bar2 {
      background-color: var(--color-primary-light-100-alpha-800);
    }
    .progress-bar3 {
      background-color: var(--color-primary-light-100-alpha-600);
    }
  }
}
</style>
