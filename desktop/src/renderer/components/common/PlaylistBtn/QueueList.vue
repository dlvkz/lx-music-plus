<template>
  <div :class="$style.container">
    <!-- what is playing comes from (a list, a playlist, an album, an artist, a chart, the radio...) -->
    <div v-if="playingFrom" :class="$style.from">
      <span :class="$style.fromLabel">{{ playingFrom.caption }}</span>
      <!-- the page it comes from (none: the radio) -->
      <span v-if="playingFrom.route" :class="[$style.fromName, $style.fromLink]" role="link" tabindex="0" @click="openPlayingFrom" @keydown.enter="openPlayingFrom">{{ playingFrom.name }}</span>
      <span v-else :class="$style.fromName">{{ playingFrom.name }}</span>
    </div>
    <base-virtualized-list
      v-if="queue.length" ref="listRef" v-slot="{ item, index }" :list="queue" key-name="key"
      :item-height="listItemHeight" container-class="scroll" content-class="list"
    >
      <ListItem
        :music-info="item.musicInfo" :list-id="item.listId" :pic-style="picStyle"
        :playing="item.isPlaying" :played="item.played" :play-later="item.playLater"
        @play="handlePlay(item, index)" @goto="handleGoto(item)" @navigate="$emit('close')"
      />
    </base-virtualized-list>
    <material-empty v-else />
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { appSetting } from '@renderer/store/setting'
import { playInfo, playMusicInfo, playedList, tempPlayList } from '@renderer/store/player/state'
import { getListMusicsFromCache } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { LIST_IDS } from '@common/constants'
import ListItem from './ListItem.vue'
import { getPlayingFrom } from '@renderer/store/list/playingFrom'
import { getPlayMethod } from '@renderer/core/player/playMethod'
import { getShuffleUpcoming } from '@renderer/core/player/shuffleOrder'

// Ported from Any Listen: components/common/PlaylistBtn/QueueList.svelte
export default {
  components: {
    ListItem,
  },
  emits: ['close'],
  setup(props, { emit }) {
    const router = useRouter()
    const listRef = ref(null)

    // Any Listen: useListItemHeight(3.2), pic = height * 0.8
    const listItemHeight = computed(() => Math.ceil(appSetting['common.fontSize'] * 3.2))
    const picStyle = computed(() => {
      const size = Math.ceil(listItemHeight.value * 0.8) + 'px'
      return { width: size, height: size }
    })

    const queue = computed(() => {
      const playedKeys = new Set(playedList.map(m => `${m.listId}_${m.musicInfo.id}`))
      const items = tempPlayList.map((info, index) => {
        const musicInfo = 'progress' in info.musicInfo ? info.musicInfo.metadata.musicInfo : info.musicInfo
        return { key: `later_${index}_${musicInfo.id}`, musicInfo, listId: info.listId, playLater: true, played: false, isPlaying: false, index: -1 }
      })
      const listId = playInfo.playerListId
      // shuffle: the song playing, then the ones it plays next in their order (core/player/shuffleOrder.ts)
      if (listId && listId != LIST_IDS.DOWNLOAD && getPlayMethod() == 'random') {
        const list = getListMusicsFromCache(listId)
        const indexes = new Map(list.map((musicInfo, index) => [musicInfo.id, index]))
        const currentId = playMusicInfo.listId == listId && !playMusicInfo.isTempPlay ? playMusicInfo.musicInfo?.id : null
        const playedIds = new Set(playedList.filter(m => m.listId == listId).map(m => m.musicInfo.id))
        const current = currentId ? list.find(m => m.id == currentId) : null
        for (const musicInfo of [...(current ? [current] : []), ...getShuffleUpcoming(listId, list, playedIds, currentId)]) {
          items.push({ key: musicInfo.id, musicInfo, listId, playLater: false, played: false, isPlaying: musicInfo.id == currentId, index: indexes.get(musicInfo.id) ?? -1 })
        }
        return items
      }
      if (listId && listId != LIST_IDS.DOWNLOAD) {
        getListMusicsFromCache(listId).forEach((musicInfo, index) => {
          items.push({
            key: musicInfo.id,
            musicInfo,
            listId,
            playLater: false,
            played: playedKeys.has(`${listId}_${musicInfo.id}`),
            isPlaying: playMusicInfo.listId == listId && playInfo.playerPlayIndex == index && !playMusicInfo.isTempPlay,
            index,
          })
        })
      }
      return items
    })

    const playingFrom = computed(() => {
      // (updated when the song changes: the temporary list can be another one)
      void playMusicInfo.musicInfo
      const from = getPlayingFrom(playInfo.playerListId)
      if (!from) return null
      const type = window.i18n.t(`player__from_${from.type}`)
      return from.name
        ? { caption: `${window.i18n.t('player__playing_from')} · ${type}`, name: from.name, route: from.route }
        : { caption: window.i18n.t('player__playing_from'), name: type, route: from.route }
    })
    const openPlayingFrom = () => {
      const route = playingFrom.value?.route
      if (!route) return
      emit('close')
      void router.push({ path: route.path, query: route.query })
    }

    const handlePlay = (item) => {
      if (item.playLater || item.index < 0) return
      playList(item.listId, item.index)
    }
    const handleGoto = (item) => {
      if (!item.listId) return
      emit('close')
      const index = getListMusicsFromCache(item.listId).findIndex(m => m.id == item.musicInfo.id)
      void router.push({ path: '/list', query: { id: item.listId, scrollIndex: index > -1 ? index : undefined } })
    }

    onMounted(() => {
      void nextTick(() => {
        const index = queue.value.findIndex(item => item.isPlaying)
        if (index > -1) listRef.value?.scrollToIndex(index, -100)
      })
    })

    return {
      listRef,
      queue,
      playingFrom,
      openPlayingFrom,
      listItemHeight,
      picStyle,
      handlePlay,
      handleGoto,
    }
  },
}
</script>

<style lang="less" module>
.container {
  display: flex;
  flex: auto;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
}
.from {
  flex: none;
  display: flex;
  flex-flow: column nowrap;
  gap: 2px;
  padding: 8px 12px 6px;
  min-width: 0;
}
.fromLabel {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-font-label);
}
.fromLink {
  align-self: flex-start;
  max-width: 100%;
  cursor: pointer;
  &:hover {
    color: var(--color-primary-font-hover);
    text-decoration: underline;
  }
}
.fromName {
  font-size: 14px;
  font-weight: bold;
  color: var(--color-font);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
