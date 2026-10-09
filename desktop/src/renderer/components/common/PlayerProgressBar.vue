<template>
  <div :class="['progress', $style.progress]">
    <div
      :class="['progress-bar', 'progress-bar2', $style.progressBar, $style.progressBar2, { [$style.barTransition]: isActiveTransition }]"
      :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd"
    />
    <div
      :class="['progress-bar', 'progress-bar3', $style.progressBar, $style.progressBar3, { [$style.show]: dragging }]"
      :style="{ transform: `scaleX(${dragProgress || 0})` }"
    />
  </div>
  <div ref="dom_progress" role="slider" tabindex="0" :aria-valuenow="progress" :class="$style.progressMask" @mousedown="handleMsDown" />
</template>

<script>
import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { playProgress } from '@renderer/store/player/playProgress'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'

// Ported from Any Listen: components/common/PlayerProgressBar.svelte
export default {
  setup() {
    const { progress, isActiveTransition, handleTransitionEnd } = usePlayProgress()
    const msEvent = {
      isMsDown: false,
      msDownX: 0,
      msDownProgress: 0,
    }
    const dom_progress = ref(null)
    const dragging = ref(false)
    const dragProgress = ref(0)

    const handleMsDown = (event) => {
      msEvent.isMsDown = true
      msEvent.msDownX = event.clientX
      let val = event.offsetX / dom_progress.value.clientWidth
      if (val < 0) val = 0
      if (val > 1) val = 1
      dragProgress.value = msEvent.msDownProgress = val
    }
    const handleMsUp = () => {
      if (msEvent.isMsDown) window.app_event.setProgress(dragProgress.value * playProgress.maxPlayTime)
      msEvent.isMsDown = false
      dragging.value = false
    }
    const handleMsMove = (event) => {
      if (!msEvent.isMsDown) return
      dragging.value ||= true
      let val = msEvent.msDownProgress + (event.clientX - msEvent.msDownX) / dom_progress.value.clientWidth
      if (val > 1) val = 1
      else if (val < 0) val = 0
      dragProgress.value = val
    }

    document.addEventListener('mousemove', handleMsMove)
    document.addEventListener('mouseup', handleMsUp)
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleMsMove)
      document.removeEventListener('mouseup', handleMsUp)
    })

    return {
      progress,
      isActiveTransition,
      handleTransitionEnd,
      dom_progress,
      dragging,
      dragProgress,
      handleMsDown,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.progress {
  position: relative;
  width: 100%;
  height: 5px;
  contain: strict;
  overflow: hidden;
  background-color: var(--color-primary-light-100-alpha-800);
  border-radius: 40px;
  transition: @transition-normal;
  transition-property: background-color;
}
.progressMask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  contain: strict;
  cursor: pointer;
}
.progressBar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0;
}
.progressBar2 {
  background-color: var(--color-primary-light-100-alpha-400);
  will-change: transform;
}
.progressBar3 {
  background-color: var(--color-primary-light-100-alpha-200);
  opacity: 0;
  transition: @transition-normal;
  transition-property: opacity;
  &.show {
    opacity: 0.5;
  }
}
.barTransition {
  transition-timing-function: ease-out;
  transition-duration: 0.2s;
  transition-property: transform;
}
</style>
