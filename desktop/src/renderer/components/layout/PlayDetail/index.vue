<template>
  <transition enter-active-class="animated slideInUp" leave-active-class="animated slideOutDown" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave">
    <div
      v-if="isShowPlayerDetail"
      :class="['play-detail', $style.playDetail, { [$style.dybg]: bgSrc }, { fullscreen: isFullscreen }]"
      role="alert" @contextmenu="handleContextMenu"
    >
      <div :class="$style.bg" :style="bgSrc ? { backgroundImage: bgSrc } : null" />
      <DetailHeader />
      <div :class="[$style.main, { [$style.showComment]: isShowPlayComment }]">
        <LeftInfo />
        <transition name="fade">
          <LyricPlayer v-if="visibled" />
        </transition>
        <music-comment v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment" />
      </div>
      <DetailFooter :introend="visibled" />
      <transition enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut">
        <common-audio-visualizer v-if="appSetting['player.audioVisualization'] && visibled" />
      </transition>
    </div>
  </transition>
</template>

<script>
import { ref, computed, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { isShowPlayerDetail, isShowPlayComment, musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { setShowPlayerDetail, setShowPlayComment, setShowPlayLrcSelectContentLrc } from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import DetailHeader from './Header.vue'
import LeftInfo from './LeftInfo/index.vue'
import LyricPlayer from './LyricPlayer.vue'
import DetailFooter from './Footer/index.vue'
import MusicComment from './components/MusicComment/index.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'

// Ported from Any Listen: components/layout/PlayDetail/{index,Main}.svelte
export default {
  name: 'CorePlayDetail',
  components: {
    DetailHeader,
    LeftInfo,
    LyricPlayer,
    DetailFooter,
    MusicComment,
  },
  setup() {
    const visibled = ref(false)
    let clickTime = 0

    const bgSrc = computed(() => {
      if (!appSetting['playDetail.isDynamicBackground'] || !musicInfo.pic) return null
      return `url(${JSON.stringify(musicInfo.pic)})`
    })

    // double right click to hide
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      setShowPlayerDetail(false)
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()
      visibled.value = true
    }
    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment()
      visibled.value = false
      unregisterAutoHideMounse()
    }

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    return {
      appSetting,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      isFullscreen,
      visibled,
      bgSrc,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.playDetail {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  contain: strict;
  color: var(--color-font);
  background-color: var(--color-content-background);
  border-radius: @radius-border;
  -webkit-app-region: no-drag;

  &.dybg {
    :global {
      * {
        text-shadow:
          0 0 2px var(--color-primary-light-100-alpha-900),
          0 0 3px var(--color-primary-light-100-alpha-900),
          0 0 4px var(--color-primary-dark-700-alpha-900);
      }
      svg {
        filter: drop-shadow(0 0 2px var(--color-primary-light-100-alpha-600)) drop-shadow(0 0 4px var(--color-primary-light-100-alpha-700));
      }
      .progress {
        > .progress {
          box-shadow:
            0 0 2px var(--color-primary-light-200-alpha-800),
            0 0 4px var(--color-primary-light-200-alpha-800);
        }
      }
    }
    .bg {
      background-size: 125% 125%;
      &::before {
        background-color: var(--color-content-background);
        opacity: 0.7;
      }
      &::after {
        background-color: transparent;
        backdrop-filter: blur(30px);
      }
    }
  }
}
.bg {
  position: absolute;
  top: 0;
  left: 0;
  z-index: -1;
  width: 100%;
  height: 100%;
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  opacity: 0.7;
  &::before {
    display: block;
    width: 100%;
    height: 100%;
    content: '';
    background-color: var(--color-app-background);
  }
  &::after {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
    content: '';
    background-color: var(--color-main-background);
  }
}

.main {
  position: relative;
  display: flex;
  flex: auto;
  min-height: 0;
  overflow: hidden;

  // LX Music: the comment panel takes the right half
  &.showComment {
    :global {
      .left {
        width: 22%;
        --content-width: 86%;
        .description p {
          font-size: 12px;
        }
      }
      .right {
        flex: 0 0 28%;
      }
    }
    .comment {
      opacity: 1;
      transform: scaleX(1);
    }
  }
}
.comment {
  position: absolute;
  top: 0;
  right: 0;
  width: 50%;
  height: 100%;
  margin-left: 10px;
  opacity: 1;
  transform: scaleX(0);
}
</style>
