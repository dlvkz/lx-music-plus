<template>
  <div :class="['right', $style.right]" :style="lrcFontSize">
    <!-- Lyric styles ported from Any Listen: components/layout/PlayDetail/RightLyric/LyricPlayer.svelte -->
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div
        v-show="!isShowLrcSelectContent"
        ref="dom_lyric"
        :class="['lyric', $style.lyric, { [$style.draging]: isMsDown }, { [$style.lrcActiveZoom]: isZoomActiveLrc }, { [$style.fontWeight]: appSetting['playDetail.style.fontWeight'] }, $style['text-' + appSetting['playDetail.style.align']]]" :style="lrcStyles"
        @wheel="handleWheel" @mousedown="handleLyricMouseDown" @touchstart="handleLyricTouchStart"
        @contextmenu.stop="handleShowLyricMenu"
      >
        <div :class="['pre', $style.lyricSpace]" />
        <div ref="dom_lyric_text" />
        <div :class="$style.lyricSpace" />
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLyricProgressSetting" v-show="isStopScroll && !isShowLrcSelectContent" :class="$style.skip">
        <div ref="dom_skip_line" :class="$style.line" />
        <span :class="$style.label">{{ timeStr }}</span>
        <base-btn :class="$style.skipBtn" @mouseenter="handleSkipMouseEnter" @mouseleave="handleSkipMouseLeave" @click="handleSkipPlay">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </base-btn>
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLrcSelectContent" ref="dom_lrc_select_content" tabindex="-1" :class="[$style.lyricSelectContent, 'select', 'scroll', 'lyricSelectContent']" @contextmenu="handleCopySelectText">
        <div v-for="(info, index) in lyric.lines" :key="index" :class="[$style.lyricSelectline, { [$style.lrcActive]: lyric.line == index }]">
          <span>{{ info.text }}</span>
          <template v-for="(lrc, i) in info.extendedLyrics" :key="i">
            <br>
            <span :class="$style.lyricSelectlineExtended">{{ lrc }}</span>
          </template>
        </div>
      </div>
    </transition>
    <LyricMenu v-model="lyricMenuVisible" :xy="lyricMenuXY" :lyric-info="lyricInfo" @update-lyric="handleUpdateLyric" />
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { lyric } from '@renderer/store/player/lyric'
import { isFullscreen } from '@renderer/store'
import { playProgress } from '@renderer/store/player/playProgress'
import {
  isPlay,
  isShowLrcSelectContent,
  isShowPlayComment,
  musicInfo as playerMusicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setMusicInfo,
} from '@renderer/store/player/action'
import { onMounted, onBeforeUnmount, computed, reactive, ref, nextTick, watch } from '@common/utils/vueTools'
import useLyric from '@renderer/utils/compositions/useLyric'
import LyricMenu from './components/LyricMenu.vue'
import { appSetting } from '@renderer/store/setting'
import { setLyricOffset } from '@renderer/core/lyric'
import useSelectAllLrc from './useSelectAllLrc'

