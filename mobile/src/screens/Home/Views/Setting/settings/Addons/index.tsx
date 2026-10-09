import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Section from '../../components/Section'
import Button from '../../components/Button'
import SubTitle from '../../components/SubTitle'
import SourceName from '../Basic/SourceName'
import IsShowSourceSwitch from '../Basic/IsShowSourceSwitch'
import UserApiEditModal, { type UserApiEditModalType } from '../Basic/UserApiEditModal'
import CheckBox from '@/components/common/CheckBox'
import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { confirmDialog, createStyle, openUrl } from '@/utils/tools'
import { readFile } from '@/utils/fs'
import {
  fetchAddon, fetchSourceStore, forbidsBatchDownload, getAddons, getDefaultStoreApi, getSourceName, getSourceRows, hasStoreUpdate,
  installAddon, isAddonLoaded, onAddonsChange, readSourceScript, removeAddon, setAddonEnabled, updateAddon,
  type AddonInfo, type SourceRow, type SourceScriptInfo, type StoreEntry,
} from '@/utils/sourceAddons'
import { importUserApi, removeUserApi } from '@/core/userApi'
import { setApiSource } from '@/core/apiSource'
import settingState from '@/store/setting/state'
import apiSourceInfo from '@/utils/musicSdk/api-source-info'
import { state as userApiState, useStatus, useUserApiList } from '@/store/userApi'

// The sources: the store of the sources repository and the sources installed in one list (utils/sourceAddons.ts
// getSourceRows), the Music APIs (custom sources of LX Music: the Chinese platforms, one used at a time) then the
// source addons (the audio of the secondary sources), more of them from a link or a file
const sourceNames = (sources: string[]) => sources.map(source => getSourceName(source, String(global.i18n.locale ?? ''))).join(', ')
const isZh = () => String(global.i18n.locale ?? '').toLowerCase().startsWith('zh')
const rowDescription = (row: SourceRow) => {
  if (row.entry) return isZh() && row.entry.descriptionZh ? row.entry.descriptionZh : row.entry.description
  return row.api?.description ?? row.addon?.description ?? ''
}
// the first text that is not empty
const firstText = (...texts: Array<string | null | undefined>) => texts.find(text => text) ?? ''
const rowAuthor = (row: SourceRow) => firstText(row.entry?.author, row.api?.author, row.addon?.author)
const rowHomepage = (row: SourceRow) => firstText(row.entry?.homepage, row.addon?.homepage)

