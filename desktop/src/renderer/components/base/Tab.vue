<template>
  <div :class="[$style.list, $style[align], { [$style.min]: min, [$style.disabled]: disabled }]" role="tablist">
    <button
      v-for="item in list"
      :key="item[itemKey]" :class="[$style.listItem, { [$style.active]: modelValue == item[itemKey] }]" tabindex="0" role="tab"
      :aria-label="item[itemLabel]" ignore-tip :aria-selected="modelValue == item[itemKey]" @click="handleToggle(item[itemKey])"
    >
      <span :class="$style.label">
        <svg-icon v-if="itemIcon && item[itemIcon]" :name="item[itemIcon]" />
        {{ item[itemLabel] }}
      </span>
    </button>
  </div>
</template>

<script>
// Ported from Any Listen: components/base/Tab.svelte
export default {
  props: {
    list: {
      type: Array,
      default() {
        return []
      },
    },
    align: {
      type: String,
      default: 'left',
    },
    itemKey: {
      type: String,
      default: 'id',
    },
    itemLabel: {
      type: String,
      default: 'label',
    },
    itemIcon: {
      type: String,
      default: '',
    },
    modelValue: {
      type: [String, Number],
      default: '',
    },
    min: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const handleToggle = id => {
      if (id == props.modelValue) return
      emit('update:modelValue', id)
      emit('change', id)
    }
    return {
      handleToggle,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.list {
  display: flex;
  flex-flow: row nowrap;
  gap: 24px;
  font-size: 12px;
  &.left {
    justify-content: flex-start;
  }
  &.center {
    justify-content: center;
  }
  &.right {
    justify-content: flex-end;
  }
  &.min {
    gap: 12px;
  }
  &.disabled {
    pointer-events: none;
    opacity: 0.5;
  }
}
.listItem {
  display: block;
  padding: 0;
  font-size: inherit;
  cursor: pointer;
  background-color: transparent;
  border: none;
  transition: color @transition-normal;
  &:hover {
    color: var(--color-primary);
  }
  &.active {
    color: var(--color-primary);
    cursor: default;
    > .label {
      &::after {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
}
.label {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  gap: 4px;
  align-items: center;
  padding: 8px 1px;
  &::after {
    .mixin-after();
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background-color: var(--color-primary-alpha-300);
    border-radius: 20px;
    opacity: 0;
    transform: translateY(-4px);
    transition: @transition-fast;
    transition-property: transform, opacity;
  }
}
</style>
