<template>
  <Container padding>
    <Pic />
    <PlayInfo />
    <MiddlePlayProgress />
    <ControlBtns />
    <PlayBtns />
  </Container>
</template>

<script setup>
// Ported from Any Listen: components/layout/PlayBar/MiddleBar.svelte
import Container from './components/Container.vue'
import Pic from './components/Pic.vue'
import PlayInfo from './components/PlayInfo.vue'
import MiddlePlayProgress from './components/MiddlePlayProgress.vue'
import ControlBtns from './components/ControlBtns.vue'
import PlayBtns from './components/PlayBtns.vue'
</script>
