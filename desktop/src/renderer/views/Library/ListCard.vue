<template>
  <a :class="$style.card" role="link" :aria-label="name" @click="$emit('select')">
    <div :class="$style.pic">
      <base-image :src="cover" :icon="icon" />
    </div>
    <h4><common-translatable-text :text="name" replace compact /></h4>
    <p>{{ count }} <svg-icon name="music" /></p>
  </a>
</template>

<script setup>
import { toRef } from '@common/utils/vueTools'
import useListMeta from '@renderer/utils/compositions/useListMeta'
import { LIST_IDS } from '@common/constants'

// One of the user's lists in the library grid: its cover, name and song count
const props = defineProps({
  listId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
})
defineEmits(['select'])

const { count, cover } = useListMeta(toRef(props, 'listId'))
const icon = props.listId == LIST_IDS.LOVE ? 'music_heart' : props.listId == LIST_IDS.DEFAULT ? 'clock' : 'night_landscape'
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.card {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  min-width: 0;
  text-decoration: none;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 0.7;
  }
  h4 {
    font-size: 13px;
    line-height: 1.3;
    color: var(--color-font);
    .mixin-ellipsis-2();
  }
  p {
    font-size: 12px;
    line-height: 1.2;
    color: var(--color-font-label);
    .mixin-ellipsis-1();
  }
}
.pic {
  display: flex;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(.pic) {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    box-shadow: none;
  }
  :global(img) {
    object-fit: cover;
  }
}
</style>
