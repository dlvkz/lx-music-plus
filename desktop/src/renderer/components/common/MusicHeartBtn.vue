<template>
  <div :class="['music-heart-btn', $style.musicHeartBtn, { [$style.unloved]: !loved }]">
    <base-btn :min="min" :link="link" icon outline :aria-label="loved ? $t('music_unlove') : $t('music_love')" @click.stop="handleClick">
      <!-- a grey outline, filled with the color of the theme when the song is loved (like the mobile app) -->
      <svg :class="$style.heart" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.6s-7.8-4.7-9.6-9.4C1.2 8 3.1 4.4 6.6 4.4c2.1 0 3.6 1.1 5.4 3.2 1.8-2.1 3.3-3.2 5.4-3.2 3.5 0 5.4 3.6 4.2 6.8-1.8 4.7-9.6 9.4-9.6 9.4z" />
      </svg>
    </base-btn>
  </div>
</template>

<script>
import { ref, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { addListMusics, removeListMusics, checkListExistMusic } from '@renderer/store/list/action'

// Ported from Any Listen: components/common/MusicHeartBtn.svelte
export default {
  props: {
    musicInfo: {
      type: Object,
      default: null,
    },
    min: {
      type: Boolean,
      default: false,
    },
    link: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const loved = ref(false)

    const handleLoveListChange = async() => {
      const id = props.musicInfo?.id
      const result = id ? await checkListExistMusic(LIST_IDS.LOVE, id) : false
      if (id == props.musicInfo?.id) loved.value = result
    }

    const handleClick = async() => {
      const musicInfo = props.musicInfo
      if (!musicInfo) return
      if (loved.value) {
        await removeListMusics({ listId: LIST_IDS.LOVE, ids: [musicInfo.id] })
      } else {
        await addListMusics(LIST_IDS.LOVE, [musicInfo])
      }
    }

    const handleListUpdate = (ids) => {
      if (ids.includes(LIST_IDS.LOVE)) void handleLoveListChange()
    }

    watch(() => props.musicInfo?.id, handleLoveListChange, { immediate: true })
    window.app_event.on('myListUpdate', handleListUpdate)
    onBeforeUnmount(() => {
      window.app_event.off('myListUpdate', handleListUpdate)
    })

    return {
      loved,
      handleClick,
    }
  },
}
</script>

<style lang="less" module>
.heart {
  width: 1.15em;
  height: 1.15em;
  path {
    fill: var(--color-primary);
    stroke: var(--color-primary);
    stroke-width: 1.8;
    stroke-linejoin: round;
    transition: 0.2s ease;
    transition-property: fill, stroke;
  }
}
.musicHeartBtn {
  &.unloved {
    .heart path {
      fill: none;
      stroke: var(--color-font-label);
    }
  }
}
</style>
