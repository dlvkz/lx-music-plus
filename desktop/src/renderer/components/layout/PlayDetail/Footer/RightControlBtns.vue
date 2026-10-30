<template>
  <div :class="$style.container">
    <common-player-music-heart-btn />
    <common-playlist-btn />
    <common-toggle-play-mode-btn />
    <common-volume-btn />
  </div>
</template>

<style lang="less" module>
// Ported from Any Listen: components/layout/PlayDetail/Footer/RightControlBtns.svelte
.container {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 15px;
}
</style>
