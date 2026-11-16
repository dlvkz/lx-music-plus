<template>
  <!-- + next to the song of the play bar: the lists to add it to, in a popup like the queue -->
  <button ref="btnRef" type="button" :class="$style.btn" :aria-label="$t('player__add_music_to')" @click.stop="handleToggle">
    <svg-icon name="plus" />
  </button>
  <base-popup v-model:visible="visible" :btn-el="btnRef" :max-height="440">
    <ListAddPanel v-if="render" :music-list="[musicInfo]" @close="visible = false" />
  </base-popup>
</template>

<script setup>
import { ref, watch, nextTick } from '@common/utils/vueTools'
import ListAddPanel from './ListAddPanel.vue'

const props = defineProps({
  musicInfo: {
    type: Object,
    required: true,
  },
})

const btnRef = ref(null)
const visible = ref(false)
const render = ref(false)

const handleToggle = () => {
  if (visible.value) {
    visible.value = false
    return
  }
  render.value = true
  void nextTick(() => {
    visible.value = true
  })
}
watch(visible, isVisible => {
  if (isVisible) return
  setTimeout(() => {
    if (!visible.value) render.value = false
  }, 200)
})
// another song: the popup is closed
watch(() => props.musicInfo.id, () => {
  visible.value = false
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--color-button-font);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 50%;
  :global(.svg-icon) {
    width: 20px;
    height: 20px;
    // (raised over a dynamic background that needs it: core/coverTone.ts)
    opacity: var(--secondary-icon-opacity, 0.5);
    transition: opacity @transition-fast;
  }
  &:hover :global(.svg-icon) {
    opacity: 0.9;
  }
  &:active :global(.svg-icon) {
    opacity: 1;
  }
}
</style>
