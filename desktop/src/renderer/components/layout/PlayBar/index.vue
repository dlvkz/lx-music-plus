<template>
  <MiniBar v-if="style == 'mini'" />
  <MiddleBar v-else-if="style == 'middle'" />
  <FullBar v-else-if="style == 'full'" />
  <CenterMiddleBar v-else-if="style == 'centerControlMiddle'" />
  <CenterFullBar v-else-if="style == 'centerControlFull'" />
  <CenterBar v-else />
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import MiniBar from './MiniBar.vue'
import MiddleBar from './MiddleBar.vue'
import FullBar from './FullBar.vue'
import CenterBar from './CenterBar.vue'
import CenterMiddleBar from './CenterMiddleBar.vue'
import CenterFullBar from './CenterFullBar.vue'

// Ported from Any Listen: components/layout/PlayBar/index.svelte
const style = computed(() => appSetting['common.playBarProgressStyle'])
</script>
