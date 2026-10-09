import { useState } from 'react'
import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import Slider from '@/components/common/Slider'
import CheckBox from '@/components/common/CheckBox'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import styles from './style'

// 3D stereo surround of the desktop app (components/common/SoundEffectBtn/AudioPanner.vue)

const ValueSlider = ({ label, value, min, max, format, disabled, onChange }: {
  label: string
  value: number
  min: number
  max: number
  format: (value: number) => string
  disabled: boolean
  onChange: (value: number) => void
}) => {
  const theme = useTheme()
  const [sliding, setSliding] = useState<number | null>(null)
  return (
    <View style={{ ...styles.content, opacity: disabled ? 0.4 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
      <Text size={12} style={{ width: 92 }}>{label}</Text>
      <Text style={styles.label} size={12} color={theme['c-font-label']}>{format(sliding ?? value)}</Text>
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={v => { setSliding(Math.round(v)) }}
        onSlidingComplete={v => {
          setSliding(null)
          onChange(Math.round(v))
        }}
      />
    </View>
  )
}

export default () => {
  const t = useI18n()
  const enabled = useSettingValue('player.soundEffect.panner.enable')
  const soundR = useSettingValue('player.soundEffect.panner.soundR')
  const speed = useSettingValue('player.soundEffect.panner.speed')
  return (
    <View style={styles.container}>
      <Text>{t('player__sound_effect_panner')}</Text>
      <View style={styles.list}>
        <CheckBox marginBottom={3} check={enabled} label={t('player__sound_effect_panner_enabled')} onChange={check => { updateSetting({ 'player.soundEffect.panner.enable': check }) }} />
      </View>
      <ValueSlider label={t('player__sound_effect_panner_sound_speed')} value={speed} min={1} max={50} disabled={!enabled}
        format={v => `${v}`} onChange={value => { updateSetting({ 'player.soundEffect.panner.speed': value }) }} />
      <ValueSlider label={t('player__sound_effect_panner_sound_r')} value={soundR} min={1} max={30} disabled={!enabled}
        format={v => (v / 10).toFixed(1)} onChange={value => { updateSetting({ 'player.soundEffect.panner.soundR': value }) }} />
    </View>
  )
}
