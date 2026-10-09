<template>
  <div :class="$style.header">
    <div :class="$style.btns">
      <base-btn min :disabled="!musicCount || disabled" icontext @click="$emit('play')">
        <svg-icon name="play" />
        {{ $t('play_all') }}
      </base-btn>
      <base-btn min :disabled="!musicCount || disabled" icontext @click="$emit('playrandom')">
        <svg-icon name="list-random" />
        {{ $t('play_random') }}
      </base-btn>
      <slot name="left" />
    </div>
    <div :class="$style.btns">
      <base-btn min :outline="!multimode" icon :aria-label="multimode ? $t('batch_select_exit') : $t('batch_select')" @click="$emit('multi')">
        <svg-icon name="multiple" />
      </base-btn>
      <base-btn min :outline="!finding" icon :aria-label="finding ? $t('find_music_exit') : $t('find_music')" @click="$emit('find')">
        <svg-icon name="search" />
      </base-btn>
    </div>
  </div>
</template>

<script>
// Ported from Any Listen: components/common/MusicList/MiniHeader.svelte
export default {
  props: {
    musicCount: {
      type: Number,
      required: true,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    multimode: {
      type: Boolean,
      default: false,
    },
    finding: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['play', 'playrandom', 'multi', 'find'],
}
</script>

<style lang="less" module>
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  justify-content: space-between;
  padding: 0 15px 0 10px;
}
.btns {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 10px;
}
</style>
