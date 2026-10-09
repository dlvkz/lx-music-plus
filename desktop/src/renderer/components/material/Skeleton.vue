<template>
  <div :class="[$style.skeleton, type == 'grid' ? $style.grid : $style.rows]" :style="gridStyle" aria-hidden="true">
    <template v-if="type == 'grid'">
      <div v-for="i in count" :key="i" :class="$style.card">
        <div :class="[$style.block, $style.cover]" />
        <div :class="[$style.block, $style.line]" :style="{ width: widths[i % widths.length] }" />
      </div>
    </template>
    <template v-else>
      <div v-for="i in count" :key="i" :class="$style.row" :style="rowStyle">
        <div :class="[$style.block, $style.pic]" :style="picStyle" />
        <div :class="$style.text">
          <div :class="[$style.block, $style.line]" :style="{ width: widths[i % widths.length] }" />
          <div :class="[$style.block, $style.line, $style.sub]" :style="{ width: widths[(i + 2) % widths.length] }" />
        </div>
        <div :class="[$style.block, $style.time]" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'

// Placeholder shown while a list loads for the first time: blocks with the shape of what is coming
const props = defineProps({
  type: {
    type: String,
    default: 'rows',
  },
  count: {
    type: Number,
    default: 12,
  },
  /**
   * grid: the same column rule as the grid it stands for (minmax(minWidth, 1fr)), gap and padding
   */
  minWidth: {
    type: Number,
    default: 128,
  },
  gap: {
    type: String,
    default: '16px 14px',
  },
  padding: {
    type: String,
    default: '',
  },
  /**
   * rows: the height of the rows of the list they stand for, and the size of their picture
   */
  rowHeight: {
    type: Number,
    default: 52,
  },
  picSize: {
    type: Number,
    default: 40,
  },
})
const rowStyle = computed(() => ({ height: `${props.rowHeight}px` }))
const picStyle = computed(() => ({ width: `${props.picSize}px`, height: `${props.picSize}px` }))
const gridStyle = computed(() => props.type == 'grid'
  ? { gridTemplateColumns: `repeat(auto-fill, minmax(${props.minWidth}px, 1fr))`, gap: props.gap, padding: props.padding || undefined }
  : (props.padding ? { padding: props.padding } : undefined))
const widths = ['45%', '70%', '55%', '35%', '62%']
</script>

<style lang="less" module>
.skeleton {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  animation: pulse 1.4s ease-in-out infinite;
}
.rows {
  display: flex;
  flex-flow: column nowrap;
}
.grid {
  display: grid;
  align-content: flex-start;
}
.block {
  // a tint of the text color: darker on a light background, lighter on a dark one
  background-color: color-mix(in srgb, var(--color-font) 11%, transparent);
  border-radius: 6px;
}
.rows {
  padding: 0;
}
// laid out like a song row (common/MusicListItem.vue): 5px padding, 10px between the parts
.row {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 10px;
  align-items: center;
  padding: 5px;
}
.pic {
  flex: none;
  border-radius: 6px;
}
.text {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  gap: 8px;
}
.line {
  height: 12px;
}
.sub {
  height: 9px;
}
.time {
  flex: none;
  width: 34px;
  height: 10px;
}
.card {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  align-items: center;
}
.cover {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 12px;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
</style>
