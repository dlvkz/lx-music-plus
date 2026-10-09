<template>
  <button
    :type="rawtype"
    :class="['btn', $style.btn, { [$style.min]: min, [$style.middle]: middle, [$style.outline]: outline, [$style.link]: link, [$style.icon]: icon, [$style.icontext]: icontext, [$style.loading]: loading }]"
    tabindex="0"
    :disabled="disabled || loading"
  >
    <slot />
  </button>
</template>

<script>
// Ported from Any Listen: components/base/Btn.svelte
export default {
  props: {
    min: {
      type: Boolean,
      default: false,
    },
    middle: {
      type: Boolean,
      default: false,
    },
    outline: {
      type: Boolean,
      default: false,
    },
    link: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: Boolean,
      default: false,
    },
    icontext: {
      type: Boolean,
      default: false,
    },
    rawtype: {
      type: String,
      default: 'button',
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 15px;
  font-size: 14px;
  color: var(--btn-font, var(--color-button-font));
  cursor: pointer;
  background-color: var(--color-button-background);
  border: none;
  border-radius: @form-radius;
  transition: @transition-normal;
  transition-property: background-color, opacity;
  &[disabled] {
    cursor: default;
    opacity: 0.4;
  }

  &.outline,
  &.link {
    background-color: transparent;
  }

  &:not(.link) {
    &:hover {
      background-color: var(--color-button-background-hover);
    }
    &:active {
      background-color: var(--color-button-background-active);
    }
  }
  &.link {
    padding: 0;
    transition-property: color, opacity;
    &:hover {
      color: var(--color-primary-font-hover);
    }
    &:active {
      color: var(--color-primary-font-active);
    }
  }

  &.icon {
    flex: none;
    width: var(--size, 2rem);
    height: var(--size, 2rem);
    padding: 5px;

    :global(svg) {
      width: 100%;
      height: 100%;
    }
    &.min {
      width: var(--size, 1.6rem);
      height: var(--size, 1.6rem);
    }
  }
  &.icontext {
    gap: 2px;
  }
}
.middle {
  padding: 6px 12px;
  font-size: 13px;
}
.min {
  padding: 2.5px 8px;
  font-size: 12px;
}
</style>
