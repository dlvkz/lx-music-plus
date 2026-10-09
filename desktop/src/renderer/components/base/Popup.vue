<template>
  <component :is="Teleport" to="#root">
    <div
      :class="[$style.popup, {[$style.top]: isShowTop}, {[$style.active]: props.visible}]"
      :style="popupStyle"
      :aria-hidden="!props.visible"
      @click.stop
      @mouseenter="emit('mouseenter', $event)"
      @mouseleave="emit('mouseleave', $event)"
      @transitionend="emit('transitionend', $event)"
    >
      <div ref="dom_content" class="scroll" :class="$style.list" tabindex="-1">
        <slot />
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, reactive } from '@common/utils/vueTools'

// https://github.com/vuejs/core/issues/2855#issuecomment-768388962
import {
  Teleport as teleport_,
  type TeleportProps,
  type VNodeProps,
  type PropType,
} from 'vue'
const Teleport = teleport_ as new () => {
  $props: VNodeProps & TeleportProps
}

const props = defineProps({
  visible: { type: Boolean, required: true },
  btnEl: { type: [Function, Object] as PropType<(() => HTMLElement | null) | HTMLElement | null>, default: null },
  height: { type: String, default: '' },
  maxHeight: { type: Number, default: undefined },
})

interface Emitter {
  (event: 'update:visible', visible: boolean): void
  (event: 'mouseenter', visible: MouseEvent): void
  (event: 'mouseleave', visible: MouseEvent): void
  (event: 'transitionend', visible: TransitionEvent): void
}
const emit = defineEmits<Emitter>()

const dom_content = ref<HTMLElement | null>(null)
const isShowTop = ref(false)

const popupStyle = reactive({
  maxHeight: 'none',
  height: 'auto',
  top: '0px',
  left: '0px',
  '--arrow-left': '0px',
})

const arrowHeight = 9
const arrowWidth = 8
const sidePadding = 15

const getBtnEl = () => typeof props.btnEl === 'function' ? props.btnEl() : props.btnEl

watch(() => props.visible, (visible) => {
  const btnEl = getBtnEl()
  if (!visible || !dom_content.value || !btnEl) return
  const rect = btnEl.getBoundingClientRect()
  const rootOffset = window.lx.rootOffset
  // The popup is teleported to #root, which has `rootOffset` padding on each side
  // when the window is transparent. Keep the popup inside that padded viewport.
  const appWidth = window.innerWidth - rootOffset * 2
  const appHeight = window.innerHeight - rootOffset * 2
  const elTop = rect.top - rootOffset
  const elBottom = rect.bottom - rootOffset

  const contentHeight = dom_content.value.scrollHeight + arrowHeight + sidePadding
  const fixedHeightPx = props.height ? (() => {
    const val = parseFloat(props.height)
    if (props.height.endsWith('rem')) return val * parseFloat(getComputedStyle(document.documentElement).fontSize)
    if (props.height.endsWith('px')) return val
    return val
  })() : 0
  const preferredHeight = fixedHeightPx || contentHeight
  const spaceBelow = appHeight - elBottom
  const spaceAbove = elTop

  // Prefer below, but keep the popup fully inside the viewport.
  if (spaceBelow >= preferredHeight || spaceBelow >= spaceAbove) {
    isShowTop.value = false
    popupStyle.top = elBottom + arrowHeight + 'px'
    popupStyle.maxHeight = Math.max(0, Math.min(spaceBelow - arrowHeight, props.maxHeight ?? Infinity)) + 'px'
  } else {
    isShowTop.value = true
    const top = Math.max(0, elTop - arrowHeight - preferredHeight)
    popupStyle.top = top + 'px'
    popupStyle.maxHeight = Math.max(0, Math.min(spaceAbove - arrowHeight, props.maxHeight ?? Infinity)) + 'px'
  }

  if (props.height) popupStyle.height = props.height

  const maxWidth = appWidth - sidePadding
  let center = dom_content.value.clientWidth / 2
  let left = rect.left + rect.width / 2 - rootOffset - center
  if (left < sidePadding) {
    center -= sidePadding - left
    left = sidePadding
  } else if (left + dom_content.value.clientWidth > maxWidth) {
    let newLeft = maxWidth - dom_content.value.clientWidth
    center = center + left - newLeft
    left = newLeft
  }
  popupStyle.left = left + 'px'
  popupStyle['--arrow-left'] = center - arrowWidth + 'px'
})

const handleHide = (evt?: MouseEvent) => {
  // if (evt && (evt.target as HTMLElement)?.parentNode != dom_content.value && props.visible) return emit('update:visible', false)
  // console.log(this.$refs)
  // if (evt && (evt.target == dom_btn.value || dom_btn.value?.contains(evt.target as HTMLElement))) return
  // setTimeout(() => {
  //   popupVisible.value = false
  emit('update:visible', false)
  // }, 50)
}


onMounted(() => {
  document.addEventListener('click', handleHide)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleHide)
})

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.popup {
  position: absolute;
  // top: -100%;
  // width: 645px;
  // left: 8px;
  // margin-top: 12px;
  max-width: 98%;
  border-radius: 4px;
  background-color: var(--color-content-background);
  opacity: 0;
  transform: scale(.8);
  transform-origin: 50% 0 0;
  transition: .16s ease;
  transition-property: transform, opacity;
  max-height: 250px;
  z-index: 10;
  pointer-events: none;
  filter: drop-shadow(0px 0px 3px rgba(0, 0, 0, .12));
  display: flex;

  &:before {
    content: " ";
    position: absolute;
    top: -6px;
    left: var(--arrow-left);
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-bottom: 8px solid var(--color-content-background);
  }

  &.active {
    opacity: 1;
    transform: scale(1);
    pointer-events: initial;
  }

  &.top {
    filter: drop-shadow(0px 1px 3px rgba(0, 0, 0, .12));
    transform-origin: 50% 100% 0;

    &:before {
      top: 100%;
      border-bottom: none;
      border-top: 8px solid var(--color-content-background);
    }
  }
}
.list {
  min-height: 0;
  max-height: 100%;
  padding: 10px;
  outline: none;
  box-sizing: border-box;
  // box-shadow: 0 0 4px rgba(0, 0, 0, .2);
}

</style>
