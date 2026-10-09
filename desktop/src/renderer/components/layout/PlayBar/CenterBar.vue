<template>
  <CenterControlLayout>
    <template #left>
      <Pic />
      <PlayInfo />
    </template>
    <template #right>
      <MiniPlayProgress />
      <ControlBtns />
    </template>
  </CenterControlLayout>
</template>

<script setup>
// Ported from Any Listen: components/layout/PlayBar/CenterBar.svelte
import CenterControlLayout from './components/CenterControlLayout.vue'
import Pic from './components/Pic.vue'
import PlayInfo from './components/PlayInfo.vue'
import MiniPlayProgress from './components/MiniPlayProgress.vue'
import ControlBtns from './components/ControlBtns.vue'
</script>
