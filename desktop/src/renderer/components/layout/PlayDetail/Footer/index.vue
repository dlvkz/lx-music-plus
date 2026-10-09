<template>
  <div :class="$style.footer">
    <transition name="fade">
      <div v-if="introend" :class="$style.footerContent">
        <div :class="$style.control">
          <div :class="$style.side">
            <LeftControlBtns />
          </div>
          <PlayBtns />
          <div :class="[$style.side, $style.right]">
            <RightControlBtns />
          </div>
        </div>
        <div :class="['middle-play-progress', $style.middlePlayProgress]">
          <span>{{ nowPlayTimeStr }}</span>
          <div :class="$style.progress">
            <common-player-progress-bar />
          </div>
          <span>{{ maxPlayTimeStr }}</span>
        </div>
        <div :class="$style.playStatus">{{ isPlay ? '' : statusText }}</div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { isPlay, statusText } from '@renderer/store/player/state'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import LeftControlBtns from './LeftControlBtns.vue'
import RightControlBtns from './RightControlBtns.vue'
import PlayBtns from './PlayBtns.vue'

// Ported from Any Listen: components/layout/PlayDetail/Footer/{index,MiddlePlayProgress,PlayStatusText}.svelte
defineProps({
  introend: {
    type: Boolean,
    default: false,
  },
})
const { nowPlayTimeStr, maxPlayTimeStr } = usePlayProgress()
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footer {
  flex: none;
  height: 100px;
  contain: strict;
}
.footerContent {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  padding: 0 30px 16px;
}
.control {
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
}
.side {
  position: relative;
  display: flex;
  flex: 1;
  flex-flow: row nowrap;
  align-items: center;
  height: 100%;
  padding-top: 15px;
}
.right {
  justify-content: flex-end;
  padding-left: 16px;
  margin-left: -10px;
}
.middlePlayProgress {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  width: 100%;
  font-size: 13px;
  color: var(--color-550);
}
.progress {
  position: relative;
  flex: auto;
  padding: 8px 0;
  margin: 0 8px;
}
.playStatus {
  position: absolute;
  bottom: 3px;
  left: 0;
  box-sizing: content-box;
  width: 100%;
  height: 16px;
  font-size: 12px;
  color: var(--color-font-label);
  text-align: center;
  pointer-events: none;
  .mixin-ellipsis-1();
}
</style>
