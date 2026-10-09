<template>
  <Container padding>
    <Pic />
    <PlayInfo />
    <MiniPlayProgress />
    <ControlBtns />
    <PlayBtns />
  </Container>
</template>

<script setup>
// Ported from Any Listen: components/layout/PlayBar/MiniBar.svelte
import Container from './components/Container.vue'
import Pic from './components/Pic.vue'
import PlayInfo from './components/PlayInfo.vue'
import MiniPlayProgress from './components/MiniPlayProgress.vue'
import ControlBtns from './components/ControlBtns.vue'
import PlayBtns from './components/PlayBtns.vue'
</script>
