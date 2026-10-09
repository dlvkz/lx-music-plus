<template>
  <div :class="$style.header">
    <div :class="$style.left">
      <base-image :src="cover" :icon="picIcon" />
    </div>
    <div :class="$style.right">
      <div :class="$style.info">
        <h3 :class="$style.title"><common-translatable-text :text="name" /></h3>
        <div :class="$style.infoItem">
          <span><svg-icon name="music" />{{ musicCount }}</span>
        </div>
        <div v-if="createTime" :class="$style.infoItem">
          <span><svg-icon name="clock" />{{ createTime }}</span>
        </div>
      </div>
      <div :class="$style.controlBtns">
        <div :class="$style.btns">
          <base-btn :disabled="!musicCount" icontext @click="$emit('play')">
            <svg-icon name="play" />
            {{ $t('play_all') }}
          </base-btn>
          <base-btn :disabled="!musicCount" icontext @click="$emit('playrandom')">
            <svg-icon name="list-random" />
            {{ $t('play_random') }}
          </base-btn>
        </div>
        <div :class="$style.btns">
          <base-btn :outline="!downloadState.done" icon :aria-label="synced ? $t('download__sync_off') : $t('download__sync_on')" @click="toggleSync">
            <common-download-state-icon :downloading="downloadState.downloading" :progress="downloadState.progress" :done="downloadState.done" :partial="downloadState.partial" />
          </base-btn>
          <base-btn :outline="!multimode" icon :aria-label="multimode ? $t('batch_select_exit') : $t('batch_select')" @click="$emit('multi')">
            <svg-icon name="multiple" />
          </base-btn>
          <base-btn :outline="!finding" icon :aria-label="finding ? $t('find_music_exit') : $t('find_music')" @click="$emit('find')">
            <svg-icon name="search" />
          </base-btn>
          <base-btn :disabled="!musicCount" outline icon :aria-label="$t('duplicate_music')" @click="$emit('duplicate')">
            <svg-icon name="duplicate" />
          </base-btn>
          <base-btn :disabled="!musicCount" outline icon :aria-label="$t('sort_music')" @click="$emit('sort')">
            <svg-icon name="sort" />
          </base-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { toRef, computed } from '@common/utils/vueTools'
import { LIST_IDS } from '@common/constants'
import { dateFormat } from '@common/utils/common'
import useListMeta from '@renderer/utils/compositions/useListMeta'
import { isSyncList, setListSync, downloadRest, useListDownloadState } from '@renderer/store/download/sync'
import { confirmRemoveDownloads } from '@renderer/store/download/prompt'
import { getListMusics } from '@renderer/store/list/action'

// Ported from Any Listen: components/common/MusicList/Header.svelte
const LIST_PIC_ICON = {
  [LIST_IDS.LOVE]: 'music_heart',
  [LIST_IDS.DEFAULT]: 'clock',
}

export default {
  props: {
    listId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    musicCount: {
      type: Number,
      required: true,
    },
    multimode: {
      type: Boolean,
      default: false,
    },
    finding: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['play', 'playrandom', 'multi', 'find', 'duplicate', 'sort'],
  setup(props) {
    const listId = toRef(props, 'listId')
    const { cover } = useListMeta(listId)
    const picIcon = computed(() => LIST_PIC_ICON[props.listId] ?? 'night_landscape')
    // user list ids are `userlist_<create time>`
    const createTime = computed(() => {
      const time = /^userlist_(\d{13})$/.exec(props.listId)?.[1]
      return time ? dateFormat(parseInt(time), 'Y-M-D') : ''
    })
    const synced = computed(() => isSyncList(props.listId))
    // on: the songs of the list download (a ring shows how far); a second click asks to
    // cancel / remove the downloads, or to download the songs that are missing
    const downloadState = useListDownloadState(listId)
    const toggleSync = async() => {
      const id = props.listId
      if (!downloadState.value.taskIds.length) {
        await setListSync(id, !synced.value)
        return
      }
      const removed = await confirmRemoveDownloads(props.name, downloadState.value, async() => {
        await setListSync(id, true)
        await downloadRest(await getListMusics(id), id)
      })
      if (removed) await setListSync(id, false)
    }
    return {
      synced,
      downloadState,
      toggleSync,
      cover,
      picIcon,
      createTime,
    }
  },
}
</script>

<style lang="less" module>
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  padding: 10px 15px 10px 12px;
}
.left {
  flex: none;
  width: 140px;
  height: 140px;
}
.right {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  justify-content: space-between;
  min-width: 0;
  padding-top: 2px;
  padding-bottom: 5px;
  padding-left: 15px;
}
.title {
  font-size: 24px;
}
.infoItem {
  display: flex;
  flex-flow: row wrap;
  gap: 10px;
  padding-top: 5px;
  font-size: 13px;
  color: var(--color-font-label);
  + .infoItem {
    padding-top: 0;
  }
  :global(svg) {
    margin-right: 5px;
  }
}
.controlBtns {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  justify-content: space-between;
  margin-top: 15px;
}
.btns {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  gap: 10px;
}
</style>
