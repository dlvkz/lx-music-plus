<template>
  <div :class="['player', $style.player]">
    <div :class="$style.bg">
      <!-- the dynamic background of the player (playDetail.isDynamicBackground) -->
      <div v-if="bgSrc" :class="$style.cover" :style="{ backgroundImage: bgSrc }" />
    </div>
    <div :class="['player-inner', $style.playerInner, { [$style.padding]: padding }]">
      <slot />
    </div>
  </div>
</template>

<script>
// Ported from Any Listen: components/layout/PlayBar/components/Container.svelte
import { computed } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { musicInfo } from '@renderer/store/player/state'

export default {
  props: {
    padding: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const bgSrc = computed(() => {
      if (!appSetting['playDetail.isDynamicBackground'] || !musicInfo.pic) return null
      return `url(${JSON.stringify(musicInfo.pic)})`
    })
    return { bgSrc }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.player {
  position: relative;
  z-index: 2;
  height: @height-player;
  contain: size layout style;
}
.bg {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  box-shadow: 0 0 6px var(--color-primary-dark-200-alpha-800);
  opacity: 0.8;
  backdrop-filter: blur(4px);
  transition: @transition-normal;
  transition-property: opacity;
}
.cover {
  position: absolute;
  top: -20px;
  left: -20px;
  width: calc(100% + 40px);
  height: calc(100% + 40px);
  background-position: center;
  background-size: cover;
  filter: blur(20px);
  opacity: 0.55;
}
.playerInner {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  width: 100%;
  height: 100%;
  contain: strict;
  transition: @transition-normal;
  transition-property: opacity;
  &.padding {
    padding-right: 10px;
  }
}
</style>
