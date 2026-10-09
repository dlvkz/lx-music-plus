<template>
  <div :class="['left', $style.leftInfo]">
    <CoverSquare v-if="appSetting['playDetail.coverStyle'] === 'square'" :class="$style.cover" @click="toggleCoverStyle" />
    <CoverCD v-else :class="$style.cover" @click="toggleCoverStyle" />
    <Info />
  </div>
</template>

<script setup>
import { appSetting, updateSetting } from '@renderer/store/setting'
import CoverCD from './CoverCD.vue'
import CoverSquare from './CoverSquare.vue'
import Info from './Info.vue'
// Ported from Any Listen: components/layout/PlayDetail/LeftInfo/{index,Cover}.svelte

const toggleCoverStyle = () => {
  updateSetting({ 'playDetail.coverStyle': appSetting['playDetail.coverStyle'] === 'square' ? 'cd' : 'square' })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.cover {
  cursor: pointer;
}
.leftInfo {
  display: flex;
  flex: none;
  flex-flow: column nowrap;
  align-items: center;
  width: 50%;
  padding: 14px 15px 14px 20px;
  contain: strict;
  transition: width @transition-normal;
  --content-width: 72%;
}
</style>
