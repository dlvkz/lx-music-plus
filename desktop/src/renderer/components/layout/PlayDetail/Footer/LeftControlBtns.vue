<template>
  <div :class="$style.container">
    <common-sound-effect-btn />
    <common-playback-rate-btn />
    <div :class="[$style.icon, { [$style.active]: isShowPlayComment }]">
      <base-btn icon link :aria-label="$t('music_comment_btn')" @click="toggleVisibleComment">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 24 24">
          <use xlink:href="#icon-chat" />
        </svg>
      </base-btn>
    </div>
    <common-desktop-lyric-btn />
    <!-- LX Music only -->
    <div :class="[$style.icon, { [$style.active]: isShowLrcSelectContent }]">
      <base-btn icon link :aria-label="$t('lyric__select')" @click="toggleVisibleLrc">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 24 24">
          <use xlink:href="#icon-text" />
        </svg>
      </base-btn>
    </div>
    <div :class="[$style.icon, { [$style.active]: appSetting['player.audioVisualization'] }]">
      <base-btn icon link :aria-label="$t('audio_visualization')" @click="toggleAudioVisualization">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 24 24">
          <use xlink:href="#icon-audio-wave" />
        </svg>
      </base-btn>
    </div>
    <!-- the background of the page from the cover of the song -->
    <div :class="[$style.icon, { [$style.active]: appSetting['playDetail.isDynamicBackground'] }]">
      <base-btn icon link :aria-label="$t('setting__play_detail_dynamic_background')" @click="updateSetting({ 'playDetail.isDynamicBackground': !appSetting['playDetail.isDynamicBackground'] })">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 24 24">
          <use xlink:href="#icon-image" />
        </svg>
      </base-btn>
    </div>
    <div :class="$style.icon">
      <base-btn icon link :aria-label="$t('player__add_music_to')" @click="isShowAddMusicTo = true">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 512 512">
          <use xlink:href="#icon-add-2" />
        </svg>
      </base-btn>
    </div>
    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
  </div>
</template>

<script setup>
import { ref } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { isShowLrcSelectContent, isShowPlayComment, playMusicInfo } from '@renderer/store/player/state'
import { setShowPlayLrcSelectContentLrc, setShowPlayComment } from '@renderer/store/player/action'
import { dialog } from '@renderer/plugins/Dialog'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, setEnableAudioVisualization, updateSetting } from '@renderer/store/setting'

// Ported from Any Listen: components/layout/PlayDetail/Footer/LeftControlBtns.svelte
// (+ LX Music's lyric select, audio visualization and add-to-list buttons)
const t = useI18n()
const isShowAddMusicTo = ref(false)

const toggleVisibleLrc = () => {
  setShowPlayLrcSelectContentLrc(!isShowLrcSelectContent.value)
}
const toggleVisibleComment = () => {
  setShowPlayComment(!isShowPlayComment.value)
}
const toggleAudioVisualization = async() => {
  const newSetting = !appSetting['player.audioVisualization']
  if (newSetting && appSetting['player.mediaDeviceId'] != 'default') {
    const confirm = await dialog.confirm({
      message: t('setting__player_audio_visualization_tip'),
      cancelButtonText: t('cancel_button_text'),
      confirmButtonText: t('confirm_button_text'),
    })
    if (!confirm) return
    await setMediaDeviceId('default').catch(_ => _)
    saveMediaDeviceId('default')
  }
  setEnableAudioVisualization(newSetting)
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 15px;
}
// Any Listen: components/common/CommentBtn.svelte
.icon :global {
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: inherit !important;
    opacity: 0.5;
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
.active :global {
  .btn {
    color: var(--color-primary) !important;
    opacity: 0.9;
  }
}
</style>