const SourceItem = memo(({ row, inUse, apiStatus, busy, updating, head, open, option, onToggle, onInstall, onUse, onRemoveApi, onUpdate, onRemove }: {
  row: SourceRow
  /** the head of the dropdown of the Music APIs */
  head?: boolean
  open?: boolean
  /** an option of the dropdown */
  option?: boolean
  onToggle?: () => void
  inUse: boolean
  apiStatus: string
  busy: boolean
  updating: boolean
  onInstall: (entry: StoreEntry) => void
  onUse: (id: string) => void
  onRemoveApi: (api: NonNullable<SourceRow['api']>) => void
  onUpdate: (row: SourceRow) => void
  onRemove: (addon: AddonInfo) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const description = rowDescription(row)
  const author = rowAuthor(row)
  const homepage = rowHomepage(row)
  const noBatch = forbidsBatchDownload(row.api)
  const version = row.api?.version ?? row.addon?.version ?? ''
  const thirdParty = row.kind == 'api' || author != 'dlvkz'
  return (
    <TouchableOpacity
      disabled={!head}
      style={{ ...styles.item, ...(option ? styles.option : null), backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: inUse ? theme['c-primary-light-300-alpha-700'] : 'transparent' }}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {head ? <Icon name="chevron-right" size={14} color={theme['c-font-label']} style={{ ...styles.arrow, transform: [{ rotate: open ? '-90deg' : '90deg' }] }} /> : null}
      <Text size={15} style={head ? styles.headName : undefined}>
        {row.name}
        {version ? <Text size={12} color={theme['c-font-label']}>{`  ${version}`}</Text> : null}
        {thirdParty ? <Text size={12} color={theme['c-font-label']}>{` · ${t('setting__sources_store_third_party')}`}</Text> : null}
        {row.addon && !isAddonLoaded(row.addon.id) ? <Text size={12} color="#e53935">{`  ${t('setting__addons_load_error')}`}</Text> : null}
        {inUse ? <Text size={12} color={theme['c-font-label']}>{`  [${apiStatus}]`}</Text> : null}
      </Text>
      {noBatch ? <Text size={12} color="#e53935" style={styles.meta}>{t('setting__sources_no_batch')}</Text> : null}
      {description ? <Text size={12} color={theme['c-font-label']} style={styles.meta}>{description}</Text> : null}
      {
        row.kind == 'addon'
          ? (
              <Text size={12} color={theme['c-font-label']} style={styles.meta}>
                {t('setting__addons_plays', { sources: sourceNames(row.addon ? row.addon.sources : row.entry?.plays ?? []) })}
                {author ? ` · ${t('setting__sources_store_by', { author })}` : ''}
              </Text>
            )
          : author ? <Text size={12} color={theme['c-font-label']} style={styles.meta}>{t('setting__sources_store_by', { author })}</Text> : null
      }
      {homepage ? <Text size={12} color={theme['c-primary-font']} style={styles.meta} onPress={() => { void openUrl(homepage) }}>{homepage}</Text> : null}
      {inUse && noBatch ? <Text size={12} color="#e53935" style={styles.meta}>{t('setting__sources_no_batch_tip')}</Text> : null}
      <View style={styles.actions}>
        {
          row.api
            ? (
                <>
                  {
                    inUse
                      ? <Text size={13} color={theme['c-primary-font']} style={styles.inUse}>{t('setting__sources_in_use')}</Text>
                      : <Button onPress={() => { onUse(row.api!.id) }}>{t('setting__sources_use')}</Button>
                  }
                  <Button onPress={() => { onRemoveApi(row.api!) }}>{t('setting__addons_remove')}</Button>
                </>
              )
            : row.addon
              ? (
                  <>
                    <CheckBox check={row.addon.enabled} label={t('setting__addons_enabled')} onChange={check => { void setAddonEnabled(row.addon!.id, check) }} />
                    {
                      hasStoreUpdate(row) || (!row.entry && row.addon.url)
                        ? <Button disabled={busy || updating} onPress={() => { onUpdate(row) }}>{t('setting__addons_update')}</Button>
                        : null
                    }
                    <Button onPress={() => { onRemove(row.addon!) }}>{t('setting__addons_remove')}</Button>
                  </>
                )
              : <Button disabled={busy} onPress={() => { if (row.entry) onInstall(row.entry) }}>{t('setting__addons_install')}</Button>
        }
      </View>
    </TouchableOpacity>
  )
})

export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const [list, setList] = useState(getAddons)
  const [url, setUrl] = useState('')
  const [message, setMessage] = useState('')
  const [installing, setInstalling] = useState(false)
  const [updating, setUpdating] = useState('')
  const [isShowChoosePath, setShowChoosePath] = useState(false)
  const [messageAt, setMessageAt] = useState<'store' | 'add'>('add')
  const [storeList, setStoreList] = useState<StoreEntry[]>([])
  const [storeLoading, setStoreLoading] = useState(false)
  const [storeError, setStoreError] = useState('')
  const [storeInstalling, setStoreInstalling] = useState('')
  const [installingAll, setInstallingAll] = useState('')
  const userApiList = useUserApiList()
  const apiStatusInfo = useStatus()
  const apiSourceId = useSettingValue('common.apiSource')
  const choosePathRef = useRef<ChoosePathType>(null)
  const userApiModalRef = useRef<UserApiEditModalType>(null)
  const [apiOpen, setApiOpen] = useState(false)

  useEffect(() => onAddonsChange(setList), [])

  // the store: the sources of the sources repository (utils/sourceAddons.ts fetchSourceStore)
  const loadStore = () => {
    setStoreLoading(true)
    setStoreError('')
    fetchSourceStore().then(setStoreList).catch((err: any) => {
      setStoreError(String(err.message))
    }).finally(() => {
      setStoreLoading(false)
    })
  }
  useEffect(loadStore, [])

  const rows = useMemo(() => getSourceRows(storeList, list, userApiList), [storeList, list, userApiList])
  const apiRows = rows.filter(row => row.kind == 'api')
  const addonRows = rows.filter(row => row.kind == 'addon')
  const apiStatus = apiStatusInfo.status
    ? t('setting_basic_source_status_success')
    : apiStatusInfo.message == 'initing' ? t('setting_basic_source_status_initing') : t('setting_basic_source_status_failed')

  // a Music API or an addon (what it is: from its text), the user agrees to install it (it runs with the
  // rights of the app)
  const install = async(code: string, link: string, at: 'store' | 'add' = 'add') => {
    setMessageAt(at)
    setMessage('')
    let info: SourceScriptInfo
    try {
      info = readSourceScript(code)
    } catch (err: any) {
      setMessage(t('setting__addons_failed', { message: err.message }))
      return
    }
    if (info.kind == 'api' && userApiState.list.length >= 20) {
      setMessage(t('setting__sources_api_max'))
      return
    }
    const confirmed = await confirmDialog({
      title: t('setting__addons_warning_title'),
      message: t('setting__addons_warning', {
        name: info.name,
        version: info.version,
        author: info.author || t('setting__addons_unknown_author'),
        kind: t(info.kind == 'api' ? 'setting__sources_kind_api' : 'setting__sources_kind_addon'),
      }),
      confirmButtonText: t('setting__addons_install'),
    })
    if (!confirmed) return
    try {
      if (info.kind == 'api') {
        await importUserApi(code)
        applyDefaultApi(userApiState.list.at(-1))
      } else await installAddon(code, link)
      setMessage(t('setting__addons_installed', { name: info.name }))
      if (link && at == 'add') setUrl('')
    } catch (err: any) {
      setMessage(t('setting__addons_failed', { message: err.message }))
    }
  }

  // no Music API in use (a new install): the default one of the store (野草), else the one just installed
  const applyDefaultApi = (installed?: LX.UserApi.UserApiInfo) => {
    if (userApiState.list.some(api => api.id == settingState.setting['common.apiSource'])) return
    const api = getDefaultStoreApi(storeList, userApiState.list) ?? installed
    if (api) setApiSource(api.id)
  }

  // the default sources: everything of the store installed and on (the addons enabled, the default Music API of
  // the store used when none is)
  const installAll = async() => {
    setMessageAt('store')
    setMessage('')
    const entries = rows.filter(row => row.entry && ((!row.addon && !row.api) || hasStoreUpdate(row))).map(row => row.entry!)
    if (entries.length && !await confirmDialog({
      title: t('setting__sources_store_all_title'),
      message: t('setting__sources_store_all_confirm', { num: entries.length, names: entries.map(entry => `· ${entry.name}`).join('\n') }),
      confirmButtonText: t('setting__sources_store_all_btn'),
    })) return
    setStoreInstalling('all')
    let done = 0
    const failed: string[] = []
    for (const entry of entries) {
      setInstallingAll(entry.name)
      try {
        const code = await fetchAddon(entry.url)
        if (readSourceScript(code).kind == 'api') {
          if (userApiState.list.length >= 20) throw new Error(t('setting__sources_api_max'))
          await importUserApi(code)
        } else await installAddon(code, entry.url)
        done++
      } catch {
        failed.push(entry.name)
      }
    }
    setInstallingAll('')
    for (const entry of storeList) {
      if (entry.kind == 'addon' && getAddons().some(addon => addon.id == entry.id && !addon.enabled)) await setAddonEnabled(entry.id, true)
    }
    applyDefaultApi()
    setStoreInstalling('')
    if (!entries.length) setMessage(t('setting__sources_store_all_none'))
    else if (failed.length) setMessage(t('setting__sources_store_all_partial', { num: done, names: failed.join(', ') }))
    else setMessage(t('setting__sources_store_all_done', { num: done }))
  }

  const installFromStore = async(entry: StoreEntry) => {
    setStoreInstalling(entry.id)
    setMessageAt('store')
    setMessage('')
    try {
      await install(await fetchAddon(entry.url), entry.url, 'store')
    } catch (err: any) {
      setMessage(t('setting__addons_failed', { message: err.message }))
    }
    setStoreInstalling('')
  }

  const installFromUrl = async() => {
    const link = url.trim()
    if (!link || installing) return
    setMessageAt('add')
    if (!/^https?:\/\//.test(link)) {
      setMessage(t('setting__addons_failed', { message: 'not a link' }))
      return
    }
    setInstalling(true)
    setMessage('')
    let code: string
    try {
      code = await fetchAddon(link)
    } catch (err: any) {
      setMessage(t('setting__addons_failed', { message: err.message }))
      return
    } finally {
      setInstalling(false)
    }
    await install(code, link)
  }

  const showChoosePath = () => {
    const options = { title: t('setting__addons_install_file'), dirOnly: false, filter: ['js'] }
    if (isShowChoosePath) choosePathRef.current?.show(options)
    else {
      setShowChoosePath(true)
      requestAnimationFrame(() => {
        choosePathRef.current?.show(options)
      })
    }
  }
  const installFromFile = (path: string) => {
    void readFile(path).then(async code => {
      if (code == null) throw new Error('Read file failed')
      await install(code, '')
    }).catch((err: any) => {
      setMessageAt('add')
      setMessage(t('setting__addons_failed', { message: err.message }))
    })
  }

  // an addon: its version of the store, else from the link it was installed from
  const update = async(row: SourceRow) => {
    if (hasStoreUpdate(row) && row.entry) {
      await installFromStore(row.entry)
      return
    }
    const addon = row.addon!
    setUpdating(addon.id)
    setMessageAt('store')
    setMessage('')
    try {
      setMessage(await updateAddon(addon.id)
        ? t('setting__addons_updated', { name: addon.name })
        : t('setting__addons_up_to_date', { name: addon.name }))
    } catch (err: any) {
      setMessage(t('setting__addons_update_failed', { message: err.message }))
    }
    setUpdating('')
  }

  const remove = async(addon: AddonInfo) => {
    if (!await confirmDialog({
      message: t('setting__addons_remove_confirm', { name: addon.name }),
      confirmButtonText: t('setting__addons_remove'),
    })) return
    await removeAddon(addon.id)
  }

  // a Music API removed: another one is used when it was the one in use
  const removeApi = async(api: NonNullable<SourceRow['api']>) => {
    if (!await confirmDialog({
      message: t('setting__addons_remove_confirm', { name: api.name }),
      confirmButtonText: t('setting__addons_remove'),
    })) return
    await removeUserApi([api.id])
    if (settingState.setting['common.apiSource'] == api.id) {
      const backApiId = apiSourceInfo.find(item => !item.disabled)?.id ?? userApiState.list[0]?.id
      if (backApiId) setApiSource(backApiId)
    }
  }

  const useApi = (id: string) => {
    setApiSource(id)
    setApiOpen(false)
  }
  const toggleApis = () => { setApiOpen(open => !open) }
  // the dropdown of the Music APIs: the one in use (or a choice to make), the others when it is open
  const currentApiRow = apiRows.find(row => row.api?.id == apiSourceId)
  const otherApiRows = apiRows.filter(row => row != currentApiRow)

  const renderRow = (row: SourceRow, props: { head?: boolean, open?: boolean, option?: boolean, onToggle?: () => void } = {}) => (
    <SourceItem
      {...props}
      key={row.key}
      row={row}
      inUse={!!row.api && row.api.id == apiSourceId}
      apiStatus={apiStatus}
      busy={!!storeInstalling}
      updating={!!row.addon && updating == row.addon.id}
      onInstall={entry => { void installFromStore(entry) }}
      onUse={useApi}
      onRemoveApi={api => { void removeApi(api) }}
      onUpdate={row => { void update(row) }}
      onRemove={addon => { void remove(addon) }}
    />
  )

  return (
    <Section title={t('setting__addons')}>
      <View style={styles.top}>
        <Text size={13} color={theme['c-font-label']}>{t('setting__sources_store_tip')}</Text>
        {
          storeLoading
            ? <Text size={13} color={theme['c-font-label']} style={styles.message}>{t('setting__sources_store_loading')}</Text>
            : storeError
              ? (
                  <View style={styles.buttons}>
                    <Text size={13} color={theme['c-font-label']} style={styles.storeError}>{t('setting__sources_store_failed', { message: storeError })}</Text>
                    <Button onPress={loadStore}>{t('setting__sources_store_retry')}</Button>
                  </View>
                )
              : null
        }
        {
          storeList.length
            ? (
                <View style={{ ...styles.all, borderColor: theme['c-primary-light-300-alpha-700'] }}>
                  <Text size={15}>{t('setting__sources_store_all')}</Text>
                  <Text size={12} color={theme['c-font-label']} style={styles.meta}>
                    {installingAll ? t('setting__sources_store_all_installing', { name: installingAll }) : t('setting__sources_store_all_tip')}
                  </Text>
                  <View style={styles.actions}>
                    <Button disabled={!!storeInstalling} onPress={() => { void installAll() }}>{t('setting__sources_store_all_btn')}</Button>
                  </View>
                </View>
              )
            : null
        }
        {message && messageAt == 'store' ? <Text size={13} color={theme['c-primary-font']} style={styles.message}>{message}</Text> : null}
      </View>
      <View style={styles.gap} />
      <SubTitle title={t('setting_basic_source')}>
        <View style={styles.content}>
          <Text size={13} color={theme['c-font-label']}>{apiRows.length ? t('setting__sources_api_group_tip') : t('setting__sources_api_empty')}</Text>
          {
            apiRows.length
              ? currentApiRow
                ? renderRow(currentApiRow, { head: true, open: apiOpen, onToggle: toggleApis })
                : (
                    <TouchableOpacity style={{ ...styles.item, backgroundColor: theme['c-primary-light-100-alpha-900'], borderColor: 'transparent' }} onPress={toggleApis} activeOpacity={0.7}>
                      <Icon name="chevron-right" size={14} color={theme['c-font-label']} style={{ ...styles.arrow, transform: [{ rotate: apiOpen ? '-90deg' : '90deg' }] }} />
                      <Text size={15} style={styles.headName}>{t('setting__sources_api_choose')}</Text>
                    </TouchableOpacity>
                  )
              : null
          }
          {apiOpen ? otherApiRows.map(row => renderRow(row, { option: true })) : null}
          {
            userApiList.length
              ? (
                  <View style={styles.buttons}>
                    <Button onPress={() => { userApiModalRef.current?.show() }}>{t('setting__sources_manage')}</Button>
                  </View>
                )
              : null
          }
        </View>
      </SubTitle>
      <View style={styles.gap} />
      <SubTitle title={t('setting__addons_title')}>
        <View style={styles.content}>
          <Text size={13} color={theme['c-font-label']}>{addonRows.length ? t('setting__sources_addon_group_tip') : t('setting__addons_empty')}</Text>
          {addonRows.map(row => renderRow(row))}
        </View>
      </SubTitle>
      <View style={styles.gap} />
      <SubTitle title={t('setting__sources_add')}>
        <View style={styles.content}>
          <Text size={13} color={theme['c-font-label']}>{t('setting__sources_add_tip')}</Text>
          <View style={styles.inputRow}>
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder={t('setting__addons_url_placeholder')}
              autoCapitalize="none"
              onSubmitEditing={() => { void installFromUrl() }}
              style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
            />
          </View>
          <View style={styles.buttons}>
            <Button disabled={installing || !url.trim()} onPress={() => { void installFromUrl() }}>
              {installing ? t('setting__addons_installing') : t('setting__addons_install')}
            </Button>
            <Button disabled={installing} onPress={showChoosePath}>{t('setting__addons_install_file')}</Button>
          </View>
          {message && messageAt == 'add' ? <Text size={13} color={theme['c-primary-font']} style={styles.message}>{message}</Text> : null}
        </View>
      </SubTitle>
      <IsShowSourceSwitch />
      <SourceName />
      <UserApiEditModal ref={userApiModalRef} />
      {isShowChoosePath ? <ChoosePath ref={choosePathRef} onConfirm={installFromFile} /> : null}
    </Section>
  )
})

const styles = createStyle({
  all: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  storeError: {
    flexShrink: 1,
    marginRight: 10,
  },
  gap: {
    height: 14,
  },
  // the part above the groups (the groups are indented by their title)
  top: {
    paddingLeft: 25,
    paddingRight: 10,
    marginBottom: 6,
  },
  content: {
    paddingRight: 10,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 4,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 4,
  },
  message: {
    marginTop: 8,
    marginBottom: 4,
  },
  item: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  option: {
    marginLeft: 16,
  },
  arrow: {
    position: 'absolute',
    top: 14,
    right: 12,
  },
  headName: {
    paddingRight: 24,
  },
  inUse: {
    marginRight: 10,
  },
  meta: {
    marginTop: 3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
})
