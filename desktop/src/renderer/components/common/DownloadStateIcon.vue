<template>
  <!-- Download icon of an album / playlist: a ring around it fills up while its songs download,
       and stays at the part that is downloaded when only some of them are (partial) -->
  <span :class="[$style.wrap, { [$style.active]: downloading, [$style.partial]: isPartial }]">
    <svg-icon :name="done ? doneIcon : 'download'" />
    <svg v-if="downloading || isPartial" :class="$style.ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle :class="$style.track" cx="18" cy="18" r="16" />
      <circle :class="$style.bar" cx="18" cy="18" r="16" :style="{ strokeDashoffset: offset }" />
    </svg>
  </span>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'

const CIRCUMFERENCE = 2 * Math.PI * 16

const props = defineProps({
  downloading: {
    type: Boolean,
    default: false,
  },
  /** 0 - 1 */
  progress: {
    type: Number,
    default: 0,
  },
  done: {
    type: Boolean,
    default: false,
  },
  doneIcon: {
    type: String,
    default: 'download_done',
  },
  /** part of the songs that is downloaded (0 - 1) when only some of them are, null otherwise */
  partial: {
    type: Number,
    default: null,
  },
})

const isPartial = computed(() => props.partial != null && !props.downloading && !props.done)
const offset = computed(() => CIRCUMFERENCE * (1 - Math.min(Math.max(isPartial.value ? props.partial : props.progress, 0.02), 1)))
</script>

<style lang="less" module>
.wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
// the download has started: the icon takes the theme color
.active {
  color: var(--color-primary);
  transition: color 0.3s ease;
}
// the svg size of the buttons is overridden: the ring goes around the circle of the icon, clear of it
.wrap .ring.ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  pointer-events: none;
  transform: translate(-50%, -50%) rotate(-90deg);
  circle {
    fill: none;
    stroke-width: 2.6;
  }
}
.partial {
  // the whole ring is shown faintly, the downloaded part in the icon color
  .track {
    stroke: currentColor;
    stroke-opacity: 0.22;
  }
  .bar {
    stroke: currentColor;
  }
}
.track {
  stroke: var(--color-primary-light-300-alpha-700);
}
.bar {
  stroke: var(--color-primary);
  stroke-linecap: round;
  stroke-dasharray: 100.53;
  transition: stroke-dashoffset 0.4s ease;
}
</style>
