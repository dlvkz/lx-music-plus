<template>
  <div
    :class="[$style.container, { [$style.selected]: selected, [$style.active]: active, [$style.selectedactive]: selectedactive, [$style.disabled]: disabled && showSourceInfo }]"
    role="button" tabindex="0"
    @keydown.enter="$emit('select', true)" @click="$emit('select', false)" @contextmenu="$emit('menu', $event)"
    @mouseenter="hovered = true" @mouseleave="hovered = false"
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
      <transition name="fade">
        <div v-if="hovered" :class="$style.num">{{ index + 1 }}</div>
      </transition>
    </div>
      <div :class="[$style.cell, $style.auto, $style.nameCell]">
      <div :class="$style.nameLeft">
        <div :class="['select', 'name', $style.name]" :aria-label="musicInfo.name">
          <common-translatable-text :text="musicInfo.name" selectable />
        </div>
        <div :class="$style.label">
          <base-badge v-for="(label, i) in sourceLabel" :key="i" :label="label" :opacity="0.7" :type="badgeTypes[i % badgeTypes.length]" />
        </div>
      </div>
      <div v-if="showActionBtn" :class="$style.nameRight">
        <transition name="fade">
          <div v-if="hovered" :class="$style.autoHideBtns">
            <base-btn :class="$style.playBtn" min icon outline :aria-label="$t('player__play')" @click.stop="$emit('play')">
              <svg-icon name="play" />
            </base-btn>
          </div>
        </transition>
        <common-music-heart-btn v-if="listId !== LOVE_ID" :music-info="musicInfo" min />
      </div>
    </div>
    <div :class="$style.cell" style="flex: 0 0 22%;">
      <common-artist-names :singer="musicInfo.singer" :music-info="musicInfo" />
    </div>
    <div :class="$style.cell" style="flex: 0 0 22%;">
      <common-translatable-text
        v-if="musicInfo.meta.albumName && albumInfo"
        :text="musicInfo.meta.albumName" :class="[$style.album, 'select']"
        @click.stop="openAlbum"
      />
      <common-translatable-text v-else-if="musicInfo.meta.albumName" :text="musicInfo.meta.albumName" class="select" />
      <span v-else class="select">--</span>
    </div>
    <div :class="$style.cell" style="flex: 0 0 9%;">
      <span class="no-select">{{ musicInfo.interval || '--/--' }}</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'
import { appSetting } from '@renderer/store/setting'
import { buildSourceLabel, badgeTypes } from '@renderer/utils/musicLabel'
import { isSecondarySource, SECONDARY_SOURCE_NAMES } from '@renderer/utils/secondarySources'
import { getListMusicPic, getThumbnailUrl } from '@renderer/utils/listMusicPic'

const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg']

// Ported from Any Listen: components/common/MusicList/List/ListItem.svelte
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
    index: {
      type: Number,
      required: true,
    },
    picStyle: {
      type: Object,
      required: true,
    },
    playing: {
      type: Boolean,
      default: false,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: false,
    },
    selectedactive: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select', 'menu', 'play'],
  setup(props) {
    const router = useRouter()
    const hovered = ref(false)
    const picUrl = ref(null)
    const showActionBtn = computed(() => appSetting['list.isShowActionBtn'])
    // songs of a source the music api doesn't list are only dimmed when sources are shown
    const showSourceInfo = computed(() => appSetting['common.isShowSourceSwitch'])
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
    const sourceLabel = computed(() => {
      // the songs of the secondary sources always say where they are from (found by name)
      if (isSecondarySource(props.musicInfo.source)) return [SECONDARY_SOURCE_NAMES[props.musicInfo.source]]
      if (!appSetting['common.isShowSourceSwitch']) return []
      const labels = buildSourceLabel(props.musicInfo)
      return appSetting['list.isShowSource'] ? labels : labels.slice(1)
    })

    let cancelLoadPic = null
    let originPicUrl = null
    const loadPic = () => {
      cancelLoadPic?.()
      picUrl.value = null
      originPicUrl = null
      cancelLoadPic = getListMusicPic(props.musicInfo, props.listId, (url) => {
        cancelLoadPic = null
        originPicUrl = url
        picUrl.value = getThumbnailUrl(url, 100)
      })
    }
    const handlePicError = () => {
      // the thumbnail size may not exist for this image, fall back to the original one
      picUrl.value = picUrl.value == originPicUrl ? null : originPicUrl
    }

    watch(() => props.musicInfo.id, loadPic)
    onMounted(loadPic)
    onBeforeUnmount(() => {
      cancelLoadPic?.()
    })

    return {
      hovered,
      picUrl,
      showActionBtn,
      showSourceInfo,
      sourceLabel,
      badgeTypes,
      handlePicError,
      albumInfo,
      openAlbum,
      LOVE_ID: LIST_IDS.LOVE,
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
  transition-property: color, background-color, opacity, border-color;
  &:not(.active, .selected) {
    &:hover {
      background-color: var(--color-primary-background-hover);
    }
  }
  &.selected {
    background-color: var(--color-primary-background-selected);
  }
  &.active {
    background-color: var(--color-primary-background-active);
  }
  &.selectedactive {
    border-color: var(--color-primary-alpha-700);
  }
  &.disabled {
    opacity: 0.5;
  }
}
.pic {
  position: relative;
  flex: none;
  overflow: hidden;
  border-radius: @radius-border;
  :global(.pic) {
    transition: opacity @transition-normal;
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
.num {
  position: absolute;
  right: 0;
  bottom: 0;
  max-width: 100%;
  padding: 0 2px;
  font-size: 11px;
  line-height: 1.2;
  color: var(--color-000);
  user-select: none;
  background-color: var(--color-primary-dark-800-alpha-200);
  border-top-left-radius: @radius-border;
}
.cell {
  position: relative;
  flex: none;
  line-height: 16px;
  vertical-align: middle;
  .mixin-ellipsis-1();
  &.auto {
    flex: auto;
  }
}
.nameCell {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
}
.nameLeft {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  text-overflow: initial;
  white-space: initial;
}
.name {
  .mixin-ellipsis-1();
  max-width: 100%;
  padding: 2px 0;
}
.label {
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
  padding: 2px 0;
  :global(.badge) {
    padding: 0;
  }
}
.nameRight {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 4px;
  align-items: center;
  margin: 0 8px;
  color: var(--color-font-label);
}
.playBtn {
  padding: 3px !important;
}
.album {
  cursor: pointer;
  text-decoration: none;
  &:hover {
    color: var(--color-primary-font-hover);
    text-decoration: underline;
  }
}
.autoHideBtns {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 4px;
  align-items: center;
}
</style>
