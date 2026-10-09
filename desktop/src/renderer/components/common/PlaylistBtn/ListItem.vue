<template>
  <div
    :class="$style.container" role="button" tabindex="0"
    @keydown.enter="$emit('play')" @dblclick="$emit('play')"
  >
    <div :class="$style.pic" :style="picStyle">
      <transition name="fade">
        <div v-if="playing" :class="$style.playIcon">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <use xlink:href="#icon-play" />
          </svg>
        </div>
      </transition>
      <base-image :src="picUrl" @error="handlePicError" />
    </div>
    <div :class="$style.nameInfo">
      <div :class="$style.name" :aria-label="musicInfo.name">
        <h4><common-translatable-text :text="musicInfo.name" /></h4>
        <base-badge v-for="(label, index) in sourceLabel" :key="index" :label="label" :opacity="0.7" :type="badgeTypes[index % badgeTypes.length]" />
      </div>
      <div :class="$style.singer">
        <!-- each artist opens its page (the queue closes) -->
        <common-artist-names v-if="musicInfo.singer" :singer="musicInfo.singer" :music-info="musicInfo" inline @navigate="$emit('navigate')" />
        <common-translatable-text
          v-if="musicInfo.meta.albumName && albumInfo" :text="musicInfo.meta.albumName" compact
          :class="$style.album" @click.stop="openAlbum"
        />
        <common-translatable-text v-else-if="musicInfo.meta.albumName" :text="musicInfo.meta.albumName" compact />
      </div>
    </div>
    <div v-if="playLater" :class="$style.playLater" style="flex: 0 0 8%;" :aria-label="$t('user_list_music_menu__play_later')">
      <svg-icon name="step-into" />
    </div>
    <div :class="$style.goto" style="flex: 0 0 9%;">
      <base-btn outline icon @click.stop="$emit('goto')">
        <svg-icon name="visit" />
      </base-btn>
    </div>
    <div :class="$style.time" style="flex: 0 0 9%;">
      <span class="no-select">{{ musicInfo.interval || '--/--' }}</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'
import { useRouter } from '@common/utils/vueRouter'
import { buildSourceLabel, badgeTypes } from '@renderer/utils/musicLabel'
import { getListMusicPic, getThumbnailUrl } from '@renderer/utils/listMusicPic'

const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg']

// Ported from Any Listen: components/common/PlaylistBtn/ListItem.svelte
export default {
  props: {
    musicInfo: {
      type: Object,
      required: true,
    },
    listId: {
      type: String,
      default: null,
    },
    picStyle: {
      type: Object,
      required: true,
    },
    playing: {
      type: Boolean,
      default: false,
    },
    played: {
      type: Boolean,
      default: false,
    },
    playLater: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['play', 'goto', 'navigate'],
  setup(props) {
    const router = useRouter()
    const picUrl = ref(null)
    const sourceLabel = computed(() => appSetting['common.isShowSourceSwitch'] ? buildSourceLabel(props.musicInfo) : [])
    const albumInfo = computed(() => {
      const source = props.musicInfo.source
      const albumId = props.musicInfo.meta?.albumId
      if (!ONLINE_SOURCES.includes(source) || !albumId) return null
      return {
        source,
        id: String(albumId),
        name: props.musicInfo.meta.albumName ?? '',
      }
    })
    const openAlbum = () => {
      if (!albumInfo.value) return
      void router.push({
        path: '/album',
        query: {
          source: albumInfo.value.source,
          id: albumInfo.value.id,
          name: albumInfo.value.name,
        },
      })
    }
    let cancel = null
    let originPicUrl = null
    onMounted(() => {
      cancel = getListMusicPic(props.musicInfo, props.listId, (url) => {
        cancel = null
        originPicUrl = url
        picUrl.value = getThumbnailUrl(url, 100)
      })
    })
    const handlePicError = () => {
      // the thumbnail size may not exist for this image, fall back to the original one
      picUrl.value = picUrl.value == originPicUrl ? null : originPicUrl
    }
    onBeforeUnmount(() => {
      cancel?.()
    })
    return {
      picUrl,
      handlePicError,
      sourceLabel,
      badgeTypes,
      albumInfo,
      openAlbum,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  gap: 10px;
  align-items: center;
  height: 100%;
  padding: 5px;
  font-size: 13px;
  background-color: transparent;
  border: 1px dashed transparent;
  border-radius: @radius-border;
  transition: 0.3s ease;
  transition-property: background-color, opacity;
  &.played {
    opacity: 0.4;
  }
  &:hover {
    background-color: var(--color-primary-background-hover);
    .goto {
      opacity: 1;
    }
  }
}
.pic {
  position: relative;
  flex: none;
  border-radius: @radius-border;
  :global(.pic) {
    transition: opacity @transition-fast;
  }
}
.playIcon {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 6px;
  color: var(--color-button-font);
  + :global(.pic) {
    opacity: 0.1;
  }
}
.nameInfo {
  flex: auto;
  min-width: 0;
  .name {
    display: flex;
    flex-flow: row nowrap;
    gap: 5px;
    align-items: center;
    .mixin-ellipsis-1();
  }
  h4 {
    .mixin-ellipsis-1();
  }
}
.singer {
  display: flex;
  flex-flow: row nowrap;
  font-size: 12px;
  color: var(--color-font-label);
  span {
    .mixin-ellipsis-1();
    + span {
      &::before {
        display: inline-block;
        padding: 0 3px;
        color: var(--color-primary-font);
        content: '•';
        opacity: 0.4;
      }
    }
  }
}
.playLater {
  flex: none;
  font-size: 20px;
  color: var(--color-primary-font);
  text-align: center;
}
.goto {
  opacity: 0;
  transition: opacity @transition-fast;
}
.album {
  cursor: pointer;
  text-decoration: none;
  &:hover {
    color: var(--color-primary-font-hover);
    text-decoration: underline;
  }
}
.time {
  flex: none;
  color: var(--color-font-label);
}
</style>
