<template>
  <div :class="[$style.container, 'scroll']">
    <!-- one page for the import of other platforms and the sync of the devices -->
    <div :class="$style.header">
      <button
        v-for="tab in PAGE_TABS" :key="tab" type="button"
        :class="[$style.pageTab, { [$style.active]: tab == pageTab }]" @click="setPageTab(tab)"
      >
        {{ $t(tab == 'import' ? 'import__title' : 'setting__sync') }}
      </button>
    </div>

    <!-- the sync of the devices (the same as in the settings) -->
    <template v-if="pageTab == 'sync'">
      <p v-if="!isServerOn" :class="$style.desc">{{ $t('sync__desktop_tip') }}</p>
      <!-- pairing a phone: the code, big (sync on, server mode) -->
      <section v-if="isServerOn" :class="$style.pairCard">
        <div :class="$style.pairMain">
          <span :class="$style.pairLabel">{{ $t('sync__pair_code') }}</span>
          <strong :class="$style.pairCode">{{ pairCode }}</strong>
          <span :class="$style.pairHint">{{ $t('sync__pair_hint', { name: computerName }) }}</span>
        </div>
        <div :class="$style.pairSide">
          <base-btn min :disabled="!sync.server.status.status" @click="refreshCode">{{ $t('setting__sync_server_refresh_code') }}</base-btn>
          <span :class="$style.pairDevices">{{ connectedDevices ? $t('sync__pair_connected', { devices: connectedDevices }) : $t('sync__pair_none') }}</span>
        </div>
      </section>
      <!-- the settings of the sync: under "Advanced" once it runs (the code is above) -->
      <!-- the main settings (enable, how new devices sync), the others under "Advanced" -->
      <dl :class="$style.sync">
        <SettingSync part="main" />
      </dl>
      <button type="button" :class="$style.advancedBtn" @click="showAdvanced = !showAdvanced">
        {{ $t('sync__advanced') }} {{ showAdvanced ? '▾' : '▸' }}
      </button>
      <dl v-if="showAdvanced" :class="$style.sync">
        <SettingSync part="advanced" />
      </dl>
    </template>

    <template v-else>
    <!-- where from -->
    <template v-if="!job && !preview">
      <p :class="$style.desc">{{ $t('import__desc') }}</p>
      <div :class="$style.tabs">
        <button
          v-for="tab in TABS" :key="tab" type="button"
          :class="[$style.tabBtn, { [$style.active]: tab == activeTab }]" @click="activeTab = tab"
        >
          {{ $t(`import__tab_${tab}`) }}
        </button>
      </div>
      <section v-if="activeTab == 'file'" :class="$style.box">
        <div :class="$style.row">
          <base-btn :disabled="reading" @click="fileInput.click()">{{ reading ? $t('import__reading') : $t('import__file_btn') }}</base-btn>
          <input ref="fileInput" type="file" multiple accept=".csv,.tsv,.txt,.json" :class="$style.hidden" @change="handleFiles">
        </div>
        <p :class="$style.tip">{{ $t('import__file_tip') }}</p>
      </section>
      <section v-else-if="activeTab == 'link'" :class="$style.box">
        <div :class="$style.row">
          <base-input v-model.trim="linkText" :class="$style.input" :placeholder="$t('import__link_placeholder')" @submit="readLink" />
          <base-btn :disabled="reading || !linkText" @click="readLink">{{ reading ? $t('import__reading') : $t('import__read') }}</base-btn>
        </div>
        <p :class="$style.tip">{{ $t('import__link_tip') }}</p>
      </section>
      <section v-else :class="$style.box">
        <div :class="$style.tabs">
          <button
            v-for="platform in ACCOUNT_PLATFORMS" :key="platform" type="button"
            :class="[$style.tabBtn, { [$style.active]: platform == accountPlatform }]" @click="accountPlatform = platform"
          >
            {{ $t(`import__platform_${platform}`) }}
          </button>
        </div>
        <div :class="$style.row">
          <base-input v-model.trim="accountText" :class="$style.input" :placeholder="$t(`import__account_placeholder_${accountPlatform}`)" @submit="readAccount" />
          <base-btn :disabled="reading || !accountText" @click="readAccount">{{ reading ? $t('import__reading') : $t('import__read') }}</base-btn>
        </div>
        <p :class="$style.tip">{{ $t(`import__account_tip_${accountPlatform}`) }}</p>
      </section>
      <p v-if="error" :class="$style.error">{{ error }}</p>
    </template>

    <!-- what -->
    <template v-else-if="!job">
      <section :class="$style.box">
        <h3>{{ preview.title }}</h3>
        <p v-if="preview.note" :class="$style.note">{{ $t(`import__${preview.note}`) }}</p>
        <base-checkbox
          v-if="preview.liked" id="import_liked" :model-value="selection.liked"
          :label="`${$t('import__liked')}${countText(preview.liked.count)} → ${$t('import__to_loved')}`" @update:model-value="selection.liked = $event"
        />
        <template v-if="preview.playlists.length">
          <div :class="$style.groupTitle">
            <span>{{ $t('import__playlists') }} ({{ preview.playlists.length }})</span>
            <button type="button" :class="$style.link" @click="selectAllPlaylists(true)">{{ $t('import__select_all') }}</button>
            <button type="button" :class="$style.link" @click="selectAllPlaylists(false)">{{ $t('import__select_none') }}</button>
          </div>
          <ul :class="$style.playlists">
            <li v-for="playlist in preview.playlists" :key="playlist.key">
              <base-checkbox
                :id="`import_pl_${playlist.key}`" :model-value="selection.playlists.includes(playlist.key)"
                :label="`${playlist.name}${countText(playlist.count)}`" @update:model-value="togglePlaylist(playlist.key, $event)"
              />
            </li>
          </ul>
        </template>
        <base-checkbox
          v-if="preview.artists.length" id="import_artists" :model-value="selection.artists"
          :label="`${$t('import__artists')} (${preview.artists.length})`" @update:model-value="selection.artists = $event"
        />
        <base-checkbox
          v-if="preview.albums.length" id="import_albums" :model-value="selection.albums"
          :label="`${$t('import__albums')} (${preview.albums.length})`" @update:model-value="selection.albums = $event"
        />
      </section>
      <div :class="$style.actions">
        <base-btn :disabled="!hasSelection" @click="startJob">{{ $t('import__start') }}</base-btn>
        <base-btn @click="preview = null">{{ $t('import__back') }}</base-btn>
      </div>
    </template>

    <!-- looking for the songs -->
    <template v-else-if="job.stage == 'loading' || job.stage == 'matching'">
      <section :class="$style.box">
        <h3>{{ job.title }}</h3>
        <p>{{ job.stage == 'loading' ? $t('import__loading') : $t('import__matching', { done: Math.min(job.done, job.total), total: job.total }) }}</p>
        <div :class="$style.bar"><div :class="$style.barFill" :style="{ width: `${progress}%` }" /></div>
        <p :class="$style.tip">{{ $t('import__background_tip') }}</p>
      </section>
      <div :class="$style.actions">
        <base-btn @click="clearImport">{{ $t('import__cancel') }}</base-btn>
      </div>
    </template>

    <!-- the results -->
    <template v-else-if="job.stage == 'review' || job.stage == 'importing'">
      <div :class="$style.reviewHead">
        <h3>{{ $t('import__review') }} · {{ job.title }}</h3>
        <base-checkbox id="import_only_not_found" :model-value="onlyNotFound" :label="$t('import__only_not_found')" @update:model-value="onlyNotFound = $event" />
      </div>
      <p v-if="job.error" :class="$style.error">{{ job.error }}</p>
      <section v-for="(group, groupIndex) in job.groups" :key="groupIndex" :class="$style.box">
        <div :class="$style.groupHead">
          <base-checkbox
            :id="`import_group_${groupIndex}`" :model-value="groupCounts[groupIndex].included > 0" :aria-label="group.name"
            @update:model-value="setImportGroupIncluded(groupIndex, $event)"
          />
          <button type="button" :class="$style.groupName" @click="toggleOpen(groupIndex)">
            <strong>{{ group.kind == 'liked' ? `${$t('import__liked')} → ${$t('import__to_loved')}` : group.name }}</strong>
            <span :class="$style.counts">
              {{ $t('import__counts', { found: groupCounts[groupIndex].found, fallback: groupCounts[groupIndex].fallback, notFound: groupCounts[groupIndex].notFound }) }}
            </span>
            <span :class="$style.arrow">{{ openGroups.includes(groupIndex) ? '▾' : '▸' }}</span>
          </button>
        </div>
        <ul v-if="openGroups.includes(groupIndex)" :class="$style.tracks">
          <li v-for="index in visibleTracks(groupIndex)" :key="index" :class="$style.track">
            <base-checkbox
              :id="`import_t_${index}`" :model-value="job.tracks[index].include" :disabled="!job.tracks[index].musicInfo"
              :aria-label="job.tracks[index].track.name" @update:model-value="setImportTrackIncluded(index, $event)"
            />
            <div :class="$style.trackText">
              <p :class="$style.trackName">{{ job.tracks[index].track.name || job.tracks[index].track.ytId }}<span v-if="job.tracks[index].track.singer"> · {{ job.tracks[index].track.singer }}</span></p>
              <p v-if="job.tracks[index].musicInfo && job.tracks[index].status != 'direct'" :class="$style.trackMatch">
                → {{ job.tracks[index].musicInfo.name }} · {{ job.tracks[index].musicInfo.singer }}
              </p>
            </div>
            <span :class="[$style.chip, $style[job.tracks[index].status]]">{{ statusLabel(job.tracks[index]) }}</span>
            <button v-if="job.tracks[index].status == 'notFound' || job.tracks[index].status == 'fallback'" type="button" :class="$style.link" @click="startRetry(index)">{{ $t('import__retry') }}</button>
          </li>
          <li v-if="hiddenCount(groupIndex)" :class="$style.more">
            <button type="button" :class="$style.link" @click="showAll(groupIndex)">{{ $t('import__show_more', { num: hiddenCount(groupIndex) }) }}</button>
          </li>
        </ul>
      </section>
      <section v-if="job.artists.length" :class="$style.box">
        <div :class="$style.groupTitle"><span>{{ $t('import__artists') }} ({{ job.artists.length }})</span></div>
        <ul :class="$style.artists">
          <li v-for="(item, index) in job.artists" :key="index">
            <base-checkbox :id="`import_a_${index}`" :model-value="item.include" :label="item.artist.name" @update:model-value="setImportArtistIncluded(index, $event)" />
          </li>
        </ul>
      </section>
      <section v-if="job.albums.length" :class="$style.box">
        <div :class="$style.groupTitle"><span>{{ $t('import__albums') }} ({{ job.albums.length }})</span></div>
        <ul :class="$style.tracks">
          <li v-for="(item, index) in job.albums" :key="index" :class="$style.track">
            <base-checkbox
              :id="`import_al_${index}`" :model-value="item.include" :disabled="!item.result" :aria-label="item.album.name"
              @update:model-value="setImportAlbumIncluded(index, $event)"
            />
            <div :class="$style.trackText">
              <p :class="$style.trackName">{{ item.album.name }}<span v-if="item.album.artist"> · {{ item.album.artist }}</span></p>
            </div>
            <span :class="[$style.chip, $style[item.result ? 'found' : 'notFound']]">{{ item.result ? sourceName(item.result.source) : $t('import__not_found') }}</span>
          </li>
        </ul>
      </section>
      <div :class="$style.actions">
        <base-btn :disabled="job.stage == 'importing' || !includedCount" @click="handleFinish">
          {{ job.stage == 'importing' ? $t('import__importing') : $t('import__finish', { num: includedCount }) }}
        </base-btn>
        <base-btn :disabled="job.stage == 'importing'" @click="clearImport">{{ $t('import__cancel') }}</base-btn>
      </div>
    </template>

    <!-- done -->
    <template v-else-if="job.stage == 'done'">
      <section :class="$style.box">
        <h3>{{ $t('import__done') }}</h3>
        <p>{{ $t('import__result', job.result) }}</p>
        <p v-if="job.result.skipped" :class="$style.tip">{{ $t('import__skipped', { num: job.result.skipped }) }}</p>
      </section>
      <div :class="$style.actions">
        <base-btn @click="openLibrary">{{ $t('import__open_library') }}</base-btn>
        <base-btn @click="clearImport">{{ $t('import__again') }}</base-btn>
      </div>
    </template>

    <template v-else>
      <p :class="$style.error">{{ $t('import__failed', { msg: job.error ?? '' }) }}</p>
      <div :class="$style.actions">
        <base-btn @click="clearImport">{{ $t('import__back') }}</base-btn>
      </div>
    </template>
    </template>

    <material-modal :show="retryIndex != null" teleport="#view" width="420px" @close="retryIndex = null">
      <main :class="$style.retry">
        <h2>{{ $t('import__retry') }}</h2>
        <base-input v-model="retryName" :class="$style.input" :placeholder="$t('import__retry_name')" @submit="handleRetry" />
        <base-input v-model="retrySinger" :class="$style.input" :placeholder="$t('import__retry_singer')" @submit="handleRetry" />
        <p v-if="retryMessage" :class="$style.tip">{{ retryMessage }}</p>
        <div :class="$style.actions">
          <base-btn :disabled="retrying || !retryName.trim()" @click="handleRetry">{{ retrying ? $t('import__reading') : $t('import__retry_go') }}</base-btn>
        </div>
      </main>
    </material-modal>
  </div>
