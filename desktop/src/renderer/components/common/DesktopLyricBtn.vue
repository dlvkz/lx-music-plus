<template>
  <div :class="$style.icon">
    <base-btn icon link :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu.prevent="toggleLockDesktopLyric">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" height="100%" viewBox="0 0 480.29 365.42">
        <use :xlink:href="`#icon-lrc_${appSetting['desktopLyric.enable'] ? 'on' : 'off'}`" />
      </svg>
    </base-btn>
  </div>
</template>

<script setup>
import { appSetting } from '@renderer/store/setting'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'

// Ported from Any Listen: components/common/DesktopLyricBtn/Desktop.svelte
const {
  toggleDesktopLyricBtnTitle,
  toggleDesktopLyric,
  toggleLockDesktopLyric,
} = useToggleDesktopLyric()
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.icon :global {
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: inherit !important;
    opacity: 0.55;
    transition: opacity @transition-normal;
    svg {
      filter: drop-shadow(0 0 1px rgb(0 0 0 / 20%));
    }
    &:hover {
      opacity: 0.9;
    }
    &:active {
      opacity: 1;
    }
  }
}
</style>
