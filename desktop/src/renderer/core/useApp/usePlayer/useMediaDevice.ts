import {
  onBeforeUnmount,
  watch,
} from '@common/utils/vueTools'
import { uptime } from 'os'
import { pause } from '@renderer/core/player/action'
import {
  setMediaDeviceId,
  refreshAudioOutput,
  getStartedAudioContext,
  getAudioElementTime,
  isAudioElementPlaying,
  onPlaying,
} from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'
import { noAudioDevice } from '@renderer/store/player/volume'
import { appSetting, saveMediaDeviceId } from '@renderer/store/setting'

const getDevices = async() => {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(({ kind }) => kind == 'audiooutput')
}

// The sound that is lost comes back by itself. An app started with the computer can open its output before the
// sound of the computer is there (no device yet, or a device that doesn't play yet): its songs then play silently
// until the app is restarted. The output is opened again when:
// - the devices show up (none at the start: they are looked for until there are some),
// - the first song plays, when the app started with the computer (the sound of the computer may have started after),
// - the sound stops going out while a song plays (the audio context of the sound effects is stopped or stuck).
const STARTUP_UPTIME = 5 * 60
const CHECK_INTERVAL = 3000

const useAudioOutputRecovery = () => {
  const isStartedWithSystem = uptime() < STARTUP_UPTIME
  let isRefreshing = false
  const refresh = async(reason: string) => {
    if (isRefreshing) return
    isRefreshing = true
    console.warn('refresh audio output:', reason)
    await refreshAudioOutput().finally(() => {
      isRefreshing = false
    })
  }

  // the first song after a start with the computer
  let rPlaying: (() => void) | null = isStartedWithSystem ? onPlaying(() => {
    rPlaying?.()
    rPlaying = null
    void refresh('first song after the start of the computer')
  }) : null

  // a song plays, the audio context doesn't: it is resumed, opened again when it stays stuck
  let prevElementTime = -1
  let prevContextTime = -1
  let stuckCount = 0
  const check = () => {
    const context = getStartedAudioContext()
    if (!context || !isPlay.value || !isAudioElementPlaying()) {
      prevElementTime = prevContextTime = -1
      stuckCount = 0
      return
    }
    const elementTime = getAudioElementTime()
    const contextTime = context.currentTime
    const isStuck = context.state != 'running' ||
      (prevElementTime >= 0 && elementTime - prevElementTime > 1 && contextTime - prevContextTime < 0.1)
    prevElementTime = elementTime
    prevContextTime = contextTime
    if (!isStuck) {
      stuckCount = 0
      return
    }
    stuckCount++
    if (context.state != 'running') void context.resume().catch(() => {})
    if (stuckCount >= 2) {
      stuckCount = 0
      void refresh('audio context ' + context.state + ', stuck')
    }
  }
  const checkTimer = setInterval(check, CHECK_INTERVAL)

  return {
    refresh,
    stop() {
      clearInterval(checkTimer)
      rPlaying?.()
      rPlaying = null
    },
  }
}

export default () => {
  let prevDeviceLabel: string | null = null
  let prevDeviceId = ''
  const recovery = useAudioOutputRecovery()
  // (no devices: they are looked for until there are some)
  let deviceCount = -1
  let lookForDevicesTimer: NodeJS.Timeout | null = null

  const getMediaDevice = async(deviceId: string) => {
    const devices = await getDevices()
    let device = devices.find(device => device.deviceId === deviceId)
    if (!device) {
      deviceId = 'default'
      device = devices.find(device => device.deviceId === deviceId)
    }

    // (shown by the volume button, components/common/VolumeBtn.vue)
    noAudioDevice.value = !device && !devices.length
    // the devices showed up after the app opened its output without them: it is opened again
    if (deviceCount == 0 && devices.length) void recovery.refresh('the devices showed up')
    deviceCount = devices.length
    if (!devices.length) lookForDevices()
    return device ? { label: device.label, deviceId: device.deviceId } : { label: '', deviceId: '' }
  }
  const setMediaDevice = async(deviceId: string, label: string) => {
    prevDeviceLabel = label
    // console.log(device)
    setMediaDeviceId(deviceId).then(() => {
      prevDeviceId = deviceId
      saveMediaDeviceId(deviceId)
    }).catch((err: any) => {
      console.log(err)
      setMediaDeviceId('default').finally(() => {
        prevDeviceId = 'default'
        saveMediaDeviceId('default')
      })
    })
  }

  const lookForDevices = () => {
    if (lookForDevicesTimer) return
    lookForDevicesTimer = setTimeout(() => {
      lookForDevicesTimer = null
      void getMediaDevice(appSetting['player.mediaDeviceId'])
    }, 5000)
  }

  const handleDeviceChange = (label: string) => {
    // console.log(device)
    // console.log(appSetting['player.isMediaDeviceRemovedStopPlay'], isPlay.value, label, prevDeviceLabel)
    if (label != prevDeviceLabel) {
      window.app_event.playerDeviceChanged()
      // (another device: the output is opened on it, in case it didn't follow)
      if (prevDeviceLabel != null && label) void recovery.refresh('the device changed')

      if (appSetting['player.isMediaDeviceRemovedStopPlay'] && isPlay.value) {
        window.lx.isPlayedStop = true
        pause()
      }
    }
  }

  const handleMediaListChange = async() => {
    const mediaDeviceId = appSetting['player.mediaDeviceId']
    const device = await getMediaDevice(mediaDeviceId)

    handleDeviceChange(device.label)

    if (device.deviceId == mediaDeviceId) prevDeviceLabel = device.label
    else void setMediaDevice(device.deviceId, device.label)
  }

  watch(() => appSetting['player.mediaDeviceId'], (id) => {
    if (prevDeviceId == id) return
    void getMediaDevice(id).then(async({ deviceId, label }) => setMediaDevice(deviceId, label))
  })

  void getMediaDevice(appSetting['player.mediaDeviceId']).then(async({ deviceId, label }) => setMediaDevice(deviceId, label))

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  navigator.mediaDevices.addEventListener('devicechange', handleMediaListChange)

  onBeforeUnmount(() => {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    navigator.mediaDevices.removeEventListener('devicechange', handleMediaListChange)
    recovery.stop()
    if (lookForDevicesTimer) clearTimeout(lookForDevicesTimer)
  })
}
