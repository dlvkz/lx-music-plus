import settingState from '@/store/setting/state'
import { isInitialized, setAudioOffload, setConvolution, setEqualizer, setPanner, setPitch } from '@/plugins/player'

// Pitch, ambient reverb and audio offload of the player (desktop: core/useApp/usePlayer/useSoundEffect.ts)

// the impulse files and their default gains, like the desktop app (renderer/plugins/player/index.ts)
export const convolutions = [
  { name: 'telephone', mainGain: 0.0, sendGain: 3.0, source: 'filter-telephone.wav' },
  { name: 's2_r4_bd', mainGain: 1.8, sendGain: 0.9, source: 's2_r4_bd.wav' },
  { name: 'bright_hall', mainGain: 0.8, sendGain: 2.4, source: 'bright-hall.wav' },
  { name: 'cinema_diningroom', mainGain: 0.6, sendGain: 2.3, source: 'cinema-diningroom.wav' },
  { name: 'dining_living_true_stereo', mainGain: 0.6, sendGain: 1.8, source: 'dining-living-true-stereo.wav' },
  { name: 'living_bedroom_leveled', mainGain: 0.6, sendGain: 2.1, source: 'living-bedroom-leveled.wav' },
  { name: 'spreader50_65ms', mainGain: 1, sendGain: 2.5, source: 'spreader50-65ms.wav' },
  { name: 's3_r1_bd', mainGain: 1.8, sendGain: 0.8, source: 's3_r1_bd.wav' },
  { name: 'matrix_1', mainGain: 1.5, sendGain: 0.9, source: 'matrix-reverb1.wav' },
  { name: 'matrix_2', mainGain: 1.3, sendGain: 1, source: 'matrix-reverb2.wav' },
  { name: 'cardiod_35_10_spread', mainGain: 1.8, sendGain: 0.6, source: 'cardiod-35-10-spread.wav' },
  { name: 'tim_omni_35_10_magnetic', mainGain: 1, sendGain: 0.2, source: 'tim-omni-35-10-magnetic.wav' },
  { name: 'feedback_spring', mainGain: 1.8, sendGain: 0.8, source: 'feedback-spring.wav' },
] as const

// equalizer bands and presets (desktop: renderer/plugins/player/index.ts)
export const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export type FreqKey = `player.soundEffect.biquadFilter.hz${typeof freqs[number]}`
export const freqsPreset = [
  { name: 'pop', hz31: 6, hz62: 5, hz125: -3, hz250: -2, hz500: 5, hz1000: 4, hz2000: -4, hz4000: -3, hz8000: 6, hz16000: 4 },
  { name: 'dance', hz31: 4, hz62: 3, hz125: -4, hz250: -6, hz500: 0, hz1000: 0, hz2000: 3, hz4000: 4, hz8000: 4, hz16000: 5 },
  { name: 'rock', hz31: 7, hz62: 6, hz125: 2, hz250: 1, hz500: -3, hz1000: -4, hz2000: 2, hz4000: 1, hz8000: 4, hz16000: 5 },
  { name: 'classical', hz31: 6, hz62: 7, hz125: 1, hz250: 2, hz500: -1, hz1000: 1, hz2000: -4, hz4000: -6, hz8000: -7, hz16000: -8 },
  { name: 'vocal', hz31: -5, hz62: -6, hz125: -4, hz250: -3, hz500: 3, hz1000: 4, hz2000: 5, hz4000: 4, hz8000: -3, hz16000: -3 },
  { name: 'slow', hz31: 5, hz62: 4, hz125: 2, hz250: 0, hz500: -2, hz1000: 0, hz2000: 3, hz4000: 6, hz8000: 7, hz16000: 8 },
  { name: 'electronic', hz31: 6, hz62: 5, hz125: 0, hz250: -5, hz500: -4, hz1000: 0, hz2000: 6, hz4000: 8, hz8000: 8, hz16000: 7 },
  { name: 'subwoofer', hz31: 8, hz62: 7, hz125: 5, hz250: 4, hz500: 0, hz1000: 0, hz2000: 0, hz4000: 0, hz8000: 0, hz16000: 0 },
  { name: 'soft', hz31: -5, hz62: -5, hz125: -4, hz250: -4, hz500: 3, hz1000: 2, hz2000: 4, hz4000: 4, hz8000: 0, hz16000: 0 },
] as const

export const SOUND_EFFECT_KEYS: Array<keyof LX.AppSetting> = [
  ...freqs.map(f => `player.soundEffect.biquadFilter.hz${f}` as const),
  'player.soundEffect.panner.enable',
  'player.soundEffect.panner.soundR',
  'player.soundEffect.panner.speed',
  'player.playbackRate',
  'player.preservesPitch',
  'player.soundEffect.pitchShifter.playbackRate',
  'player.soundEffect.convolution.fileName',
  'player.soundEffect.convolution.mainGain',
  'player.soundEffect.convolution.sendGain',
  'player.isEnableAudioOffload',
]

/**
 * Apply the settings to the player
 * @param rate the speed, while it is being changed (not saved yet)
 */
export const applySoundEffects = async(rate = settingState.setting['player.playbackRate']) => {
  const setting = settingState.setting
  const fileName = setting['player.soundEffect.convolution.fileName']
  // the reverb works without the player (the audio processor is kept by the app)
  await setConvolution(fileName, setting['player.soundEffect.convolution.mainGain'] / 10, setting['player.soundEffect.convolution.sendGain'] / 10)
  const gains = freqs.map(f => setting[`player.soundEffect.biquadFilter.hz${f}`])
  await setEqualizer(gains)
  const panner = setting['player.soundEffect.panner.enable']
  await setPanner(panner, setting['player.soundEffect.panner.soundR'] / 10, setting['player.soundEffect.panner.speed'])
  if (!isInitialized()) return
  // the pitch compensation keeps the pitch when the speed changes; without it the pitch follows the speed
  const pitch = setting['player.soundEffect.pitchShifter.playbackRate'] * (setting['player.preservesPitch'] ? 1 : rate)
  await setPitch(pitch)
  // the audio hardware (offload) doesn't go through the processing of the app: it is used only when the
  // sound is unchanged, a speed change with it is done by the device and sounds wrong on many of them
  await setAudioOffload(setting['player.isEnableAudioOffload'] && rate == 1 && pitch == 1 && !fileName && !panner && gains.every(g => g == 0))
}
