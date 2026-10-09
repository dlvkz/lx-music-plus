<template>
  <div :class="[$style.container, 'scroll']">
    <ul v-if="type == 'artist'" :class="$style.grid">
      <li v-for="item in artists" :key="item.name">
        <a :class="$style.item" @click="openArtist(item)">
          <div :class="[$style.image, $style.round]"><base-image :src="item.img" icon="dj" /></div>
          <div :class="$style.desc">
            <h4><common-translatable-text :text="item.name" /></h4>
            <p v-if="secondaryLabel(item.sources)">{{ secondaryLabel(item.sources) }}</p>
          </div>
        </a>
      </li>
    </ul>
    <ul v-else :class="$style.grid">
      <li v-for="item in albums" :key="`${item.source}_${item.id}`">
        <a :class="$style.item" @click="openAlbum(item)">
          <div :class="$style.image"><base-image :src="item.img" icon="albums" /></div>
          <div :class="$style.desc">
            <h4><common-translatable-text :text="item.name" /></h4>
            <p>{{ item.artist }}</p>
            <p v-if="secondaryName(item.source) || item.time">
              <span v-if="secondaryName(item.source)" :class="$style.badge">{{ secondaryName(item.source) }}</span>
              {{ item.time ?? '' }}
            </p>
          </div>
        </a>
      </li>
    </ul>
    <material-empty v-if="!(type == 'artist' ? artists : albums).length" :label="noItem" />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, watch } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { searchText, searchRepeatCount } from '@renderer/store/search/state'
import { addHistoryWord } from '@renderer/store/search/action'
import { searchAlbums, searchArtists, type AlbumSearchResult, type ArtistSearchResult } from '@renderer/utils/entitySearch'
import { SECONDARY_SOURCE_NAMES } from '@renderer/utils/secondarySources'
// sets the requests of the secondary sources (through node)
import '@renderer/utils/secondaryAudio'

// Artist / album search: the artists and albums of every source at once (utils/entitySearch.ts); an artist
// opens the artist page of the name (all the sources), an album the album page of its source

const props = defineProps<{
  type: 'artist' | 'album'
}>()

// the sources searched, the first ones first: an artist / album of several sources is the one of the first source
const ARTIST_SOURCES = ['wy', 'kw', 'tx', 'kg', 'sc', 'bc']
const ALBUM_SOURCES = ['wy', 'kw', 'tx', 'kg', 'sc', 'bc', 'kh']

// the results of the last searches: coming back to the search page shows them at once
const cache = new Map<string, ArtistSearchResult[] | AlbumSearchResult[]>()

const router = useRouter()
const artists = shallowRef<ArtistSearchResult[]>([])
const albums = shallowRef<AlbumSearchResult[]>([])
const noItem = ref('')
let token = 0

const search = async(text: string, isRefresh = false) => {
  const current = ++token
  const type = props.type
  const key = `${type}__${text}`
  if (!text) {
    artists.value = []
    albums.value = []
    noItem.value = ''
    return
  }
  void addHistoryWord(text)
  const cached = isRefresh ? null : cache.get(key)
  if (cached) {
    if (type == 'artist') artists.value = cached as ArtistSearchResult[]
    else albums.value = cached as AlbumSearchResult[]
    noItem.value = cached.length ? '' : window.i18n.t('no_item')
    return
  }
  if (type == 'artist') artists.value = []
  else albums.value = []
  noItem.value = window.i18n.t('list__loading')
  const list = type == 'artist' ? await searchArtists(text, ARTIST_SOURCES) : await searchAlbums(text, ALBUM_SOURCES)
  if (current != token) return
  if (cache.size > 30) cache.clear()
  cache.set(key, list)
  if (type == 'artist') artists.value = list as ArtistSearchResult[]
  else albums.value = list as AlbumSearchResult[]
  noItem.value = list.length ? '' : window.i18n.t('no_item')
}

watch([searchText, () => props.type], ([text]) => {
  void search(text)
}, { immediate: true })
watch(searchRepeatCount, () => {
  void search(searchText.value, true)
})

// the name of a secondary source ('' for a main source)
const secondaryName = (source: string) => (SECONDARY_SOURCE_NAMES as Record<string, string>)[source] ?? ''
// the artists only on a secondary source say where they are from
const secondaryLabel = (sources: string[]) => {
  if (sources.some(source => !secondaryName(source))) return ''
  return sources.map(secondaryName).join(' · ')
}

const openArtist = (item: ArtistSearchResult) => {
  void router.push({ path: '/artist', query: { name: item.name, source: item.sources[0] } })
}
const openAlbum = (item: AlbumSearchResult) => {
  void router.push({ path: '/album', query: { source: item.source, id: item.id, name: item.name } })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 20px;
  padding: 18px 16px 16px;
}

.item {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
  cursor: pointer;
  transition: opacity @transition-normal;
  &:hover {
    opacity: 0.7;
  }
}

.image {
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 0 2px 0 rgb(0 0 0 / 20%);
  :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.round {
  border-radius: 50%;
}

.desc {
  h4 {
    font-size: 13px;
    line-height: 1.3;
    .mixin-ellipsis-2();
  }
  p {
    font-size: 12px;
    color: var(--color-font-label);
    .mixin-ellipsis-1();
  }
}

.badge {
  color: var(--color-primary-font);
  margin-right: 4px;
}
</style>
