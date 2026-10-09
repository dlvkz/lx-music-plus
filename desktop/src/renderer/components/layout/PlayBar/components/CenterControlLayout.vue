<template>
  <Container>
    <slot />
    <div :class="$style.side">
      <slot name="left" />
    </div>
    <PlayBtns />
    <div :class="[$style.side, $style.right]">
      <slot name="right" />
      <div :class="$style.space" />
    </div>
  </Container>
</template>

<script setup>
import Container from './Container.vue'
import PlayBtns from './PlayBtns.vue'
// Ported from Any Listen: components/layout/PlayBar/components/CenterControlLayout.svelte
</script>

<style lang="less" module>
.side {
  position: relative;
  display: flex;
  flex: 1;
  flex-flow: row nowrap;
  align-items: center;
  min-width: 0;
  height: 100%;
}
.right {
  justify-content: flex-end;
}
.space {
  padding-right: 10px;
}
</style>
