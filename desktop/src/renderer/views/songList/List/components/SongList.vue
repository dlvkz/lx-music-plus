<template>
  <!-- Ported from Any Listen: views/Online/Songlist/list/{Songlist,ListItem}.svelte -->
  <div :class="$style.container">
    <div v-show="!props.listInfo.noItemLabel" ref="dom_list_ref" :class="[$style.listContainer, { [$style.compact]: isCompactView }, 'scroll']">
      <ul>
        <li v-for="item in props.listInfo.list" :key="item.id">
          <a :class="$style.listItem" @click="toDetail(item)">
            <div :class="$style.image">
              <base-image :src="item.img" :alt="item.name" />
            </div>
            <div :class="$style.desc">
              <h4><common-translatable-text :text="item.name" :swap="!isCompactView" :compact="isCompactView" :replace="isCompactView" /></h4>
              <div>
                <p :class="$style.author"><common-translatable-text :text="item.author" compact /></p>
                <p v-if="item.time" :class="$style.time">{{ item.time }}</p>
                <div :class="$style.songlistInfo">
                  <span v-if="item.total != null"><svg-icon name="music" />{{ localizeCount(item.total) }}</span>
                  <span v-if="item.play_count != null"><svg-icon name="headphones" />{{ localizeCount(item.play_count) }}</span>
                  <!-- the playlists of the secondary sources always say where they are from -->
                  <span v-if="secondaryName(item.source)">{{ secondaryName(item.source) }}</span>
                  <span v-else-if="visibleSource && appSetting['common.isShowSourceSwitch']">{{ item.source }}</span>
                </div>
              </div>
            </div>
          </a>
        </li>
      </ul>
      <div v-if="props.listInfo.total > props.listInfo.limit" :class="$style.pagination">
        <material-pagination :count="props.listInfo.total" :limit="props.listInfo.limit" :page="props.listInfo.page" @btn-click="togglePage" />
      </div>
    </div>
    <transition name="fade">
      <material-skeleton v-if="props.listInfo.noItemLabel && props.listInfo.noItemLabel == $t('list__loading')" type="grid" :count="24" :min-width="isCompactView ? 128 : 300" :gap="isCompactView ? '16px 14px' : '16px'" padding="0 16px 16px" />
      <material-empty v-else-if="props.listInfo.noItemLabel" :label="props.listInfo.noItemLabel" />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { localizeCount } from '@renderer/utils'
import { isCompactView } from '@renderer/views/songList/viewMode'
import { appSetting } from '@renderer/store/setting'
import { SECONDARY_SOURCE_NAMES } from '@renderer/utils/secondarySources'
import { ref } from '@common/utils/vueTools'
import type { ListInfo, ListInfoItem } from '@renderer/store/songList/state'
import { useRoute, useRouter } from '@common/utils/vueRouter'

const secondaryName = (source: string) => (SECONDARY_SOURCE_NAMES as Record<string, string>)[source] ?? ''


const props = withDefaults(defineProps<{
  listInfo: ListInfo
  visibleSource?: boolean
}>(), {
  visibleSource: false,
})

const router = useRouter()
const route = useRoute()

const dom_list_ref = ref<HTMLElement | null>(null)

const emit = defineEmits(['toggle-page'])


const togglePage = (page: number) => {
  emit('toggle-page', page)
}

const toDetail = (info: ListInfoItem) => {
  void router.push({
    path: '/songList/detail',
    query: {
      source: info.source,
      id: info.id,
      picUrl: info.img,
      fromName: route.name as string,
    },
  })
}

defineExpose({
  scrollTo(top: number) {
    dom_list_ref.value?.scrollTo({
      top,
      // behavior: 'smooth',
    })
  },
  getScrollTop() {
    return dom_list_ref.value?.scrollTop ?? 0
  },
})


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
  overflow: hidden;
}
.listContainer {
  position: relative;
  flex: auto;
  min-height: 0;
  > ul {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
    align-content: flex-start;
    padding: 0 16px 16px;
  }
  > ul > li {
    display: flex;
  }
}
// cover cards like the recommended playlists of the home page
.compact {
  > ul {
    grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
    gap: 16px 14px;
  }
  .listItem {
    flex-flow: column nowrap;
    gap: 6px;
    min-width: 0;
    height: auto;
  }
  .image {
    width: 100%;
    height: auto;
    border-radius: 6px;
  }
  .desc {
    padding: 0;
    h4 {
      font-size: 13px;
      text-align: left;
    }
  }
  .author, .time {
    display: none;
  }
  .songlistInfo {
    gap: 10px;
    margin-top: 3px;
  }
}
.listItem {
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
  gap: 8px;
  min-width: 300px;
  height: 110px;
  text-decoration: none;
  border-radius: @radius-border;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 0.7;
  }
}
.image {
  display: flex;
  flex: none;
  width: auto;
  height: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 4px;
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
  padding: 2px 15px 2px 0;
  overflow: hidden;
  h4 {
    font-size: 14px;
    line-height: 1.3;
    color: var(--color-font);
    text-align: justify;
    .mixin-ellipsis-2();
  }
}
.songlistInfo {
  display: flex;
  flex-flow: row nowrap;
  gap: 15px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.2;
  color: var(--color-font-label);
  text-align: justify;
  .mixin-ellipsis-1();
  :global(svg) {
    margin-right: 2px;
  }
}
.author {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-font-label);
  text-align: justify;
  .mixin-ellipsis-1();
}
.time {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-font-label);
  text-align: justify;
  .mixin-ellipsis-1();
}
.pagination {
  display: flex;
  flex: none;
  justify-content: center;
  padding: 10px 0;
}
</style>
