<template>
  <div :class="$style.noItem">
    <p>{{ label || $t('no_item') }}</p>
  </div>
</template>

<script>
// Ported from Any Listen: components/material/Empty.svelte
export default {
  props: {
    label: {
      type: String,
      default: '',
    },
  },
}
</script>

<style lang="less" module>
.noItem {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  height: 100%;
  p {
    margin-top: -10%;
    font-size: var(--font-size, 1.5rem);
    color: var(--color-font-label);
  }
}
</style>
