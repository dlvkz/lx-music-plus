<template>
  <div :class="$style.container">
    <common-player-music-heart-btn />
    <common-playlist-btn />
    <common-volume-btn />
    <common-toggle-play-mode-btn />
    <common-desktop-lyric-btn />
  </div>
</template>

<style lang="less" module>
// Ported from Any Listen: components/layout/PlayBar/components/ControlBtns.svelte
.container {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 15px;
  padding-right: 10px;
  padding-left: 20px;
}
</style>