</template>

<script setup>
import { computed, markRaw, onBeforeUnmount, reactive, ref, shallowRef } from '@common/utils/vueTools'
import { useRoute, useRouter } from '@common/utils/vueRouter'
import SettingSync from '@renderer/views/Setting/components/SettingSync/index.vue'
import { sourceNames, sync } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { sendSyncAction } from '@renderer/utils/ipc'
import { hostname } from 'node:os'
import '@renderer/core/libraryImport'
import {
  clearImport,
  countImportGroup,
  finishImport,
  getImportFromAccount,
  getImportFromLink,
  getImportJob,
  onImportJobChange,
  parseImportFiles,
  resumeImport,
  retryImportTrack,
  setImportAlbumIncluded,
  setImportArtistIncluded,
  setImportGroupIncluded,
  setImportTrackIncluded,
  startImport,
} from '@renderer/utils/libraryImport'
import { SECONDARY_SOURCE_NAMES } from '@renderer/utils/secondarySources'

// The import of the library of another platform (utils/libraryImport.ts): where from (files, a link, an account),
// what (liked songs, playlists, artists, albums), the songs looked for (in the background), the results checked.

const TABS = ['file', 'link', 'account']
const ACCOUNT_PLATFORMS = ['soundcloud', 'lastfm', 'deezer', 'netease']
const TRACKS_SHOWN = 200

