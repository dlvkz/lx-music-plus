<template>
  <a :class="$style.card" role="link" @click="$emit('select', { title: name, ids: musicIds })">
    <div :class="$style.pic">
      <base-image :src="cover" :icon="icon" />
    </div>
    <h4><common-translatable-text :text="name" compact replace /></h4>
    <p>{{ $t('download__lib_progress', { done, total: count }) }}</p>
  </a>
</template>

<script setup>
import { computed, shallowRef, toRef, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getListMusics } from '@renderer/store/list/action'
import { getListDisplayName } from '@renderer/store/list/defaultListCustom'
import useListMeta from '@renderer/utils/compositions/useListMeta'

const LIST_PIC_ICON = {
  [LIST_IDS.LOVE]: 'music_heart',
  [LIST_IDS.DEFAULT]: 'clock',
}

const props = defineProps({
  listId: {
    type: String,
    required: true,
  },
  // ids of the songs whose download is finished
  completedIds: {
    type: Set,
    required: true,
  },
})
defineEmits(['select'])

const listId = toRef(props, 'listId')
const { count, cover } = useListMeta(listId)
const icon = LIST_PIC_ICON[props.listId] ?? 'night_landscape'
const name = computed(() => {
  if (props.listId == defaultList.id) return getListDisplayName(defaultList)
  if (props.listId == loveList.id) return getListDisplayName(loveList)
  return userLists.find(l => l.id == props.listId)?.name ?? ''
})

const musicIds = shallowRef(new Set())
const loadMusics = () => {
  void getListMusics(props.listId).then(list => {
    musicIds.value = new Set(list.map(m => m.id))
  })
}
const handleListUpdate = (ids) => {
  if (ids.includes(props.listId)) loadMusics()
}
watch(listId, loadMusics, { immediate: true })
window.app_event.on('myListUpdate', handleListUpdate)
onBeforeUnmount(() => {
  window.app_event.off('myListUpdate', handleListUpdate)
})

const done = computed(() => {
  let num = 0
  for (const id of musicIds.value) {
    if (props.completedIds.has(id)) num++
  }
  return num
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.card {
  display: block;
  min-width: 0;
  cursor: pointer;
  h4 {
    margin-top: 6px;
    font-size: 13px;
    line-height: 1.3;
    color: var(--color-font);
    .mixin-ellipsis-2();
  }
  p {
    margin-top: 2px;
    font-size: 12px;
    line-height: 1.3;
    color: var(--color-font-label);
    .mixin-ellipsis-1();
  }
  &:hover {
    .pic :global(.pic) {
      transform: scale(1.05);
    }
  }
}
.pic {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(.pic) {
    object-fit: cover;
    transition: transform 0.4s ease-out;
  }
  :global(.pic.empty-pic) {
    color: var(--color-primary-light-100-alpha-400);
    background-color: var(--color-primary-light-200-alpha-700);
  }
}
</style>
