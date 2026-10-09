<template>
  <button :class="$style.content" @click="handleShowPopup" @mouseenter="handlMsEnter" @mouseleave="handlMsLeave">
    <div ref="dom_btn" :class="$style.timeContent">
      <span>{{ nowPlayTimeStr }}</span>
      <span class="dv">/</span>
      <span>{{ maxPlayTimeStr }}</span>
      <div :class="$style.progress">
        <div
          :class="[$style.progressBar, { [$style.barTransition]: isActiveTransition }]"
          :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd"
        />
      </div>
      <base-popup v-model:visible="visible" :btn-el="getDomBtn" @mouseenter="handlMsEnter" @mouseleave="handlMsLeave" @transitionend="handleTranEnd">
        <div :class="$style.popupProgress">
          <common-player-progress-bar v-if="visibleProgress" />
        </div>
      </base-popup>
    </div>
  </button>
</template>

<script setup>
import { ref } from '@common/utils/vueTools'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'

// Ported from Any Listen: components/layout/PlayBar/components/MiniPlayProgress.svelte
const visible = ref(false)
const visibleProgress = ref(false)
const dom_btn = ref(null)
const getDomBtn = () => dom_btn.value

const {
  nowPlayTimeStr,
  maxPlayTimeStr,
  progress,
  isActiveTransition,
  handleTransitionEnd,
} = usePlayProgress()

let timeout = null
const handlMsEnter = () => {
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  if (visible.value) return
  timeout = setTimeout(() => {
    visible.value = true
    visibleProgress.value = true
  }, 100)
}
const handlMsLeave = () => {
  if (timeout) {
    clearTimeout(timeout)
    timeout = null
  }
  if (!visible.value) return
  timeout = setTimeout(() => {
    timeout = null
    visible.value = false
  }, 100)
}
const handleShowPopup = (evt) => {
  if (visible.value) {
    evt.stopPropagation()
  } else handlMsEnter()
}
const handleTranEnd = () => {
  if (visible.value) return
  visibleProgress.value = false
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.content {
  position: relative;
  flex: none;
  padding: 15px 0;
  background-color: transparent;
  border: none;
  &:hover {
    .progress {
      opacity: 1;
    }
  }
}
.timeContent {
  position: relative;
  padding-bottom: 3px;
  font-size: 13px;
  color: var(--color-550);
}
.progress {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  height: 2px;
  margin-top: 2px;
  contain: strict;
  overflow: hidden;
  background-color: var(--color-primary-light-100-alpha-800);
  opacity: 0.24;
  transition: @transition-normal;
  transition-property: background-color, opacity;
}
.progressBar {
  width: 100%;
  height: 100%;
  background-color: var(--color-primary-light-100-alpha-400);
  transform-origin: 0;
  will-change: transform;
}
.barTransition {
  transition-timing-function: ease-out;
  transition-duration: 0.2s;
  transition-property: transform;
}
.popupProgress {
  position: relative;
  width: 300px;
  height: 15px;
  padding: 5px 0;
  margin: 0 5px;
}
</style>
