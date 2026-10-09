<template>
  <div :class="[$style.aside, { [$style.fullscreen]: isFullscreen }]">
    <Logo />
    <Nav />
    <MyList />
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'

import Logo from './Logo.vue'
import Nav from './Nav.vue'
import MyList from './MyList/index.vue'
</script>


<style lang="less" module>
// Ported from Any Listen: components/layout/Aside/index.svelte
.aside {
  display: flex;
  flex: none;
  flex-flow: column nowrap;
  width: 20%;
  max-width: 320px;
  background-color: var(--color-app-background);
  -webkit-user-select: none;

  &.fullscreen {
    :global(*) {
      -webkit-app-region: no-drag !important;
    }
  }
}
</style>