const router = useRouter()
const route = useRoute()

// the code to pair a phone (shown big), the name of this computer (the phones show it)
const isServerOn = computed(() => appSetting['sync.enable'] && appSetting['sync.mode'] == 'server')
const pairCode = computed(() => String(sync.server.status.code || '------').replace(/^(\d{3})(\d{3})$/, '$1 $2'))
const computerName = hostname()
const showAdvanced = ref(false)
const connectedDevices = computed(() => sync.server.status.devices.map(d => d.deviceName).join(', '))
const refreshCode = () => {
  void sendSyncAction({ action: 'generate_code' })
}

// the tabs of the page: the import, the sync (kept in the address: ?tab=sync)
const PAGE_TABS = ['import', 'sync']
const pageTab = computed(() => route.query.tab == 'sync' ? 'sync' : 'import')
const setPageTab = (tab) => {
  void router.replace({ path: route.path, query: tab == 'sync' ? { tab } : {} })
}

const activeTab = ref('file')
const accountPlatform = ref('soundcloud')
const linkText = ref('')
const accountText = ref('')
const reading = ref(false)
const error = ref('')
const fileInput = ref(null)

// what was read, what is chosen
const preview = shallowRef(null)
const selection = reactive({ liked: true, playlists: [], artists: true, albums: true })
const setPreview = (source) => {
  preview.value = markRaw(source)
  selection.liked = !!source.liked
  selection.playlists = source.playlists.filter(p => !p.defaultOff).map(p => p.key)
  selection.artists = source.artists.length > 0
  selection.albums = source.albums.length > 0
}
const read = async(task) => {
  reading.value = true
  error.value = ''
  try {
    setPreview(await task())
  } catch (err) {
    error.value = window.i18n.t('import__error', { msg: err.message })
  } finally {
    reading.value = false
  }
}
const handleFiles = async(event) => {
  const files = Array.from(event.target.files ?? [])
  event.target.value = ''
  if (!files.length) return
  await read(async() => parseImportFiles(await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() })))))
}
const readLink = async() => {
  if (linkText.value) await read(async() => getImportFromLink(linkText.value))
}
const readAccount = async() => {
  if (accountText.value) await read(async() => getImportFromAccount(accountPlatform.value, accountText.value))
}

