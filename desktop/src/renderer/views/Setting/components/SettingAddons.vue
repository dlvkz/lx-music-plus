<template lang="pug">
dt#addons {{ $t('setting__addons') }}
dd
  .p.small {{ $t('setting__sources_store_tip') }}
  .p.small.gap-top(v-if="storeLoading") {{ $t('setting__sources_store_loading') }}
  .p.small.gap-top(v-else-if="storeError")
    | {{ $t('setting__sources_store_failed', { message: storeError }) }}
    base-btn.btn.gap-left(min @click="loadStore") {{ $t('setting__sources_store_retry') }}
  div(v-if="storeList.length" :class="$style.all")
    div(:class="$style.info")
      div(:class="$style.name") {{ $t('setting__sources_store_all') }}
      div(:class="$style.meta") {{ installingAll ? $t('setting__sources_store_all_installing', { name: installingAll }) : $t('setting__sources_store_all_tip') }}
    div(:class="$style.actions")
      base-btn.btn(min :disabled="!!storeInstalling" @click="installAll") {{ $t('setting__sources_store_all_btn') }}
  .p.small(v-if="message && messageAt == 'store'" :class="$style.message") {{ message }}
dd
  h3#basic_source {{ $t('setting__basic_source') }}
  .p.small {{ apiRows.length ? $t('setting__sources_api_group_tip') : $t('setting__sources_api_empty') }}
  //- a dropdown: the Music API in use, the others when it is open (one is used at a time)
  ul(v-if="apiRows.length" :class="[$style.list, $style.group, { [$style.open]: apiOpen }]")
    li(
      v-for="(row, index) in visibleApiRows" :key="row.key"
      :class="[$style.item, { [$style.active]: index == 0, [$style.head]: index == 0, [$style.option]: index > 0 }]"
      @click="index == 0 && toggleApis()")
      div(:class="$style.info")
        div(v-if="row.placeholder" :class="$style.name") {{ $t('setting__sources_api_choose') }}
        template(v-else)
          div(:class="$style.name")
            | {{ row.name }}
            span(v-if="row.api && row.api.version" :class="$style.version") {{ row.api.version }}
            span(:class="$style.kind") {{ $t('setting__sources_store_third_party') }}
            span(v-if="forbidsBatchDownload(row.api)" :class="[$style.kind, $style.warn]" :aria-label="$t('setting__sources_no_batch_tip')") {{ $t('setting__sources_no_batch') }}
            span(v-if="isInUse(row)" :class="$style.version") [{{ apiStatus }}]
          div(v-if="rowDescription(row)" :class="$style.meta") {{ rowDescription(row) }}
          div(v-if="rowAuthor(row)" :class="$style.meta") {{ $t('setting__sources_store_by', { author: rowAuthor(row) }) }}
          div(v-if="row.entry && row.entry.homepage" :class="$style.meta")
            span.hover.underline(@click.stop="openUrl(row.entry.homepage)") {{ row.entry.homepage }}
          div(v-if="isInUse(row) && forbidsBatchDownload(row.api)" :class="[$style.meta, $style.warnText]") {{ $t('setting__sources_no_batch_tip') }}
      div(:class="$style.actions" @click.stop)
        template(v-if="row.api")
          span(v-if="isInUse(row)" :class="$style.inUse") {{ $t('setting__sources_in_use') }}
          base-btn.btn(v-else min @click="useApi(row.api)") {{ $t('setting__sources_use') }}
          base-btn.btn(min @click="removeApi(row.api)") {{ $t('setting__addons_remove') }}
        base-btn.btn(v-else-if="row.entry" min :disabled="!!storeInstalling" @click="installFromStore(row.entry)") {{ $t('setting__addons_install') }}
      div(v-if="index == 0" :class="$style.arrow" :aria-label="$t('setting__sources_api_others')")
        svg-icon(name="angle-right-solid")
  div(v-if="userApi.list.length" :class="$style.manage")
    base-btn.btn(min @click="isShowUserApiModal = true") {{ $t('setting__sources_manage') }}
