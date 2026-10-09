import { memo, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import Slider from '@/components/common/Slider'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import ButtonPrimary from '@/components/common/ButtonPrimary'
import { freqs, freqsPreset, type FreqKey } from '@/core/player/soundEffect'
import { createStyle } from '@/utils/tools'
import styles from './style'

// Equalizer of the desktop app (components/common/SoundEffectBtn/BiquadFilter.vue): 10 bands, -15 - 15 dB

const Band = memo(({ freq }: { freq: typeof freqs[number] }) => {
  const theme = useTheme()
  const key: FreqKey = `player.soundEffect.biquadFilter.hz${freq}`
  const value = useSettingValue(key)
  const [sliding, setSliding] = useState<number | null>(null)
  const shown = sliding ?? value
  return (
    <View style={styles.content}>
      <Text size={12} style={bandStyles.freq}>{freq < 1000 ? `${freq}` : `${freq / 1000}k`}</Text>
      <Text size={12} style={styles.label} color={theme['c-font-label']}>{`${shown > 0 ? '+' : ''}${shown}dB`}</Text>
      <Slider
        minimumValue={-15}
        maximumValue={15}
        step={1}
        value={value}
        onValueChange={v => { setSliding(Math.round(v)) }}
        onSlidingComplete={v => {
          setSliding(null)
          updateSetting({ [key]: Math.round(v) })
        }}
      />
    </View>
  )
})

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const setPreset = (preset: Record<string, number | string>) => {
    updateSetting(Object.fromEntries(freqs.map(f => [`player.soundEffect.biquadFilter.hz${f}`, preset[`hz${f}`] as number])))
  }
  const reset = () => {
    updateSetting(Object.fromEntries(freqs.map(f => [`player.soundEffect.biquadFilter.hz${f}`, 0])))
  }
  return (
    <View style={styles.container}>
      <Text>{t('player__sound_effect_biquad_filter')}</Text>
      {freqs.map(freq => <Band key={freq} freq={freq} />)}
      <View style={styles.list}>
        {
          freqsPreset.map(preset => (
            <TouchableOpacity key={preset.name} activeOpacity={0.7} onPress={() => { setPreset(preset) }} style={{ ...bandStyles.preset, backgroundColor: theme['c-button-background'] }}>
              <Text size={12} color={theme['c-button-font']}>{t(`player__sound_effect_biquad_filter_preset_${preset.name}`)}</Text>
            </TouchableOpacity>
          ))
        }
      </View>
      <ButtonPrimary onPress={reset}>{t('player__sound_effect_biquad_filter_reset_btn')}</ButtonPrimary>
    </View>
  )
}

const bandStyles = createStyle({
  freq: {
    width: 36,
  },
  preset: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
    marginBottom: 8,
  },
})
