<template>
  <div id="container" class="view-container">
    <!-- the cover of the song playing behind the menus (theme.isDynamicBackground) -->
    <div v-if="appBgSrc" id="dynamic-bg" :style="{ backgroundImage: appBgSrc }" />
    <div id="app-main">
      <layout-aside id="left" />
      <div id="app-right">
        <layout-toolbar id="toolbar" />
        <layout-view id="view" />
      </div>
    </div>
    <layout-play-bar id="player" />
    <layout-icons />
    <layout-change-log-modal />
    <layout-update-modal />
    <layout-pact-modal />
    <layout-sync-mode-modal />
    <layout-sync-auth-code-modal />
    <layout-play-detail />
  </div>
</template>

<script setup>
import { computed, onMounted } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { musicInfo } from '@renderer/store/player/state'
// import BubbleCursor from '@common/utils/effects/cursor-effects/bubbleCursor'
// import '@common/utils/effects/snow.min'
import useApp from '@renderer/core/useApp'

useApp()

const appBgSrc = computed(() => {
  if (!appSetting['theme.isDynamicBackground'] || !musicInfo.pic) return null
  return `url(${JSON.stringify(musicInfo.pic)})`
})

onMounted(() => {
  document.getElementById('root').style.display = 'block'

  // const styles = getComputedStyle(document.documentElement)
  // window.lxData.bubbleCursor = new BubbleCursor({
  //   fillStyle: styles.getPropertyValue('--color-primary-alpha-900'),
  //   strokeStyle: styles.getPropertyValue('--color-primary-alpha-700'),
  // })
})

// onBeforeUnmount(() => {
//   window.lxData.bubbleCursor?.destroy()
// })

</script>


<style lang="less">
@import './assets/styles/index.less';
@import './assets/styles/layout.less';

html {
  height: 100vh;
}
html, body {
  // overflow: hidden;
  box-sizing: border-box;
}

body {
  user-select: none;
  height: 100%;
}
#root {
  height: 100%;
  position: relative;
  overflow: hidden;
  color: var(--color-font);
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  transition: background-color @transition-normal;
  background-color: var(--color-content-background);
  box-sizing: border-box;

  &::before {
    .mixin-after();
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--color-main-background);
    opacity: 0.9;
    backdrop-filter: blur(var(--background-blur, 0));
  }
}

.disableAnimation * {
  transition: none !important;
  animation: none !important;
}

.transparent {
  background: transparent;
  padding: @shadow-app;
  // #waiting-mask {
  //   border-radius: @radius-border;
  //   left: @shadow-app;
  //   right: @shadow-app;
  //   top: @shadow-app;
  //   bottom: @shadow-app;
  // }
  #body {
    border-radius: @radius-border;
  }
  #root {
    box-shadow: 0 0 @shadow-app rgba(0, 0, 0, 0.5);
    border-radius: @radius-border;
  }
  // #container {
    // border-radius: @radius-border;
    // background-color: transparent;
  // }
}
.disableTransparent {
  background-color: var(--color-content-background);

  &.linux #body {
    border: 1px solid var(--color-primary-light-500);
  }
  &.windows:not(.windows-11, .fullscreen) #body {
    border-top: 1px solid #aaa;
  }


  // #view { // 偏移5px距离解决非透明模式下右侧滚动条无法拖动的问题
  //   margin-right: 5Px;
  // }
}
.fullscreen {
  background-color: var(--color-content-background);

}

// Layout ported from Any Listen: components/layout/index.svelte + app.less
#container {
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  box-shadow: 0 0 4px rgb(0 0 0 / 10%);
  transition: @transition-normal;
  transition-property: opacity;
}
#dynamic-bg {
  position: absolute;
  top: -40px;
  left: -40px;
  width: calc(100% + 80px);
  height: calc(100% + 80px);
  background-position: center;
  background-size: cover;
  filter: blur(40px);
  opacity: 0.35;
  pointer-events: none;
}
#app-main {
  position: relative;
  z-index: 1;
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
  min-height: 0;
  transition: @transition-normal;
  transition-property: opacity;
}
#app-right {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-width: 0;
  overflow: hidden;
}
#toolbar, #player {
  flex: none;
}
#view {
  position: relative;
  z-index: 1;
  flex: auto;
  min-height: 0;
}

.view-container {
  transition: opacity @transition-normal;
}
#root.show-modal {
  #app-main,
  .view-container > #player > * {
    opacity: 0.3;
  }
}
#view.show-modal > .view-container {
  opacity: .2;
}

</style>

