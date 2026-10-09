<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }]">
    <div :class="$style.left">
      <SearchInput />
    </div>
    <ControlBtns />
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import ControlBtns from './ControlBtns.vue'
import SearchInput from './SearchInput.vue'
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// Ported from Any Listen: components/layout/Header/index.svelte
.toolbar {
  position: relative;
  z-index: 2;
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  height: @height-toolbar;
  -webkit-app-region: drag;

  &.fullscreen {
    -webkit-app-region: no-drag;
  }
}
.left {
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
  align-items: center;
  height: 100%;
  margin-left: 12px;
}
</style>
