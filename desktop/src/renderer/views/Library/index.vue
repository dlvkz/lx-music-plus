<template>
  <!-- The whole library as a grid of squares, like the library tab of the mobile app -->
  <div :class="$style.container">
    <material-online-header active="library" />
    <div :class="[$style.content, 'scroll']">
      <ul :class="$style.grid">
        <li v-for="item in lists" :key="item.id">
          <ListCard :list-id="item.id" :name="item.name" @select="openList(item.id)" @contextmenu.prevent="showListMenu($event, item.id)" />
        </li>
        <li v-for="item in collections" :key="getCollectionKey(item.type, item.source, item.id)">
          <a :class="$style.card" role="link" :aria-label="item.name" @click="openCollection(item)" @contextmenu.prevent="removeCollectionItem(item)">
            <div :class="[$style.pic, { [$style.round]: item.type == 'artist' }]">
              <base-image :src="item.img" :icon="item.type == 'artist' ? 'dj' : 'albums'" />
            </div>
            <h4><common-translatable-text :text="item.name" replace compact /></h4>
            <p>{{ $t(item.type == 'artist' ? 'collection__type_artist' : 'collection__type_album') }}</p>
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import { dialog } from '@renderer/plugins/Dialog'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getListDisplayName } from '@renderer/store/list/defaultListCustom'
import { collections, getCollectionKey, removeCollection } from '@renderer/store/list/collections'
import ListCard from './ListCard.vue'
import { showListMenu } from '@renderer/store/list/listMenu'

const router = useRouter()
const t = useI18n()

const lists = computed(() => [
  { id: defaultList.id, name: getListDisplayName(defaultList) },
  { id: loveList.id, name: getListDisplayName(loveList) },
  ...userLists.map(l => ({ id: l.id, name: l.name })),
])

const openList = (id) => {
  void router.push({ path: '/list', query: { id } })
}
const openCollection = (item) => {
  void router.push(item.type == 'artist'
    ? { path: '/artist', query: { name: item.id, source: item.source || undefined } }
    : { path: '/album', query: { source: item.source, id: item.id, name: item.name } })
}
const removeCollectionItem = (item) => {
  void dialog.confirm({
    message: t('collection__remove_tip', { name: item.name }),
    confirmButtonText: t('confirm_button_text'),
  }).then(confirmed => {
    if (confirmed) removeCollection(item)
  })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  min-height: 0;
}
.content {
  flex: auto;
  min-height: 0;
}
// same cards as the playlists tab (songList/List/components/SongList.vue, compact view)
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 16px 14px;
  align-content: flex-start;
  padding: 0 16px 16px;
}
.card {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
  min-width: 0;
  text-decoration: none;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 0.7;
  }
  h4 {
    font-size: 13px;
    line-height: 1.3;
    color: var(--color-font);
    .mixin-ellipsis-2();
  }
  p {
    font-size: 12px;
    line-height: 1.2;
    color: var(--color-font-label);
    .mixin-ellipsis-1();
  }
}
.pic {
  display: flex;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 6px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(.pic) {
    width: 100%;
    height: 100%;
    border-radius: 6px;
    box-shadow: none;
  }
  :global(img) {
    object-fit: cover;
  }
}
.round {
  border-radius: 50%;
  :global(.pic) {
    border-radius: 50%;
  }
}
</style>
