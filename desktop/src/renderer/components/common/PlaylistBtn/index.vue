<template>
  <material-popup-btn ref="popupRef" height="32rem" :aria-label="$t('player__list')" @visible="handleVisible">
    <div :class="$style.icon">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 192 192">
        <use xlink:href="#icon-playlist" />
      </svg>
    </div>
    <template #content>
      <div :class="$style.container">
        <QueueList v-if="render" @close="popupRef?.hide()" />
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { ref, nextTick } from '@common/utils/vueTools'
import QueueList from './QueueList.vue'

// Ported from Any Listen: components/common/PlaylistBtn/index.svelte
const render = ref(false)
const popupRef = ref(null)
const handleVisible = (visible) => {
  void nextTick(() => {
    render.value = visible
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.icon {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 100%;
  padding: 0;
  color: var(--color-button-font);
  cursor: pointer;
  transition: color @transition-normal;
  svg {
    opacity: 0.5;
    transition: @transition-fast;
    transition-property: opacity, color;
  }
  &:hover {
    svg {
      opacity: 0.9;
    }
  }
  &:active {
    svg {
      opacity: 1;
    }
  }
}
.container {
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  width: 500px;
  height: 100%;
  min-height: 300px;
  max-height: 100%;
}
</style>
