<template>
  <div ref="dom_container" :class="$style.container">
    <button :class="$style.btn" :aria-label="$t('player__prev')" @click="playPrev()">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" :width="iconSize" :height="iconSize" viewBox="0 0 24 24">
        <use xlink:href="#icon-skip-prev" />
      </svg>
    </button>
    <button :class="$style.btn" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
      <svg v-if="isPlay" version="1.1" xmlns="http://www.w3.org/2000/svg" :width="iconSize2" :height="iconSize2" viewBox="0 0 24 24">
        <use xlink:href="#icon-pause" />
      </svg>
      <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" :width="iconSize2" :height="iconSize2" viewBox="0 0 24 24">
        <use xlink:href="#icon-play" />
      </svg>
    </button>
    <button :class="$style.btn" :aria-label="$t('player__next')" @click="playNext()">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" :width="iconSize" :height="iconSize" viewBox="0 0 24 24">
        <use xlink:href="#icon-skip-next" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { isPlay } from '@renderer/store/player/state'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'

// Ported from Any Listen: components/layout/PlayDetail/Footer/PlayBtns.svelte
const dom_container = ref(null)
const iconSize = ref('42px')
const iconSize2 = ref('46px')

let observer = null
onMounted(() => {
  observer = new ResizeObserver(() => {
    const height = dom_container.value?.clientHeight ?? 0
    iconSize.value = `${Math.trunc(height * 0.72)}px`
    iconSize2.value = `${Math.trunc(height * 0.85)}px`
  })
  observer.observe(dom_container.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 18px;
  align-items: center;
  height: 100%;
  padding-right: 30px;
  padding-left: 30px;
}
.btn {
  display: flex;
  flex: none;
  padding: 0;
  color: var(--color-button-font);
  cursor: pointer;
  background-color: transparent;
  border: none;
  opacity: 1;
  transition: @transition-fast;
  transition-property: color, opacity;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    opacity: 0.6;
  }
}
</style>
