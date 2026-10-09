<template>
  <span :class="['badge', $style.badge, $style[type]]" :style="type == 'primary' ? { opacity } : null">{{ label }}</span>
</template>

<script>
// Ported from Any Listen: components/base/Badge.svelte
export default {
  props: {
    label: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      default: 'primary',
    },
    opacity: {
      type: Number,
      default: 1,
    },
  },
}
</script>

<style lang="less" module>
.badge {
  display: inline-block;
  padding: 0.25em 0.4em;
  font-size: 0.7em;
  line-height: 1.2;
  vertical-align: text-top;
  text-align: center;
  white-space: nowrap;
}
.primary {
  color: var(--color-badge-primary);
}
.secondary {
  color: var(--color-badge-secondary);
}
.tertiary {
  color: var(--color-badge-tertiary);
}
</style>
