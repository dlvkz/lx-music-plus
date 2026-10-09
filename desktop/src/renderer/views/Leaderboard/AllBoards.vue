<template>
  <div :class="$style.container">
    <div :class="$style.toolbar">
      <div ref="dropdownRef" :class="$style.dropdown">
        <button type="button" :class="$style.dropdownBtn" @click="isShowPlatforms = !isShowPlatforms">
          <span>{{ selectedLabel }}</span>
          <svg-icon name="angle-right-solid" :class="[$style.arrow, { [$style.open]: isShowPlatforms }]" />
        </button>
        <transition name="fade">
          <div v-if="isShowPlatforms" :class="$style.dropdownMenu">
            <base-checkbox
              id="charts_platforms_all" :model-value="selected.length == platforms.length"
              :label="$t('charts__all_platforms')" @update:model-value="toggleAll"
            />
            <div :class="$style.separator" />
            <base-checkbox
              v-for="item in platforms" :id="`charts_platform_${item.id}`" :key="item.id"
              :model-value="selected.includes(item.id)" :label="item.name" @update:model-value="togglePlatform(item.id, $event)"
            />
          </div>
        </transition>
      </div>
    </div>
    <div :class="[$style.listContainer, 'scroll']">
      <ul>
        <li v-for="item in mixedList" :key="item.id" :aria-label="item.name" @click="openBoard(item)">
          <a :class="$style.listItem">
            <div :class="$style.image">
              <base-image :src="item.pic ? (localImages[item.pic] ?? item.pic) : null" :alt="item.name" icon="increase" :pending="!item.pic && pendingSources.has(item.source)" />
            </div>
            <div :class="$style.desc">
              <h4><common-translatable-text :text="item.name" replace /></h4>
              <p>{{ platformName(item.source) }}</p>
            </div>
          </a>
        </li>
      </ul>
      <material-empty v-if="!selected.length" :label="$t('charts__choose_platforms_tip')" />
      <material-skeleton v-else-if="!mixedList.length" type="grid" :count="24" :min-width="128" gap="16px 14px" padding="0 16px 16px" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowReactive } from '@common/utils/vueTools'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { getBoardsList, getCachedBoardsList, setBoard } from '@renderer/store/leaderboard/action'
import { boards, sources } from '@renderer/store/leaderboard/state'
import { getBoardCovers, getBoardSongCover, getCachedChartCovers } from '@renderer/store/leaderboard/covers'
import { localImages, loadLocalImages } from '@renderer/utils/localImageCache'
import { getCache, setCache } from '@renderer/utils/dataCache'
import { sourceNames } from '@renderer/store'
import { CHART_SOURCES, CHART_SOURCE_NAMES, isChartSource, isChartSourceReachable } from '@renderer/utils/chartSources'

// The charts of every platform in one grid, mixed (the charts of each platform in turns, their first ones
// first); the platforms shown are chosen in the menu at the top (all of them by default but the ones that can't
// be reached on the first run, kept)

const SELECTED_KEY = 'charts:platforms'
const MAIN_SOURCES = ['wy', 'kw', 'tx', 'kg', 'mg']

const router = useRouter()
const route = useRoute()

const platforms = computed(() => [
  ...MAIN_SOURCES.filter(s => sources.includes(s)).map(s => ({ id: s, name: sourceNames.value[s] })),
  ...CHART_SOURCES.map(s => ({ id: s, name: CHART_SOURCE_NAMES[s] })),
])
const platformName = (source) => isChartSource(source) ? CHART_SOURCE_NAMES[source] : sourceNames.value[source] ?? source

// saved: the platforms shown and the ones known then (a platform added since is shown)
const saved = getCache(SELECTED_KEY)
const selected = ref(platforms.value.map(p => p.id))
if (Array.isArray(saved?.selected)) {
  selected.value = platforms.value.map(p => p.id).filter(id => saved.selected.includes(id) || !saved.known?.includes(id))
}
// first run (nothing saved): the platforms of the West that can't be reached (blocked: mainland China) are
// unchecked once the charts are loaded
let isFirstRun = !Array.isArray(saved?.selected)
const saveSelected = () => {
  isFirstRun = false
  setCache(SELECTED_KEY, { selected: selected.value, known: platforms.value.map(p => p.id) })
}
const togglePlatform = (id, checked) => {
  if (checked) {
    if (!selected.value.includes(id)) selected.value = platforms.value.map(p => p.id).filter(p => p == id || selected.value.includes(p))
  } else selected.value = selected.value.filter(p => p != id)
  saveSelected()
}
// unchecking "all" unchecks every platform (to pick a few of them)
const toggleAll = (checked) => {
  selected.value = checked ? platforms.value.map(p => p.id) : []
  saveSelected()
}
const selectedLabel = computed(() => {
  if (selected.value.length == platforms.value.length) return window.i18n.t('charts__all_platforms')
  if (!selected.value.length) return window.i18n.t('charts__choose_platforms')
  return selected.value.map(platformName).join(', ')
})

