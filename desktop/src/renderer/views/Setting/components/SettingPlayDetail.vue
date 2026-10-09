<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_dynamic_background" :model-value="appSetting['playDetail.isDynamicBackground']" :label="$t('setting__play_detail_dynamic_background')" @update:model-value="updateSetting({'playDetail.isDynamicBackground': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_font_weight" :model-value="appSetting['playDetail.style.fontWeight']" :label="$t('setting__play_detail_font_weight')" @update:model-value="updateSetting({'playDetail.style.fontWeight': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

dd
  h3#play_detail_cover_style {{ $t('setting__play_detail_cover_style') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_cover_style_cd" :model-value="appSetting['playDetail.coverStyle']" need value="cd" :label="$t('setting__play_detail_cover_style_cd')" @update:model-value="updateSetting({ 'playDetail.coverStyle': $event })")
    base-checkbox.gap-left(id="setting_play_detail_cover_style_square" :model-value="appSetting['playDetail.coverStyle']" need value="square" :label="$t('setting__play_detail_cover_style_square')" @update:model-value="updateSetting({ 'playDetail.coverStyle': $event })")

</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingPlayDetail',
  setup() {
    return {
      appSetting,
      updateSetting,
    }
  },
}
</script>