const countText = (count) => count == null ? '' : ` (${window.i18n.t('import__songs', { num: count })})`
const togglePlaylist = (key, checked) => {
  selection.playlists = checked ? [...selection.playlists, key] : selection.playlists.filter(k => k != key)
}
const selectAllPlaylists = (checked) => {
  selection.playlists = checked ? preview.value.playlists.map(p => p.key) : []
}
const hasSelection = computed(() => {
  const source = preview.value
  if (!source) return false
  return (selection.liked && !!source.liked) || selection.playlists.length > 0 || (selection.artists && source.artists.length > 0) || (selection.albums && source.albums.length > 0)
})
const startJob = () => {
  const source = preview.value
  if (!source) return
  void startImport(source, { liked: selection.liked, playlists: [...selection.playlists], artists: selection.artists, albums: selection.albums }).catch(err => {
    error.value = err.message
  })
  preview.value = null
}

// the import (it goes on when the page is left)
const job = shallowRef(getImportJob())
const offJob = onImportJobChange(value => {
  job.value = value ? markRaw(value) : null
})
onBeforeUnmount(offJob)
void resumeImport()

const progress = computed(() => job.value?.total ? Math.min(100, Math.round(job.value.done / job.value.total * 100)) : 0)
const groupCounts = computed(() => job.value ? job.value.groups.map(group => countImportGroup(job.value, group)) : [])
const includedCount = computed(() => {
  const current = job.value
  if (!current) return 0
  const songs = new Set()
  for (const group of current.groups) for (const index of group.tracks) if (current.tracks[index].include && current.tracks[index].musicInfo) songs.add(index)
  return songs.size + current.artists.filter(a => a.include).length + current.albums.filter(a => a.include && a.result).length
})

