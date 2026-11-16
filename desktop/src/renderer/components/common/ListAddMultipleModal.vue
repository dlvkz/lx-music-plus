<template>
  <!-- (a popup at the place clicked: ListAddPopup.vue) -->
  <ListAddPopup
    :show="show" :music-list="musicList" :exclude-list-id="excludeListId" :from-list-id="fromListId" :is-move="isMove"
    @update:show="$emit('update:show', $event)" @confirm="$emit('confirm')"
  />
</template>

<script setup>
import ListAddPopup from './ListAddPopup.vue'

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  musicList: {
    type: Array,
    default() {
      return []
    },
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
defineEmits(['update:show', 'confirm'])
</script>
