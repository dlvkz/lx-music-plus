import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'

import { connectServer, disconnectServer } from '@/plugins/sync'
import { SYNC_CODE } from '@/plugins/sync/constants'
import { addSyncHostHistory, getSyncAuthKey, getSyncHost, getSyncHostHistory, setSyncHost } from '@/utils/data'
import { getData, saveData } from '@/plugins/storage'
import { getWIFIIPV4Address } from '@/utils/nativeModules/utils'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { useStatus } from '@/store/sync/hook'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import Button from '@/components/common/ButtonPrimary'
import ConfirmAlert, { type ConfirmAlertType } from '@/components/common/ConfirmAlert'

// The sync with a computer, like the pairing of a real app: the computers of the Wi-Fi are listed (by their name),
// a tap on one asks for the code shown on it (only the first time: a computer paired before connects at once)

const DEFAULT_PORT = 23332
const SCAN_TIMEOUT = 1500
const SCAN_CONCURRENCY = 48
const NAMES_KEY = '@sync_host_names'

interface Device {
  host: string
  name: string
  /** paired before: no code needed */
  paired: boolean
}

// "192.168.1.2" / "192.168.1.2:23332" / "http://192.168.1.2:23332/" → "http://192.168.1.2:23332"
export const normalizeSyncHost = (text: string) => {
  let host = text.trim().replace(/\/+$/, '')
  if (!host) return ''
  if (!/^https?:\/\//i.test(host)) host = `http://${host}`
  if (!/:\d+$/.test(host.replace(/^https?:\/\//i, ''))) host = `${host}:${DEFAULT_PORT}`
  return host
}
const displayHost = (host: string) => host.replace(/^https?:\/\//i, '').replace(`:${DEFAULT_PORT}`, '')

const request = async(url: string) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => { controller.abort() }, SCAN_TIMEOUT)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok ? await res.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// a computer that runs the sync: its name (the computers of an older version: its address), paired before or not
const probe = async(host: string): Promise<Device | null> => {
  if (await request(`${host}/hello`) != SYNC_CODE.helloMsg) return null
  const [name, id] = await Promise.all([request(`${host}/name`), request(`${host}/id`)])
  const serverId = id?.startsWith(SYNC_CODE.idPrefix) ? id.replace(SYNC_CODE.idPrefix, '') : ''
  const paired = serverId ? !!await getSyncAuthKey(serverId).catch(() => null) : false
  return { host, name: name?.trim() || displayHost(host), paired }
}

// the computers of the network of the phone (the addresses of its /24), the ones of the history first
const scanNetwork = async(history: string[], onFound: (device: Device) => void) => {
  const address = await getWIFIIPV4Address().catch(() => '')
  const hosts = new Set<string>(history)
  const base = /^(\d+\.\d+\.\d+)\.\d+$/.exec(address)?.[1]
  if (base) for (let i = 1; i < 255; i++) if (`${base}.${i}` != address) hosts.add(`http://${base}.${i}:${DEFAULT_PORT}`)
  const list = [...hosts]
  let next = 0
  const worker = async() => {
    while (next < list.length) {
      const device = await probe(list[next++])
      if (device) onFound(device)
    }
  }
  await Promise.all(Array.from({ length: SCAN_CONCURRENCY }, worker))
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const status = useStatus()
  const isEnable = useSettingValue('sync.enable')
  const [currentHost, setCurrentHost] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [found, setFound] = useState<Device[]>([])
  const [scanning, setScanning] = useState(false)
  const [searched, setSearched] = useState(false)
  // the pop-up: the code for a computer (its address typed when it was not found)
  const [target, setTarget] = useState<Device | null>(null)
  const [manual, setManual] = useState(false)
  const [address, setAddress] = useState('')
  const [code, setCode] = useState('')
  const alertRef = useRef<ConfirmAlertType>(null)
  const activeRef = useRef(true)

  const scan = useCallback((list: string[]) => {
    setScanning(true)
    setFound([])
    void scanNetwork(list, device => {
      if (!activeRef.current) return
      setFound(devices => devices.some(d => d.host == device.host) ? devices : [...devices, device])
      // (the names are kept: the status and the next search show them at once)
      setNames(names => {
        if (names[device.host] == device.name) return names
        const next = { ...names, [device.host]: device.name }
        void saveData(NAMES_KEY, next).catch(() => {})
        return next
      })
    }).finally(() => {
      if (!activeRef.current) return
      setScanning(false)
      setSearched(true)
    })
  }, [])

  useEffect(() => {
    activeRef.current = true
    void Promise.all([getSyncHost(), getData<Record<string, string>>(NAMES_KEY)]).then(([host, saved]) => {
      if (!activeRef.current) return
      setCurrentHost(host)
      if (saved) setNames(names => ({ ...saved, ...names }))
    })
    return () => {
      activeRef.current = false
    }
  }, [])
  // not syncing (opened, disconnected): the computers of the Wi-Fi are looked for
  useEffect(() => {
    if (isEnable) return
    void getSyncHostHistory().then(list => { if (activeRef.current) scan([...list]) })
  }, [isEnable, scan])

  const nameOf = (host: string) => names[host] ?? displayHost(host)

  const connect = (host: string, authCode?: string) => {
    setCurrentHost(host)
    void setSyncHost(host)
    void addSyncHostHistory(host)
    updateSetting({ 'sync.enable': true })
    void connectServer(host, authCode)
  }
  const openCodePopup = (device: Device | null) => {
    setTarget(device)
    setManual(!device)
    setAddress('')
    setCode('')
    alertRef.current?.setVisible(true)
  }
  const handleDevice = (device: Device) => {
    if (device.paired) connect(device.host)
    else openCodePopup(device)
  }
  const confirmPopup = () => {
    const host = manual ? normalizeSyncHost(address) : target?.host
    if (!host) {
      toast(t('sync__address_empty'))
      return
    }
    if (!code.trim()) {
      toast(t('sync__code_placeholder'))
      return
    }
    alertRef.current?.setVisible(false)
    connect(host, code.trim())
  }
  const disconnect = () => {
    updateSetting({ 'sync.enable': false })
    void disconnectServer()
  }

  // a wrong / missing code: the pop-up again
  const needCode = isEnable && (status.message == SYNC_CODE.missingAuthCode || status.message == SYNC_CODE.authFailed)
  useEffect(() => {
    if (!needCode || !currentHost) return
    if (status.message == SYNC_CODE.authFailed) toast(t('setting_sync_code_fail'))
    void disconnectServer(false)
    updateSetting({ 'sync.enable': false })
    openCodePopup({ host: currentHost, name: nameOf(currentHost), paired: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needCode])

  const isConnected = isEnable && status.status
  const statusText = useMemo(() => {
    if (!isEnable) return t('sync__status_off')
    if (status.message == SYNC_CODE.msgBlockedIp) return t('setting_sync_code_blocked_ip')
    if (isConnected) return t('sync__connected', { host: nameOf(currentHost) })
    return t('sync__connecting_to', { host: nameOf(currentHost) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnable, isConnected, status.message, currentHost, names, t])

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={{ ...styles.box, borderColor: theme['c-border-background'] }}>
        <View style={styles.row}>
          <View style={{ ...styles.dot, backgroundColor: isConnected ? '#3fb950' : isEnable ? '#d29922' : theme['c-font-label'] }} />
          <Text size={15} style={styles.flex}>{statusText}</Text>
          {isEnable ? <Button onPress={disconnect}>{t('sync__disconnect')}</Button> : null}
        </View>
      </View>

      {!isEnable
        ? <View style={{ ...styles.box, borderColor: theme['c-border-background'] }}>
            <View style={styles.row}>
              <Text size={15} style={styles.flex}>{t('sync__found_title')}</Text>
              {scanning ? null : <TouchableOpacity onPress={() => { void getSyncHostHistory().then(list => { scan([...list]) }) }}><Text size={13} color={theme['c-primary-font']}>{t('sync__search_again')}</Text></TouchableOpacity>}
            </View>
            {found.map(device => (
              <TouchableOpacity key={device.host} activeOpacity={0.7} onPress={() => { handleDevice(device) }}
                style={{ ...styles.device, backgroundColor: theme['c-button-background'] }}>
                <Text size={22}>💻</Text>
                <View style={styles.flex}>
                  <Text size={15} numberOfLines={1}>{device.name}</Text>
                  <Text size={12} color={theme['c-font-label']}>{device.paired ? t('sync__paired') : displayHost(device.host)}</Text>
                </View>
                <Text size={14} color={theme['c-primary-font']}>{t('sync__connect')}</Text>
              </TouchableOpacity>
            ))}
            <Text size={13} color={theme['c-font-label']}>{scanning || !searched ? t('sync__searching') : found.length ? '' : t('sync__none_found_short')}</Text>
            <Text size={12} color={theme['c-font-label']}>{t('sync__tip')}</Text>
            <TouchableOpacity onPress={() => { openCodePopup(null) }}>
              <Text size={13} color={theme['c-primary-font']}>{t('sync__manual')}</Text>
            </TouchableOpacity>
          </View>
        : null}

      <ConfirmAlert ref={alertRef} onConfirm={confirmPopup} confirmText={t('sync__connect')}>
        <View style={styles.popup}>
          <Text size={16}>{manual ? t('sync__manual_title') : t('sync__pair_title', { name: target?.name ?? '' })}</Text>
          {manual
            ? <View style={styles.inputWrap}><Input value={address} onChangeText={setAddress} placeholder="192.168.1.20" inputMode="url" style={{ ...styles.input, backgroundColor: theme['c-primary-background'] }} /></View>
            : null}
          <Text size={13} color={theme['c-font-label']}>{t('sync__pair_desc')}</Text>
          <View style={styles.inputWrap}><Input value={code} onChangeText={setCode} placeholder={t('sync__code_placeholder')} keyboardType="number-pad" autoFocus={!manual} style={{ ...styles.input, backgroundColor: theme['c-primary-background'] }} /></View>
        </View>
      </ConfirmAlert>
    </ScrollView>
  )
}

const styles = createStyle({
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 30,
    gap: 12,
  },
  box: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  popup: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 260,
    gap: 10,
  },
  // (the input grows to the space it is given)
  inputWrap: {
    height: 42,
    flexDirection: 'row',
  },
  input: {
    height: 42,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
})
