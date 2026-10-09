<template>
  <img
    v-if="src && !isError" :src="src" :class="[$style.img, 'pic', 'img', { [$style.loadingPic]: !isLoaded }]" :alt="alt"
    :style="{ width, height }" :loading="loading" :decoding="decoding" draggable="false" @error="handleError" @load="handleLoad"
  >
  <div v-else-if="pending" :style="{ width, height }" :class="[$style.emptyPic, $style.loadingPic, 'pic', 'empty-pic']" />
  <div v-else :style="{ width, height }" :class="[$style.emptyPic, 'pic', 'empty-pic']">
    <svg version="1.1" viewBox="0 0 192 192" width="78%">
      <use :xlink:href="`#icon-${icon}`" />
    </svg>
  </div>
</template>

<script>
import { ref, watch } from '@common/utils/vueTools'

// pictures that were loaded once in this run: the browser has them
const loadedUrls = new Set()

// Ported from Any Listen: components/base/Image.svelte
export default {
  props: {
    src: {
      type: String,
      default: null,
    },
    alt: {
      type: String,
      default: 'PIC',
    },
    icon: {
      type: String,
      default: 'night_landscape',
    },
    /**
     * the picture is still being looked up: a pulsing square instead of the icon while there is no src
     */
    pending: {
      type: Boolean,
      default: false,
    },
    width: {
      type: String,
      default: '100%',
    },
    height: {
      type: String,
      default: '100%',
    },
    loading: {
      type: String,
      default: 'lazy',
    },
    decoding: {
      type: String,
      default: 'async',
    },
  },
  emits: ['error'],
  setup(props, { emit }) {
    const isError = ref(false)
    // the picture is a pulsing square until it is loaded, a picture loaded before is shown at once
    const isLoaded = ref(!!props.src && loadedUrls.has(props.src))
    watch(() => props.src, (src) => {
      isLoaded.value = !!src && loadedUrls.has(src)
      if (src) isError.value = false
    })
    const handleLoad = () => {
      isLoaded.value = true
      if (props.src) loadedUrls.add(props.src)
    }
    const handleError = () => {
      isError.value = true
      emit('error')
    }
    return {
      isError,
      isLoaded,
      handleLoad,
      handleError,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.img {
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: @radius-border;
  box-shadow: 0 0 2px var(--color-primary-dark-200-alpha-800);
}
.loadingPic {
  background-color: color-mix(in srgb, var(--color-font) 11%, transparent);
  box-shadow: none;
  animation: pulse 1.4s ease-in-out infinite;
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
.emptyPic {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  color: var(--color-primary-light-400-alpha-400);
  user-select: none;
  background-color: var(--color-primary-light-200-alpha-900);
  border-radius: @radius-border;
  box-shadow: 0 0 2px var(--color-primary-dark-200-alpha-800);
}
</style>
