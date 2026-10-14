<template>
  <div :class="$style.container">
    <button type="button" :class="$style.btn" :aria-label="$t('player__pic_tip')" @click="showPlayerDetail" @contextmenu="handleToMusicLocation">
      <base-image decoding="auto" loading="eager" :src="displayPic" @error="handleError" />
    </button>
  </div>
</template>

<script setup>
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
// (the cover shown: the one before stays until the new one is loaded)
import { displayPic } from '@renderer/core/displayPic'
import { setMusicInfo, setShowPlayerDetail } from '@renderer/store/player/action'

// Ported from Any Listen: components/layout/PlayBar/components/Pic.svelte
const router = useRouter()

const showPlayerDetail = () => {
  if (!playMusicInfo.musicInfo) return
  setShowPlayerDetail(true)
}
const handleError = () => {
  setMusicInfo({ pic: null })
}
const handleToMusicLocation = () => {
  const listId = playMusicInfo.listId
  if (!listId || listId == LIST_IDS.DOWNLOAD || !playMusicInfo.musicInfo) return
  if (playInfo.playIndex == -1) return
  void router.push({
    path: '/list',
    query: {
      id: listId,
      scrollIndex: playInfo.playIndex,
    },
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  flex: none;
  min-width: 0;
  height: 100%;
  padding: 8px 10px;
}
.btn {
  display: block;
  height: 100%;
  aspect-ratio: 1;
  padding: 0;
  cursor: pointer;
  background: none;
  border: none;
  transition: opacity @transition-fast;

  &:hover {
    opacity: 0.6;
  }
}
</style>
