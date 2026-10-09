<template>
  <div :class="$style.times">
    <span>{{ nowPlayTimeStr }}</span>
    <span class="dv">/</span>
    <span>{{ maxPlayTimeStr }}</span>
  </div>
</template>

<script setup>
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'

// Ported from Any Listen: components/layout/PlayBar/components/Times.svelte
const { nowPlayTimeStr, maxPlayTimeStr } = usePlayProgress()
</script>

<style lang="less" module>
.times {
  flex: none;
  padding-left: 10px;
  font-size: 13px;
  color: var(--color-550);
}
</style>
