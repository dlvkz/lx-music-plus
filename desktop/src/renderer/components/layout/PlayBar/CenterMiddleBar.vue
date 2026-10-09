<template>
  <CenterControlLayout>
    <template #left>
      <Pic />
      <PlayInfo />
    </template>
    <template #right>
      <div :class="$style.progress">
        <MiddlePlayProgress />
      </div>
      <ControlBtns />
    </template>
  </CenterControlLayout>
</template>

<script setup>
// Ported from Any Listen: components/layout/PlayBar/CenterMiddleBar.svelte
import CenterControlLayout from './components/CenterControlLayout.vue'
import Pic from './components/Pic.vue'
import PlayInfo from './components/PlayInfo.vue'
import MiddlePlayProgress from './components/MiddlePlayProgress.vue'
import ControlBtns from './components/ControlBtns.vue'
</script>

<style lang="less" module>
.progress {
  display: flex;
  flex: auto;
  padding-left: 10px;
  contain: layout;
  :global(> .middle-play-progress) {
    width: 100%;
  }
}
</style>
