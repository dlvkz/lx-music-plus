<template>
  <!-- (a popup at the place clicked: ListAddPopup.vue) -->
  <ListAddPopup
    :show="show" :music-list="musicInfo ? [musicInfo] : []" :exclude-list-id="excludeListId" :from-list-id="fromListId"
    :is-move="isMove" @update:show="$emit('update:show', $event)"
  />
</template>

<script setup>
import ListAddPopup from './ListAddPopup.vue'

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  musicInfo: {
    type: [Object, null],
    required: true,
  },
  // (a popup now: the background and the place of the dialog of before don't matter anymore)
  bgClose: {
    type: Boolean,
    default: true,
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
  teleport: {
    type: String,
    default: '#root',
  },
})
defineEmits(['update:show'])
</script>