const isShowPlatforms = ref(false)
const dropdownRef = ref(null)
const handleClickOutside = (event) => {
  if (isShowPlatforms.value && dropdownRef.value && !dropdownRef.value.contains(event.target)) isShowPlatforms.value = false
}
onMounted(() => { document.addEventListener('mousedown', handleClickOutside) })
onBeforeUnmount(() => { document.removeEventListener('mousedown', handleClickOutside) })

// the charts of each platform (with their covers)
const lists = shallowReactive({})
const pendingSources = reactive(new Set())
const setList = (source, items) => {
  lists[source] = items
}
const withCachedCovers = (source, items) => {
  const covers = getCachedChartCovers(source)
  const result = items.map(item => !item.pic && covers[item.id] ? { ...item, pic: covers[item.id] } : item)
  // the covers come from slow servers: local copies are shown
  void loadLocalImages(result.map(item => item.pic))
  return result
}
const loadCovers = async(source) => {
  pendingSources.add(source)
  let covers = {}
  try {
    covers = await getBoardCovers(source)
  } catch (err) {
    console.log(err)
  }
  const items = (lists[source] ?? []).map(item => covers[item.bangid] && covers[item.bangid] != item.pic ? { ...item, pic: covers[item.bangid] } : item)
  setList(source, items)
  void loadLocalImages(items.map(item => item.pic))
  const pending = items.filter(item => !item.pic)
  if (!pending.length) pendingSources.delete(source)
  let remaining = pending.length
  for (const item of pending) {
    void getBoardSongCover(item.id).then(pic => {
      if (!pic) return
      void loadLocalImages([pic])
      setList(source, (lists[source] ?? []).map(i => i.id == item.id ? { ...i, pic } : i))
    }).finally(() => {
      if (--remaining <= 0) pendingSources.delete(source)
    })
  }
}
const loadSource = async(source) => {
  let boardList = boards[source]
  if (boardList == null) {
    // the charts known from last time are shown while the list is loaded
    const cached = getCachedBoardsList(source)
    if (cached) setList(source, withCachedCovers(source, cached.list.map(item => ({ ...item, source }))))
    try {
      boardList = await getBoardsList(source)
    } catch (err) {
      console.log(err)
      return false
    }
    setBoard(boardList, source)
  }
  setList(source, withCachedCovers(source, boardList.list.map(item => ({ ...item, source }))))
  void loadCovers(source)
  return boardList.list.length > 0
}
onMounted(() => {
  const loads = platforms.value.map(async platform => loadSource(platform.id))
  if (!isFirstRun) return
  // first run: the platforms of the West that can't be reached are unchecked (not when no Chinese platform is
  // loaded either: offline, tried again next time)
  void Promise.all([Promise.all(loads), Promise.all(CHART_SOURCES.map(isChartSourceReachable))]).then(([loaded, reachable]) => {
    if (!isFirstRun || !platforms.value.some((platform, index) => !isChartSource(platform.id) && loaded[index])) return
    const blocked = CHART_SOURCES.filter((_, index) => !reachable[index])
    selected.value = selected.value.filter(id => !blocked.includes(id))
    saveSelected()
  })
})

// the charts of the platforms chosen, in turns
const mixedList = computed(() => {
  const chosen = platforms.value.filter(p => selected.value.includes(p.id)).map(p => lists[p.id] ?? [])
  const result = []
  const longest = Math.max(0, ...chosen.map(list => list.length))
  for (let i = 0; i < longest; i++) for (const list of chosen) if (i < list.length) result.push(list[i])
  return result
})

const openBoard = (item) => {
  void router.push({
    path: route.path,
    query: {
      source: item.source,
      boardId: item.id,
    },
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: relative;
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-width: 0;
  min-height: 0;
}
.toolbar {
  flex: none;
  padding: 0 16px 10px;
}
.dropdown {
  position: relative;
  display: inline-block;
}
.dropdownBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 420px;
  border: none;
  background: transparent;
  padding: 4px 2px;
  font-size: 16px;
  color: var(--color-font);
  cursor: pointer;
  span {
    .mixin-ellipsis-1();
  }
  &:hover {
    opacity: 0.75;
  }
}
// (the icon points right: turned down, up when the menu is open)
.arrow {
  flex: none;
  width: 10px;
  height: 10px;
  transform: rotate(90deg);
  transition: transform @transition-normal;
  &.open {
    transform: rotate(-90deg);
  }
}
.dropdownMenu {
  position: absolute;
  left: 0;
  top: 100%;
  z-index: 10;
  min-width: 180px;
  margin-top: 4px;
  padding: 10px 14px;
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  border-radius: 8px;
  // (like the menus of the app)
  background-color: var(--color-content-background);
  box-shadow: 0 2px 12px rgb(0 0 0 / 20%);
}
.separator {
  height: 1px;
  background-color: var(--color-primary-light-100-alpha-700);
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
  p {
    font-size: 11px;
    color: var(--color-font-label);
  }
}
</style>
