<template>
  <div :class="$style.header">
    <div ref="dom_btns" :class="$style.controlBtn">
      <button v-if="isFullscreen" type="button" :aria-label="$t('fullscreen_exit')" @click="fullscreenExit">
        <svg version="1.1" height="60%" viewBox="0 0 24 24">
          <use xlink:href="#icon-window-fullscreen-exit" />
        </svg>
      </button>
      <button type="button" :aria-label="$t('play_detail__hide_tip')" @click="hide">
        <svg version="1.1" height="35%" viewBox="0 0 30.727 30.727">
          <use xlink:href="#icon-window-hide" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, useCssModule } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { setShowPlayerDetail } from '@renderer/store/player/action'
import { setFullScreen } from '@renderer/utils/ipc'

// Ported from Any Listen: components/layout/PlayDetail/Header.svelte
const dom_btns = ref(null)
const cssModule = useCssModule()

const hide = () => {
  setShowPlayerDetail(false)
}
const fullscreenExit = () => {
  void setFullScreen(false).then((fullscreen) => {
    isFullscreen.value = fullscreen
  })
}

const getBtnEl = (el) => el ? (el.tagName == 'BUTTON' ? el : getBtnEl(el.parentNode)) : null
const handleMouseover = (event) => {
  getBtnEl(event.target)?.classList.add(cssModule.hover)
}
const handleMouseout = (event) => {
  getBtnEl(event.target)?.classList.remove(cssModule.hover)
}
const handleFocus = () => {
  if (!dom_btns.value) return
  for (const node of dom_btns.value.childNodes) {
    if (node.tagName == 'BUTTON') node.classList.remove(cssModule.hover)
  }
}
onMounted(() => {
  window.app_event.on('focus', handleFocus)
  dom_btns.value.addEventListener('mouseover', handleMouseover)
  dom_btns.value.addEventListener('mouseout', handleMouseout)
})
onBeforeUnmount(() => {
  window.app_event.off('focus', handleFocus)
  dom_btns.value?.removeEventListener('mouseover', handleMouseover)
  dom_btns.value?.removeEventListener('mouseout', handleMouseout)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.header {
  position: relative;
  flex: 0 0 @height-toolbar;
  align-self: flex-start;
  width: 100%;
  -webkit-app-region: drag;
}
.controlBtn {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  -webkit-app-region: no-drag;
  button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 30px;
    padding: 1px;
    color: var(--color-font-label);
    cursor: pointer;
    outline: none;
    background: none;
    border: none;
    transition: background-color 0.2s ease-in-out;
    &.hover {
      background-color: var(--color-button-background-hover);
    }
  }
}
.hover {
  opacity: 1;
}
</style>