const openGroups = ref([0])
const toggleOpen = (index) => {
  openGroups.value = openGroups.value.includes(index) ? openGroups.value.filter(i => i != index) : [...openGroups.value, index]
}
const onlyNotFound = ref(false)
const shownAll = ref([])
const groupTracks = (groupIndex) => {
  const current = job.value
  const indexes = current.groups[groupIndex].tracks
  return onlyNotFound.value ? indexes.filter(index => current.tracks[index].status == 'notFound') : indexes
}
const visibleTracks = (groupIndex) => {
  const indexes = groupTracks(groupIndex)
  return shownAll.value.includes(groupIndex) ? indexes : indexes.slice(0, TRACKS_SHOWN)
}
const hiddenCount = (groupIndex) => shownAll.value.includes(groupIndex) ? 0 : Math.max(0, groupTracks(groupIndex).length - TRACKS_SHOWN)
const showAll = (groupIndex) => {
  shownAll.value = [...shownAll.value, groupIndex]
}

const sourceName = (source) => SECONDARY_SOURCE_NAMES[source] ?? sourceNames.value[source] ?? source
const statusLabel = (item) => {
  switch (item.status) {
    case 'notFound': return window.i18n.t('import__not_found')
    case 'pending': return '…'
    default: return item.musicInfo ? sourceName(item.musicInfo.source) : ''
  }
}

// a song looked for again with another name / artist
const retryIndex = ref(null)
const retryName = ref('')
const retrySinger = ref('')
const retrying = ref(false)
const retryMessage = ref('')
const startRetry = (index) => {
  const track = job.value.tracks[index].track
  retryIndex.value = index
  retryName.value = track.name
  retrySinger.value = track.singer.replaceAll('、', ', ')
  retryMessage.value = ''
}
const handleRetry = async() => {
  if (retryIndex.value == null || !retryName.value.trim()) return
  retrying.value = true
  try {
    const status = await retryImportTrack(retryIndex.value, retryName.value, retrySinger.value)
    if (status == 'notFound') retryMessage.value = window.i18n.t('import__not_found')
    else retryIndex.value = null
  } finally {
    retrying.value = false
  }
}

