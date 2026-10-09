<template>
  <div :class="$style.sourceList">
    <div :class="[$style.list, 'scroll', 'hide-scrollbar']">
      <div
        v-for="source in list" :key="source[itemKey]" role="button" tabindex="0"
        :class="[$style.listItem, { [$style.active]: source[itemKey] == modelValue }]" :aria-label="source[itemLabel]"
        @keydown.enter="handleChange(source)" @click="handleChange(source)"
      >
        <svg-icon v-if="source[itemKey] == modelValue" name="angle-right-solid" />
        {{ source[itemLabel] }}
      </div>
    </div>
  </div>
</template>

<script>
// Ported from Any Listen: views/Online/Source.svelte
export default {
  props: {
    list: {
      type: Array,
      required: true,
    },
    modelValue: {
      type: [String, Number],
      default: '',
    },
    itemKey: {
      type: String,
      default: 'id',
    },
    itemLabel: {
      type: String,
      default: 'name',
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const handleChange = (source) => {
      const id = source[props.itemKey]
      if (id == props.modelValue) return
      emit('update:modelValue', id)
      emit('change', id)
    }
    return {
      handleChange,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.sourceList {
  flex: none;
  width: 15%;
  min-width: 50px;
  max-width: 200px;
  margin-bottom: 12px;
  margin-left: 12px;
  overflow: hidden;
  background-color: var(--color-primary-light-300-alpha-900);
  border-radius: @radius-border;
}
.list {
  height: 100%;
}
.listItem {
  position: relative;
  display: block;
  padding: 0 10px;
  font-size: 13px;
  line-height: 36px;
  background-color: transparent;
  border-radius: @radius-border;
  transition: 0.3s ease;
  transition-property: color, background-color;
  .mixin-ellipsis-1();
  &:hover:not(.active) {
    cursor: pointer;
    background-color: var(--color-primary-background-hover);
  }
  &.active {
    color: var(--color-primary);
  }
  & > :global(svg) {
    width: 0.9em;
    height: 0.9em;
    margin-left: -0.45em;
    vertical-align: -0.05em;
  }
}
</style>
