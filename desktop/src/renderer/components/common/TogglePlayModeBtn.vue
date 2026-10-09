<template>
  <material-popup-btn ref="btn_ref" :class="$style.btnContent">
    <button :class="$style.btn" :aria-label="isRadio ? $t('player__radio_play_mode') : nextTogglePlayName">
      <svg
        v-if="playMethod == 'listLoop'"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xlink="http://www.w3.org/1999/xlink"
        height="80%" viewBox="0 0 24 24" space="preserve"
      >
        <use xlink:href="#icon-list-loop" />
      </svg>
      <svg
        v-else-if="playMethod == 'random'"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xlink="http://www.w3.org/1999/xlink"
        width="100%" viewBox="0 0 24 24" space="preserve"
      >
        <use xlink:href="#icon-list-random" />
      </svg>
      <svg
        v-else-if="playMethod == 'list'"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xlink="http://www.w3.org/1999/xlink"
        width="100%" viewBox="0 0 32 32" space="preserve"
      >
        <use xlink:href="#icon-list-order" />
      </svg>
      <svg
        v-else-if="playMethod == 'singleLoop'"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        xlink="http://www.w3.org/1999/xlink"
        width="100%" viewBox="0 0 24 24" space="preserve"
      >
        <use xlink:href="#icon-list-single-loop" />
      </svg>
      <svg v-else version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-unavailable" />
      </svg>
    </button>
    <template #content>
      <!-- the radio: always in order (core/player/playMethod.ts) -->
      <p v-if="isRadio" :class="$style.radioTip">{{ $t('player__radio_play_mode') }}</p>
      <div v-else :class="$style.setting">
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_list_loop')" @click="toggleMode('listLoop')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-loop" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_random')" @click="toggleMode('random')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-random" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_list')" @click="toggleMode('list')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 32 32" space="preserve">
            <use xlink:href="#icon-list-order" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_single_loop')" @click="toggleMode('singleLoop')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-single-loop" />
          </svg>
        </button>
        <button :class="$style.btn" :aria-label="$t('player__play_toggle_mode_off')" @click="toggleMode('none')">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-unavailable" />
          </svg>
        </button>
      </div>
    </template>
  </material-popup-btn>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'
// import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
// import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
// import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { getPlayMethod, isRadioPlaying } from '@renderer/core/player/playMethod'
import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'

const btn_ref = ref(null)
// the mode used (the radio: list repeat, locked)
const playMethod = computed(getPlayMethod)
const isRadio = computed(isRadioPlaying)

const {
  nextTogglePlayName,
  toggleNextPlayMode,
} = useNextTogglePlay()

const toggleMode = (mode) => {
  btn_ref.value.hide()
  toggleNextPlayMode(mode)
}

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.btnContent {
  flex: none;
  height: 100%;
}

.btn {
  position: relative;
  // color: var(--color-button-font);
  justify-content: center;
  align-items: center;
  transition: color @transition-normal;
  cursor: pointer;
  background-color: transparent;
  border: none;
  width: 24px;
  display: flex;
  flex-flow: column nowrap;
  padding: 0;

  svg {
    transition: opacity @transition-fast;
    opacity: .5;
  }
  &:hover {
    svg {
      opacity: .9;
    }
  }
  &:active {
    svg {
      opacity: 1;
    }
  }
}

.setting {
  display: flex;
  flex-flow: row nowrap;
  font-size: 14px;
  gap: 10px;
}


.radioTip {
  width: 200px;
  padding: 2px 3px;
  font-size: 12px;
  line-height: 1.5;
}
</style>