dd
  h3#addons_list {{ $t('setting__addons_title') }}
  .p.small {{ addonRows.length ? $t('setting__sources_addon_group_tip') : $t('setting__addons_empty') }}
  ul(v-if="addonRows.length" :class="[$style.list, $style.group]")
    li(v-for="row in addonRows" :key="row.key" :class="$style.item")
      div(:class="$style.info")
        div(:class="$style.name")
          | {{ row.name }}
          span(v-if="row.addon" :class="$style.version") {{ row.addon.version }}
          span(v-if="row.addon && !isAddonLoaded(row.addon.id)" :class="$style.error") {{ $t('setting__addons_load_error') }}
          span(v-if="rowAuthor(row) != 'dlvkz'" :class="$style.kind") {{ $t('setting__sources_store_third_party') }}
        div(v-if="rowDescription(row)" :class="$style.meta") {{ rowDescription(row) }}
        div(:class="$style.meta")
          | {{ $t('setting__addons_plays', { sources: sourceNames(row.addon ? row.addon.sources : row.entry.plays) }) }}
          template(v-if="rowAuthor(row)")  · {{ $t('setting__sources_store_by', { author: rowAuthor(row) }) }}
        div(v-if="rowHomepage(row)" :class="$style.meta")
          span.hover.underline(@click="openUrl(rowHomepage(row))") {{ rowHomepage(row) }}
      div(:class="$style.actions")
        template(v-if="row.addon")
          base-checkbox(:id="`addon_${row.addon.id}`" :model-value="row.addon.enabled" :label="$t('setting__addons_enabled')" @update:model-value="setAddonEnabled(row.addon.id, $event)")
          base-btn.btn(v-if="hasStoreUpdate(row)" min :disabled="!!storeInstalling" @click="installFromStore(row.entry)") {{ $t('setting__addons_update') }}
          base-btn.btn(v-else-if="!row.entry && row.addon.url" min :disabled="updating == row.addon.id" @click="update(row.addon)") {{ $t('setting__addons_update') }}
          base-btn.btn(min @click="remove(row.addon)") {{ $t('setting__addons_remove') }}
        base-btn.btn(v-else min :disabled="!!storeInstalling" @click="installFromStore(row.entry)") {{ $t('setting__addons_install') }}
dd
  h3#sources_add {{ $t('setting__sources_add') }}
  .p.small {{ $t('setting__sources_add_tip') }}
  .gap-top(:class="$style.install")
    base-input(v-model="url" :class="$style.input" :placeholder="$t('setting__addons_url_placeholder')" @submit="installFromUrl")
    base-btn.btn.gap-left(min :disabled="installing || !url.trim()" @click="installFromUrl") {{ installing ? $t('setting__addons_installing') : $t('setting__addons_install') }}
    base-btn.btn.gap-left(min :disabled="installing" @click="installFromFile") {{ $t('setting__addons_install_file') }}
  .p.small(v-if="message && messageAt == 'add'" :class="$style.message") {{ message }}
dd
  h3#basic_source_switch {{ $t('setting__basic_source_switch') }}
  div
    base-checkbox(id="setting_basic_source_switch" :model-value="appSetting['common.isShowSourceSwitch']" :label="$t('setting__basic_source_switch_label')" @update:model-value="updateSetting({'common.isShowSourceSwitch': $event})")
dd
  h3#basic_sourcename {{ $t('setting__basic_sourcename') }}
  div
    base-checkbox.gap-left(
      v-for="item in sourceNameTypes" :id="`setting_abasic_sourcename_${item.id}`" :key="item.id"
      name="setting_basic_sourcename" need :model-value="appSetting['common.sourceNameType']" :value="item.id" :label="item.label" @update:model-value="updateSetting({'common.sourceNameType': $event})")
user-api-modal(v-model="isShowUserApiModal")
</template>