const handleFinish = () => {
  void finishImport()
}
const openLibrary = () => {
  void router.push({ path: '/library' })
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  padding: 15px 18px 25px;
  display: flex;
  flex-flow: column nowrap;
  gap: 14px;
}
.container > * {
  flex: none;
}
.header {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pageTab {
  border: none;
  background: transparent;
  padding: 4px 4px 6px;
  margin-right: 14px;
  font-size: 18px;
  color: var(--color-font-label);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  &:hover {
    color: var(--color-font);
  }
  &.active {
    color: var(--color-font);
    border-bottom-color: var(--color-primary);
  }
}
.advancedBtn {
  align-self: flex-start;
  border: none;
  background: transparent;
  padding: 4px 0;
  margin-bottom: 10px;
  font-size: 13px;
  color: var(--color-font-label);
  cursor: pointer;
  &:hover {
    color: var(--color-font);
  }
}
.pairCard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 18px 22px;
  margin-bottom: 18px;
  border-radius: 12px;
  background-color: var(--color-primary-background-hover);
}
.pairMain {
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
}
.pairLabel {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-font-label);
}
.pairCode {
  font-size: 40px;
  line-height: 1.1;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
  color: var(--color-primary-font);
  user-select: text;
}
.pairHint {
  font-size: 12px;
  color: var(--color-font-label);
}
.pairSide {
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-end;
  gap: 8px;
}
.pairDevices {
  font-size: 12px;
  color: var(--color-font-label);
  max-width: 280px;
  text-align: right;
}
// the sync settings: styled like the settings page
.sync {
  :global {
    dt {
      padding: 3px 7px;
      margin-top: 6px;
      margin-bottom: 15px;
      font-size: 15px;
      border-left: 5px solid var(--color-primary-alpha-700);
      + dd h3 {
        margin-top: 0;
      }
    }
    dd {
      padding-right: 10px;
      > div {
        margin-left: 16px;
      }
      + dd {
        h3 {
          margin-top: 14px;
        }
      }
      .checkbox,
      .radio {
        font-size: 14px;
      }
    }
    h3 {
      padding-bottom: 8px;
      font-size: 13px;
    }
    .p {
      padding: 3px 0;
      line-height: 1.3;
      .btn {
        + .btn {
          margin-left: 10px;
        }
      }
    }
    .help-btn {
      padding: 0;
      margin: 0 0.4em;
      color: var(--color-button-font);
      cursor: pointer;
      background: none;
      border: none;
      transition: opacity 0.2s ease;
      &:hover {
        opacity: 0.7;
      }
    }
  }
}
.desc, .tip {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-font-label);
}
.note {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-font);
  padding: 6px 10px;
  border-radius: 6px;
  background-color: var(--color-primary-background-hover);
}
.error {
  font-size: 13px;
  color: #e5484d;
  word-break: break-word;
}
.hidden {
  display: none;
}
.tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tabBtn {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 14px;
  font-size: 13px;
  color: var(--color-font-label);
  cursor: pointer;
  &:hover {
    color: var(--color-font);
  }
  &.active {
    color: var(--color-primary-font);
    background-color: var(--color-primary-background-hover);
  }
}
.box {
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 10px;
  background-color: var(--color-primary-light-600-alpha-900, rgba(128, 128, 128, 0.08));
  h3 {
    font-size: 14px;
    color: var(--color-font);
  }
  p {
    font-size: 13px;
    color: var(--color-font);
  }
}
.row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.input {
  flex: auto;
  padding: 8px;
  color: var(--color-font);
}
.actions {
  display: flex;
  gap: 10px;
}
.link {
  border: none;
  background: transparent;
  padding: 0 4px;
  font-size: 12px;
  color: var(--color-primary-font);
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    text-decoration: underline;
  }
}
.groupTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-font);
}
.playlists {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 6px 16px;
  max-height: 320px;
  overflow-y: auto;
}
.artists {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px 16px;
  max-height: 260px;
  overflow-y: auto;
}
.bar {
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background-color: var(--color-primary-background-hover);
}
.barFill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width 0.3s ease;
}
.reviewHead {
  display: flex;
  align-items: center;
  gap: 16px;
  h3 {
    flex: auto;
    font-size: 14px;
    color: var(--color-font);
  }
}
.groupHead {
  display: flex;
  align-items: center;
  gap: 6px;
}
.groupName {
  flex: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--color-font);
  font-size: 13px;
  text-align: left;
}
.counts {
  flex: auto;
  font-size: 12px;
  color: var(--color-font-label);
}
.arrow {
  color: var(--color-font-label);
}
.tracks {
  display: flex;
  flex-flow: column nowrap;
  max-height: 460px;
  overflow-y: auto;
}
.track {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid var(--color-primary-light-500-alpha-900, rgba(128, 128, 128, 0.12));
}
.trackText {
  flex: auto;
  min-width: 0;
  p {
    .mixin-ellipsis-1();
  }
}
.trackName {
  font-size: 13px;
  color: var(--color-font);
  span {
    color: var(--color-font-label);
  }
}
p.trackMatch {
  font-size: 11px;
  color: var(--color-font-label);
}
.chip {
  flex: none;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  color: var(--color-font-label);
  background-color: var(--color-primary-background-hover);
  &.found, &.direct {
    color: var(--color-primary-font);
  }
  &.notFound {
    color: #e5484d;
  }
}
.more {
  padding: 6px 0;
}
.retry {
  padding: 0 15px 15px;
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  h2 {
    font-size: 14px;
    color: var(--color-font);
    padding-top: 15px;
  }
}
</style>
