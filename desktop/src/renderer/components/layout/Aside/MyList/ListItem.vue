<template>
  <div
    :class="[$style.container, { [$style.active]: active }, { [$style.fetching]: fetching }]"
    role="button" tabindex="0"
    @keydown.enter.prevent.stop="$emit('select')" @keydown.space.prevent.stop="$emit('select')" @click="$emit('select')"
  >
    <div :class="$style.left" :style="picStyle">
      <base-image :src="cover" :icon="icon" />
    </div>
    <div :class="$style.right">
      <span>{{ name }}</span>
      <div :class="$style.meta">
        <span><svg-icon name="music" />{{ count }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { toRef } from '@common/utils/vueTools'
import useListMeta from '@renderer/utils/compositions/useListMeta'
import { LIST_IDS } from '@common/constants'

// Ported from Any Listen: components/layout/Aside/MyList/ListItem.svelte
const LIST_PIC_ICON = {
  [LIST_IDS.LOVE]: 'music_heart',
  [LIST_IDS.DEFAULT]: 'clock',
}

export default {
  props: {
    listId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    fetching: {
      type: Boolean,
      default: false,
    },
    picStyle: {
      type: Object,
      required: true,
    },
  },
  emits: ['select'],
  setup(props) {
    const { count, cover } = useListMeta(toRef(props, 'listId'))
    return {
      count,
      cover,
      icon: LIST_PIC_ICON[props.listId] ?? 'night_landscape',
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  gap: 6px;
  align-items: center;
  height: 100%;
  padding: 6px;
  background-color: transparent;
  border-radius: @radius-border;
  transition: 0.3s ease;
  transition-property: color, background-color, opacity;
  &:not(.active) {
    &:hover {
      cursor: pointer;
      background-color: var(--color-primary-background-hover);
    }
  }
}
.active {
  background-color: var(--color-primary-background);
}
.fetching {
  opacity: 0.5;
}

.left {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: @radius-border;

  :global(.pic.empty-pic) {
    color: var(--color-primary-light-100-alpha-400);
    background-color: var(--color-primary-light-200-alpha-700);
  }
}

.right {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  gap: 2px;
  min-width: 0;
  font-size: 14px;
  span {
    .mixin-ellipsis-1();
  }
}

.meta {
  display: flex;
  flex-flow: row nowrap;
  gap: 12px;
  font-size: 12px;
  color: var(--color-300);
}
</style>
