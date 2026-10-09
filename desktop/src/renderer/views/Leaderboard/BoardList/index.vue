<template>
  <!-- Ported from Any Listen: views/Online/TopSongs/list/{Songlist,ListItem}.svelte -->
  <div :class="[$style.songlistList, { [$style.embedded]: embedded }]">
    <div ref="dom_lists_list" :class="[$style.listContainer, { scroll: !embedded }]">
      <ul>
        <li
          v-for="(item, index) in list" :key="item.id" :aria-label="item.name"
          :class="{ [$style.clicked]: rightClickItemIndex == index }"
          @click="handleToggleList(item.id)" @contextmenu="handleRigthClick($event, index)"
        >
          <a :class="$style.listItem">
            <div :class="$style.image">
              <base-image :src="item.pic ? (localImages[item.pic] ?? item.pic) : null" :alt="item.name" icon="increase" :pending="coversPending" />
            </div>
            <div :class="$style.desc">
              <h4><common-translatable-text :text="item.name" replace /></h4>
            </div>
          </a>
        </li>
      </ul>
    </div>
    <material-skeleton v-if="!list.length" type="grid" :count="embedded ? 6 : 24" :min-width="128" gap="16px 14px" padding="0 16px 16px" />
  </div>
  <base-menu
    v-model="isShowMenu"
    :menus="menus"
    :xy="menuLocation"
    item-name="name"
    @menu-click="handleMenuClick"
  />
</template>

<script setup>
import { watch, shallowReactive, ref } from '@common/utils/vueTools'
import { getBoardsList, getCachedBoardsList, setBoard } from '@renderer/store/leaderboard/action'
import { boards } from '@renderer/store/leaderboard/state'
import { getBoardCovers, getBoardSongCover, getCachedChartCovers } from '@renderer/store/leaderboard/covers'
import { localImages, loadLocalImages } from '@renderer/utils/localImageCache'
import useMenu from './useMenu'
import { useRouter, useRoute } from '@common/utils/vueRouter'

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
  boardId: {
    type: [String, undefined],
    default: undefined,
  },
  // a section of the page of all the sources: no scroll of its own
  embedded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['show-menu'])

const router = useRouter()
const route = useRoute()

const list = shallowReactive([])
const rightClickItemIndex = ref(-1)

const handleToggleList = (id) => {
  void router.push({
    path: route.path,
    query: {
      source: props.source,
      boardId: id,
    },
  })
}

const {
  menus,
  menuLocation,
  isShowMenu,
  showMenu,
  menuClick,
} = useMenu({ emit, list })

const handleRigthClick = (event, index) => {
  rightClickItemIndex.value = index
  showMenu(event, index)
}
const handleMenuClick = (action) => {
  if (rightClickItemIndex.value < 0) return
  let index = rightClickItemIndex.value
  rightClickItemIndex.value = -1
  menuClick(action, index, props.source)
}


// the chart lists come without images
// the covers found last time are shown at once
const withCachedCovers = (source, items) => {
  const covers = getCachedChartCovers(source)
  const result = items.map(item => !item.pic && covers[item.id] ? { ...item, pic: covers[item.id] } : item)
  // the covers come from slow servers: local copies are shown
  void loadLocalImages(result.map(item => item.pic))
  return result
}
// the covers of the charts are looked up after the list: the squares pulse until then
const coversPending = ref(true)
const loadCovers = async(source) => {
  coversPending.value = true
  let covers = {}
  try {
    covers = await getBoardCovers(source)
  } catch (err) {
    console.log(err)
  }
  if (source != props.source) return
  // a cover that did not change is not replaced (no reload of the image)
  list.splice(0, list.length, ...list.map(item => covers[item.bangid] && covers[item.bangid] != item.pic ? { ...item, pic: covers[item.bangid] } : item))
  void loadLocalImages(list.map(item => item.pic))
  const pending = list.filter(item => !item.pic)
  if (!pending.length) coversPending.value = false
  let remaining = pending.length
  for (const item of pending) {
    void getBoardSongCover(item.id).then(pic => {
      if (source != props.source) return
      if (pic) {
        void loadLocalImages([pic])
        const index = list.findIndex(i => i.id == item.id && i.pic != pic)
        if (index > -1) list.splice(index, 1, { ...list[index], pic })
      }
    }).finally(() => {
      if (--remaining <= 0 && source == props.source) coversPending.value = false
    })
  }
}

watch(() => props.source, async(source) => {
  // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
  let boardList = boards[source]
  if (boardList == null) {
    // the charts known from last time are shown while the list is loaded
    const cached = getCachedBoardsList(source)
    if (cached) {
      list.splice(0, list.length, ...withCachedCovers(source, cached.list))
      void loadCovers(source)
    }
    try {
      boardList = await getBoardsList(source)
    } catch (err) {
      console.log(err)
      return
    }
    setBoard(boardList, source)
  }
  list.splice(0, list.length, ...withCachedCovers(source, boardList.list))
  void loadCovers(source)
}, {
  immediate: true,
})

defineExpose({ hideMenu: handleMenuClick })

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.songlistList {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.embedded {
  flex: none;
  overflow: visible;
}
.listContainer {
  position: relative;
  flex: auto;
  min-height: 0;
  ul {
    display: grid;
    // same cards as the playlists tab (songList/List/components/SongList.vue, compact view)
    grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
    gap: 16px 14px;
    align-content: flex-start;
    padding: 0 16px 16px;
  }
  li.clicked .listItem {
    opacity: 0.7;
  }
}
.listItem {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  min-width: 0;
  text-decoration: none;
  cursor: pointer;
  border-radius: @radius-border;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 0.7;
  }
}
.image {
  display: flex;
  flex: none;
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  opacity: 0.9;
  :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.desc {
  flex: auto;
  overflow: hidden;
  h4 {
    font-size: 13px;
    line-height: 1.3;
    color: var(--color-font);
    text-align: left;
    .mixin-ellipsis-2();
  }
}
</style>