export default {
  components: {
    LyricMenu,
  },
  setup() {
    const isZoomActiveLrc = computed(() => appSetting['playDetail.isZoomActiveLrc'])
    const isShowLyricProgressSetting = computed(() => appSetting['playDetail.isShowLyricProgressSetting'])

    const {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      isMsDown,
      isStopScroll,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleWheel,
      handleSkipPlay,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      handleScrollLrc,
    } = useLyric({ isPlay, lyric, playProgress, isShowLyricProgressSetting })

    const dom_lrc_select_content = useSelectAllLrc()

    watch([isFullscreen, isShowPlayComment], () => {
      setTimeout(handleScrollLrc, 400)
    })

    const lyricMenuVisible = ref(false)
    const lyricMenuXY = reactive({
      x: 0,
      y: 0,
    })
    const lyricInfo = reactive({
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      rawlyric: '',
      musicInfo: null,
    })
    const updateMusicInfo = () => {
      lyricInfo.lyric = playerMusicInfo.lrc
      lyricInfo.tlyric = playerMusicInfo.tlrc
      lyricInfo.rlyric = playerMusicInfo.rlrc
      lyricInfo.lxlyric = playerMusicInfo.lxlrc
      lyricInfo.rawlyric = playerMusicInfo.rawlrc
      lyricInfo.musicInfo = playMusicInfo.musicInfo
    }
    const handleShowLyricMenu = event => {
      updateMusicInfo()
      lyricMenuXY.x = event.pageX
      lyricMenuXY.y = event.pageY
      if (lyricMenuVisible.value) return
      void nextTick(() => {
        lyricMenuVisible.value = true
      })
    }
    const handleUpdateLyric = ({ lyric, tlyric, rlyric, lxlyric, offset }) => {
      setMusicInfo({
        lrc: lyric,
        tlrc: tlyric,
        rlrc: rlyric,
        lxlrc: lxlyric,
      })
      console.log(offset)
      setLyricOffset(offset)
    }

    const lrcStyles = computed(() => {
      return {
        textAlign: appSetting['playDetail.style.align'],
      }
    })
    // Any Listen: (fontSize / 100 + 0.8) * winRadio rem, LX's default 140 maps to Any Listen's default 100
    const winRadio = ref(document.getElementById('root').clientWidth / 1020)
    const handleResize = () => {
      winRadio.value = document.getElementById('root').clientWidth / 1020
    }
    const lrcFontSize = computed(() => {
      let size = (appSetting['playDetail.style.fontSize'] / 100 + 0.4) * winRadio.value
      return {
        '--play-detail-lrc-font-size': (isShowPlayComment.value ? size * 0.82 : size) + 'rem',
      }
    })

    onMounted(() => {
      window.addEventListener('resize', handleResize)
      window.app_event.on('musicToggled', updateMusicInfo)
      window.app_event.on('lyricUpdated', updateMusicInfo)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResize)
      window.app_event.off('musicToggled', updateMusicInfo)
      window.app_event.off('lyricUpdated', updateMusicInfo)
    })

    return {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      dom_lrc_select_content,
      isMsDown,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleWheel,
      handleSkipPlay,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      lyric,
      lrcStyles,
      lrcFontSize,
      isShowLrcSelectContent,
      isShowLyricProgressSetting,
      isZoomActiveLrc,
      isStopScroll,
      lyricMenuVisible,
      lyricMenuXY,
      handleShowLyricMenu,
      handleUpdateLyric,
      lyricInfo,
      appSetting,
    }
  },
  methods: {
    handleCopySelectText() {
      let str = window.getSelection().toString()
      str = str.trim()
      if (!str.length) return
      clipboardWriteText(str)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@unplay-color: var(--color-300);
@unplay-font-color: var(--color-250);
@played-color: var(--color-primary-dark-100);

.right {
  position: relative;
  flex: auto;
  contain: strict;
  transition: flex-basis @transition-normal;
}
.lyric {
  position: relative;
  height: 100%;
  overflow: hidden;
  font-size: var(--play-detail-lrc-font-size, 16px);
  cursor: grab;
  -webkit-mask-image: linear-gradient(transparent 0%, #fff 20%, #fff 80%, transparent 100%);
  mask-image: linear-gradient(transparent 0%, #fff 20%, #fff 80%, transparent 100%);
  &.draging {
    cursor: grabbing;
  }
  :global {
    .font-lrc {
      color: @unplay-color;
      word-break: normal;
      overflow-wrap: anywhere;
    }
    .line-content {
      padding: calc(var(--play-detail-lrc-font-size, 16px) / 1.8) 8% calc(var(--play-detail-lrc-font-size, 16px) / 1.8) 1px;
      line-height: 1.2;
      color: @unplay-color;
      overflow-wrap: break-word;
      text-shadow:
        0 0 2px var(--color-primary-light-100-alpha-900),
        0 0 3px var(--color-primary-light-100-alpha-900),
        0 0 4px var(--color-primary-dark-700-alpha-900);
      transition: @transition-slow !important;
      transition-property: padding, transform !important;
      &.active {
        padding-top: calc(var(--play-detail-lrc-font-size, 16px) * 1.2);
        padding-bottom: calc(var(--play-detail-lrc-font-size, 16px) * 1.2);
      }
      .extended {
        margin-top: 5px;
        font-size: 0.8em;
      }
      &.line-mode {
        .font-lrc {
          transition: @transition-normal;
          transition-property: color;
        }
      }
      &.font-mode {
        color: @unplay-font-color;
      }
      &.line-mode.active .font-lrc,
      &.font-mode.played .font-lrc {
        color: @played-color;
      }
      &.font-mode .extended .font-lrc {
        transition: @transition-slow;
        transition-property: color;
      }
      &.font-mode > .line > .font-lrc {
        > span {
          font-size: 1em;
          background-color: @unplay-font-color;
          background-image: -webkit-linear-gradient(top, @played-color, @played-color);
          background-image: linear-gradient(to bottom, @played-color, @played-color);
          background-repeat: no-repeat;
          -webkit-background-clip: text;
          background-clip: text;
          background-size: 0 100%;
          transition: @transition-normal;
          transition-property: font-size;
          -webkit-text-fill-color: transparent;
        }
      }
    }
  }
}
.fontWeight {
  :global {
    .line-content {
      font-weight: bold;
    }
  }
}
.lrcActiveZoom {
  :global {
    .line-content {
      &.active {
        transform: scale(1.1);
      }
    }
  }
  &.text-left {
    :global {
      .line-content {
        padding-right: 12%;
        transform-origin: 0%;
      }
    }
  }
  &.text-center {
    :global {
      .line-content {
        padding-right: 6%;
        padding-left: 6%;
      }
    }
  }
  &.text-right {
    :global {
      .line-content {
        padding-left: 12%;
        transform-origin: 100%;
      }
    }
  }
}
.text-left,
.text-center,
.text-right {
  opacity: 1;
}

.skip {
  position: absolute;
  top: calc(38% + var(--play-detail-lrc-font-size, 16px) + 4px);
  left: 0;
  width: 100%;
  pointer-events: none;
  .line {
    margin-right: 8%;
    border-top: 2px dotted var(--color-primary-dark-100);
    opacity: 0.15;
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, transparent 15%, #fff 100%);
    mask-image: linear-gradient(90deg, transparent 0%, transparent 15%, #fff 100%);
  }
  .label {
    position: absolute;
    top: -16px;
    right: 8%;
    font-size: 13px;
    line-height: 1.2;
    color: var(--color-primary-dark-100);
    opacity: 0.7;
  }
  .skipBtn {
    position: absolute;
    top: 0;
    right: -2%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 12%;
    height: auto;
    aspect-ratio: 1 / 1;
    padding: 0;
    pointer-events: initial;
    background: none !important;
    opacity: 0.8;
    transform: translateY(-50%);
    transition: @transition-normal;
    transition-property: opacity;
    &:hover {
      opacity: 0.6;
    }
  }
}
.lyricSelectContent {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 100%;
  font-size: var(--play-detail-lrc-font-size, 16px);
  z-index: 10;
  color: var(--color-400);

  .lyricSelectline {
    padding: calc(var(--play-detail-lrc-font-size, 16px) / 2) 8% calc(var(--play-detail-lrc-font-size, 16px) / 2) 1px;
    overflow-wrap: break-word;
    transition: @transition-normal !important;
    transition-property: color, font-size;
    line-height: 1.3;
  }
  .lyricSelectlineExtended {
    font-size: 0.8em;
  }
  .lrcActive {
    color: var(--color-primary);
  }
}

.lyricSpace {
  height: 60%;
}
</style>
