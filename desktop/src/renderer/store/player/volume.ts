import { ref } from '@common/utils/vueTools'


export const volume = ref(0)
export const isMute = ref(false)
// no audio output device (no sound card / driver): the volume button shows it, no dialog
export const noAudioDevice = ref(false)

export const setVolume = (num: number) => {
  volume.value = num
}

export const setMute = (flag: boolean) => {
  isMute.value = flag
}
