<template>
  <!-- the volume: always shown, the icon mutes / unmutes, the wheel changes it too -->
  <div :class="$style.container" @wheel="handleWheel">
    <button :class="$style.btn" :aria-label="label" @click="handleToggleMute">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use :xlink:href="icon" />
      </svg>
    </button>
    <base-slider-bar
      :class="[$style.slider, { [$style.sliderMuted]: isMute }]" :aria-label="label"
      :value="volume" :min="0" :max="1" :step="0.01" :disabled="noAudioDevice" @change="handleUpdateVolume"
    />
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
// import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
// import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
// import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { saveVolumeIsMute } from '@renderer/store/setting'
import { volume, isMute, noAudioDevice } from '@renderer/store/player/volume'

const handleWheel = (event) => {
  window.app_event.setVolume(Math.round(volume.value * 100 + (-event.deltaY / 100 * 2)) / 100)
}

const handleUpdateVolume = (val) => {
  // (set while muted: heard again)
  if (isMute.value) saveVolumeIsMute(false)
  window.app_event.setVolume(val)
}

const handleToggleMute = () => {
  if (noAudioDevice.value) return
  saveVolumeIsMute(!isMute.value)
}

// (no audio output device: muted, its tip tells why)
const label = computed(() => {
  if (noAudioDevice.value) return window.i18n.t('media_device__empty_device_tip')
  return isMute.value ? window.i18n.t('player__volume_muted') : `${window.i18n.t('player__volume')}${Math.trunc(volume.value * 100)}%`
})

const icon = computed(() => {
  return isMute.value || noAudioDevice.value
    ? '#icon-volume-mute'
    : volume.value == 0
      ? '#icon-volume-off'
      : volume.value < 0.3
        ? '#icon-volume-low'
        : volume.value < 0.7
          ? '#icon-volume-medium'
          : '#icon-volume-high'
})

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.container {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  gap: 8px;
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
    // (raised over a dynamic background that needs it: core/coverTone.ts)
    opacity: var(--secondary-icon-opacity, 0.5);
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

.slider {
  width: 60px;
}
// muted: the volume it comes back to, dimmed
.sliderMuted {
  opacity: 0.4;
}

</style>