<script>
import { computed, onBeforeUnmount, ref } from '@common/utils/vueTools'
import { openUrl } from '@common/utils/electron'
import { readFile } from '@common/utils/nodejs'
import { dialog } from '@renderer/plugins/Dialog'
import { useI18n } from '@renderer/plugins/i18n'
import { importUserApi, removeUserApi, showSelectDialog } from '@renderer/utils/ipc'
import { userApi } from '@renderer/store'
import { appSetting, updateSetting } from '@renderer/store/setting'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import UserApiModal from './UserApiModal.vue'
import {
  fetchAddon, fetchSourceStore, forbidsBatchDownload, getAddons, getDefaultStoreApi, getSourceName, getSourceRows, hasStoreUpdate,
  installAddon, isAddonLoaded, onAddonsChange, readSourceScript, removeAddon, setAddonEnabled, updateAddon,
} from '@renderer/utils/sourceAddons'

// The sources: the store of the sources repository and the sources installed in one list (utils/sourceAddons.ts
// getSourceRows), the Music APIs (custom sources of LX Music: the Chinese platforms, one used at a time) then the
// source addons (the audio of the secondary sources), more of them from a link or a file
export default {
  name: 'SettingAddons',
  components: {
    UserApiModal,
  },
  setup() {
    const t = useI18n()
    const isShowUserApiModal = ref(false)
    const apiStatus = computed(() => {
      if (userApi.status) return t('setting__basic_source_status_success')
      if (userApi.message == 'initing') return t('setting__basic_source_status_initing')
      return t('setting__basic_source_status_failed')
    })

    const sourceNameTypes = computed(() => {
      return [
        { id: 'real', label: t('setting__basic_sourcename_real') },
        { id: 'alias', label: t('setting__basic_sourcename_alias') },
      ]
    })

    const list = ref(getAddons())
    const url = ref('')
    const message = ref('')
    const messageAt = ref('add')
    const installing = ref(false)
    const updating = ref('')

    onBeforeUnmount(onAddonsChange(addons => { list.value = addons }))

    const sourceNames = sources => sources.map(source => getSourceName(source, String(window.i18n.locale ?? ''))).join(', ')

    // the store: the sources of the sources repository (utils/sourceAddons.ts fetchSourceStore)
    const storeList = ref([])
    const storeLoading = ref(false)
    const storeError = ref('')
    const storeInstalling = ref('')
    const loadStore = async() => {
      storeLoading.value = true
      storeError.value = ''
      try {
        storeList.value = await fetchSourceStore()
      } catch (err) {
        storeError.value = err.message
      }
      storeLoading.value = false
    }
    void loadStore()

    const rows = computed(() => getSourceRows(storeList.value, list.value, userApi.list))
    const apiRows = computed(() => rows.value.filter(row => row.kind == 'api'))
    const addonRows = computed(() => rows.value.filter(row => row.kind == 'addon'))
    const isInUse = row => !!row.api && row.api.id == appSetting['common.apiSource']
    // the dropdown of the Music APIs: the one in use (or a choice to make), the others when it is open
    const apiOpen = ref(false)
    const visibleApiRows = computed(() => {
      const current = apiRows.value.find(isInUse)
      const head = current ?? { key: 'none', placeholder: true }
      return apiOpen.value ? [head, ...apiRows.value.filter(row => row != current)] : [head]
    })
    const toggleApis = () => { apiOpen.value = !apiOpen.value }
    const useApi = api => {
      updateSetting({ 'common.apiSource': api.id })
      apiOpen.value = false
    }
    const isZh = () => String(window.i18n.locale ?? '').toLowerCase().startsWith('zh')
    const rowDescription = row => {
      if (row.entry) return isZh() && row.entry.descriptionZh ? row.entry.descriptionZh : row.entry.description
      return row.api?.description ?? row.addon?.description ?? ''
    }
    const rowAuthor = row => row.entry?.author || row.api?.author || row.addon?.author || ''
    const rowHomepage = row => row.entry?.homepage || row.addon?.homepage || ''

    // a Music API or an addon (what it is: from its text), the user agrees to install it (it runs with the
    // rights of the app)
    const install = async(code, link, at = 'add') => {
      messageAt.value = at
      message.value = ''
      let info
      try {
        info = readSourceScript(code)
      } catch (err) {
        message.value = t('setting__addons_failed', { message: err.message })
        return
      }
      if (info.kind == 'api' && userApi.list.length >= 20) {
        message.value = t('setting__sources_api_max')
        return
      }
      const confirmed = await dialog.confirm({
        message: `${t('setting__addons_warning_title')}\n\n${t('setting__addons_warning', {
          name: info.name,
          version: info.version,
          author: info.author || t('setting__addons_unknown_author'),
          kind: t(info.kind == 'api' ? 'setting__sources_kind_api' : 'setting__sources_kind_addon'),
        })}`,
        confirmButtonText: t('setting__addons_install'),
      })
      if (!confirmed) return
      try {
        if (info.kind == 'api') {
          const { apiList } = await importUserApi(code)
          userApi.list = apiList
          applyDefaultApi(apiList.at(-1))
        } else await installAddon(code, link)
        message.value = t('setting__addons_installed', { name: info.name })
        if (link && at == 'add') url.value = ''
      } catch (err) {
        message.value = t('setting__addons_failed', { message: err.message })
      }
    }

    // the default sources: everything of the store installed and on (the addons enabled, the default Music API of
    // the store used when none is)
    // no Music API in use (a new install): the default one of the store (野草), else the one just installed
    const applyDefaultApi = (installed) => {
      if (userApi.list.some(api => api.id == appSetting['common.apiSource'])) return
      const api = getDefaultStoreApi(storeList.value, userApi.list) ?? installed
      if (api) updateSetting({ 'common.apiSource': api.id })
    }
    const installingAll = ref('')
    const installAll = async() => {
      messageAt.value = 'store'
      message.value = ''
      const entries = rows.value.filter(row => row.entry && ((!row.addon && !row.api) || hasStoreUpdate(row))).map(row => row.entry)
      if (entries.length) {
        const confirmed = await dialog.confirm({
          message: `${t('setting__sources_store_all_title')}\n\n${t('setting__sources_store_all_confirm', {
            num: entries.length,
            names: entries.map(entry => `· ${entry.name}`).join('\n'),
          })}`,
          confirmButtonText: t('setting__sources_store_all_btn'),
        })
        if (!confirmed) return
      }
      storeInstalling.value = 'all'
      let done = 0
      const failed = []
      for (const entry of entries) {
        installingAll.value = entry.name
        try {
          const code = await fetchAddon(entry.url)
          if (readSourceScript(code).kind == 'api') {
            if (userApi.list.length >= 20) throw new Error(t('setting__sources_api_max'))
            const { apiList } = await importUserApi(code)
            userApi.list = apiList
          } else await installAddon(code, entry.url)
          done++
        } catch {
          failed.push(entry.name)
        }
      }
      installingAll.value = ''
      for (const entry of storeList.value) {
        if (entry.kind == 'addon' && list.value.some(addon => addon.id == entry.id && !addon.enabled)) await setAddonEnabled(entry.id, true)
      }
      applyDefaultApi()
      storeInstalling.value = ''
      if (!entries.length) message.value = t('setting__sources_store_all_none')
      else if (failed.length) message.value = t('setting__sources_store_all_partial', { num: done, names: failed.join(', ') })
      else message.value = t('setting__sources_store_all_done', { num: done })
    }
    const installFromStore = async entry => {
      storeInstalling.value = entry.id
      messageAt.value = 'store'
      message.value = ''
      let code
      try {
        code = await fetchAddon(entry.url)
      } catch (err) {
        message.value = t('setting__addons_failed', { message: err.message })
        storeInstalling.value = ''
        return
      }
      await install(code, entry.url, 'store')
      storeInstalling.value = ''
    }

    const installFromUrl = async() => {
      const link = url.value.trim()
      if (!link || installing.value) return
      messageAt.value = 'add'
      if (!/^https?:\/\//.test(link)) {
        message.value = t('setting__addons_failed', { message: 'not a link' })
        return
      }
      installing.value = true
      message.value = ''
      let code
      try {
        code = await fetchAddon(link)
      } catch (err) {
        message.value = t('setting__addons_failed', { message: err.message })
        return
      } finally {
        installing.value = false
      }
      await install(code, link)
    }

    const installFromFile = async() => {
      const result = await showSelectDialog({
        title: t('setting__addons_install_file'),
        properties: ['openFile'],
        filters: [
          { name: 'Source script', extensions: ['js'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (result.canceled || !result.filePaths.length) return
      try {
        await install((await readFile(result.filePaths[0])).toString(), '')
      } catch (err) {
        messageAt.value = 'add'
        message.value = t('setting__addons_failed', { message: err.message })
      }
    }

    const update = async addon => {
      updating.value = addon.id
      messageAt.value = 'store'
      message.value = ''
      try {
        message.value = await updateAddon(addon.id)
          ? t('setting__addons_updated', { name: addon.name })
          : t('setting__addons_up_to_date', { name: addon.name })
      } catch (err) {
        message.value = t('setting__addons_update_failed', { message: err.message })
      }
      updating.value = ''
    }

    const remove = async addon => {
      if (!await dialog.confirm({
        message: t('setting__addons_remove_confirm', { name: addon.name }),
        confirmButtonText: t('setting__addons_remove'),
      })) return
      await removeAddon(addon.id)
    }

    // a Music API removed: another one is used when it was the one in use
    const removeApi = async api => {
      if (!await dialog.confirm({
        message: t('setting__addons_remove_confirm', { name: api.name }),
        confirmButtonText: t('setting__addons_remove'),
      })) return
      if (appSetting['common.apiSource'] == api.id) {
        const backApi = apiSourceInfo.find(item => !item.disabled) ?? userApi.list.find(item => item.id != api.id)
        updateSetting({ 'common.apiSource': backApi?.id ?? '' })
      }
      userApi.list = await removeUserApi([api.id])
    }

    return {
      storeList,
      storeLoading,
      storeError,
      storeInstalling,
      loadStore,
      installFromStore,
      installAll,
      installingAll,
      apiRows,
      addonRows,
      apiOpen,
      visibleApiRows,
      toggleApis,
      useApi,
      isInUse,
      rowDescription,
      rowAuthor,
      rowHomepage,
      hasStoreUpdate,
      forbidsBatchDownload,
      apiStatus,
      userApi,
      messageAt,
      appSetting,
      updateSetting,
      isShowUserApiModal,
      sourceNameTypes,
      url,
      message,
      installing,
      updating,
      openUrl,
      isAddonLoaded,
      setAddonEnabled,
      sourceNames,
      installFromUrl,
      installFromFile,
      update,
      remove,
      removeApi,
    }
  },
}
</script>

<style lang="less" module>
.manage {
  margin-top: 10px;
}
.head {
  cursor: pointer;
}
.option {
  margin-left: 20px;
}
.arrow {
  flex: none;
  display: flex;
  width: 16px;
  height: 16px;
  color: var(--color-font-label);
  transform: rotate(90deg);
  transition: transform .2s ease;
  svg {
    width: 100%;
    height: 100%;
  }
}
.open .arrow {
  transform: rotate(-90deg);
}
.inUse {
  font-size: 12px;
  color: var(--color-primary-font);
}
.all {
  display: flex;
  align-items: center;
  gap: 15px;
  max-width: 720px;
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--color-primary-light-300-alpha-700);
}
.group {
  margin-top: 10px;
}
.kind {
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--color-font-label);
  background-color: var(--color-primary-light-200-alpha-900);
}
.warn {
  color: #e53935;
  background-color: rgba(229, 57, 53, .1);
}
.warnText {
  color: #e53935;
}
.install {
  display: flex;
  align-items: center;
}
.input {
  width: 320px;
}
.message {
  margin-top: 8px;
  color: var(--color-primary-font);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 720px;
}
.item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background-color: var(--color-primary-light-100-alpha-900);
}
.active {
  border-color: var(--color-primary-light-300-alpha-700);
}
.info {
  flex: auto;
  min-width: 0;
}
.name {
  font-size: 14px;
}
.version {
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-font-label);
}
.error {
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-font-error, #e53935);
}
.meta {
  margin-top: 3px;
  font-size: 12px;
  color: var(--color-font-label);
  word-break: break-all;
}
.actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
