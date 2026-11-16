<template>
  <!-- the lists to add songs to, in a popup at the place clicked (the item of a menu), like the queue: not a dialog
       over the whole window anymore -->
  <base-popup v-model:visible="visible" :btn-el="anchor" :max-height="440">
    <ListAddPanel
      v-if="render" :music-list="musicList" :exclude-list-id="excludeListId" :from-list-id="fromListId" :is-move="isMove"
      @close="visible = false" @confirm="$emit('confirm')"
    />
  </base-popup>
</template>

<script>
import { ref, watch, nextTick } from '@common/utils/vueTools'
import ListAddPanel from './ListAddPanel.vue'

// where the pointer was last pressed: the popup opens there (the menu item that opened it is gone by then)
const pointer = { x: 0, y: 0 }
document.addEventListener('mousedown', event => {
  pointer.x = event.clientX
  pointer.y = event.clientY
}, true)
</script>

<script setup>

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  musicList: {
    type: Array,
    required: true,
  },
  excludeListId: {
    type: Array,
    default() {
      return []
    },
  },
  fromListId: {
    type: String,
    default: null,
  },
  isMove: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['update:show', 'confirm'])

const visible = ref(false)
const render = ref(false)
const anchor = ref(null)

watch(() => props.show, show => {
  if (!show) {
    visible.value = false
    return
  }
  if (!props.musicList.length) {
    emit('update:show', false)
    return
  }
  const { x, y } = pointer
  anchor.value = { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }) }
  render.value = true
  // (after the click that opened it: a click closes the popup)
  void nextTick(() => {
    setTimeout(() => {
      if (props.show) visible.value = true
    })
  })
})
watch(visible, isVisible => {
  if (isVisible) return
  if (props.show) emit('update:show', false)
  setTimeout(() => {
    if (!visible.value) render.value = false
  }, 200)
})
</script>
