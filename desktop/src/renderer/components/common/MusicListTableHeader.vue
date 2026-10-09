<template>
  <div :class="$style.header">
    <div :class="$style.num" :style="{ width: picWidth + 'px' }">
      <base-checkbox
        v-if="multimode" id="music_list_select_all_checkbox" :aria-label="$t('select_all')"
        :model-value="selectAll" :disabled="disabledSelect" @update:model-value="$emit('selectall', !selectAll)"
      />
      <template v-else>#</template>
    </div>
    <span style="flex: auto;">{{ $t('music_name') }}</span>
    <span style="width: 22%;">{{ $t('music_singer') }}</span>
    <span style="width: 22%;">{{ $t('music_album') }}</span>
    <span style="width: 9%;">{{ $t('music_time') }}</span>
  </div>
</template>

<script>
// Ported from Any Listen: components/common/MusicList/List/Header.svelte
export default {
  props: {
    multimode: {
      type: Boolean,
      default: false,
    },
    selectAll: {
      type: Boolean,
      default: false,
    },
    disabledSelect: {
      type: Boolean,
      default: false,
    },
    picWidth: {
      type: Number,
      required: true,
    },
  },
  emits: ['selectall'],
}
</script>

<style lang="less" module>
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 10px;
  align-items: center;
  height: 36px;
  padding: 0 12px;
  font-size: 12px;
  color: var(--color-font-label);
  :global(.checkbox) {
    font-size: 14px;
  }
}
.num {
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  text-align: center;
}
</style>
