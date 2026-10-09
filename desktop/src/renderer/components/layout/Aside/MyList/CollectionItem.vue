<template>
  <div
    :class="[$style.container, { [$style.active]: active }]" role="button" tabindex="0" :aria-label="collection.name"
    @keydown.enter.prevent.stop="$emit('select')" @keydown.space.prevent.stop="$emit('select')" @click="$emit('select')"
  >
    <div :class="[$style.left, { [$style.round]: collection.type == 'artist' }]" :style="picStyle">
      <base-image :src="collection.img" :icon="collection.type == 'artist' ? 'dj' : 'albums'" />
    </div>
    <div :class="$style.right">
      <span><common-translatable-text :text="collection.name" replace /></span>
      <div :class="$style.meta">
        <span>{{ $t(collection.type == 'artist' ? 'collection__type_artist' : 'collection__type_album') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// A collected album / artist in the sidebar: opens its page (store/list/collections.ts)
defineProps({
  collection: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  picStyle: {
    type: Object,
    required: true,
  },
})
defineEmits(['select'])
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
.left {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: @radius-border;
  :global(.pic.empty-pic) {
    color: var(--color-primary-light-100-alpha-400);
    background-color: var(--color-primary-light-200-alpha-700);
  }
}
.round {
  border-radius: 50%;
  :global(.pic) {
    border-radius: 50%;
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
  gap: 8px;
  font-size: 12px;
  color: var(--color-font-label);
}
</style>
