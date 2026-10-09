<template>
  <div :class="$style.container">
    <material-online-list
      ref="listRef"
      :mini-header="false"
      :page="listDetailInfo.page"
      :limit="listDetailInfo.limit"
      :total="listDetailInfo.total"
      :list="listDetailInfo.list"
      :no-item="listDetailInfo.noItemLabel"
      :search-list="allSongs"
      @play-list="handlePlayList"
      @show-menu="hideListsMenu"
      @toggle-page="togglePage"
      @search-visible="handleSearchVisible"
      @search-select="handleSearchSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from '@common/utils/vueTools'
import useList from './useList'


const props = defineProps<{
  source: LX.OnlineSource
  boardId?: string
}>()

const emit = defineEmits(['show-menu'])

const {
  listRef,
  listDetailInfo,
  getList,
  handlePlayList,
  allSongs,
  handleSearchVisible,
  handleSearchSelect,
} = useList()

watch(() => props.boardId, (boardId) => {
  if (!boardId) return
  void getList(boardId, 1)
}, {
  immediate: true,
})


const hideListsMenu = () => {
  emit('show-menu')
}

const togglePage = (page: number) => {
  void getList(listDetailInfo.id, page)
}

const hideMenu = () => {
  listRef.value.handleMenuClick()
}

defineExpose({ hideMenu, listRef, listDetailInfo, handlePlayList, allSongs })


</script>


<style lang="less" module>
.container {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-height: 0;
}

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
}

</style>
