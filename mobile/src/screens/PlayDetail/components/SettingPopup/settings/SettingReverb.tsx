import { useState } from 'react'
import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import Slider from '@/components/common/Slider'
import CheckBox from '@/components/common/CheckBox'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { convolutions } from '@/core/player/soundEffect'
import styles from './style'

// Ambient reverb: the room recordings of the desktop app (components/common/SoundEffectBtn/AudioConvolution.vue)

const GainSlider = ({ label, value, disabled, onChange }: { label: string, value: number, disabled: boolean, onChange: (value: number) => void }) => {
  const theme = useTheme()
  const [sliding, setSliding] = useState<number | null>(null)
  return (
    <View style={{ ...styles.content, opacity: disabled ? 0.4 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
      <Text size={12} style={{ width: 92 }}>{label}</Text>
      <Text style={styles.label} size={12} color={theme['c-font-label']}>{`${(sliding ?? value) * 10}%`}</Text>
      <Slider
        minimumValue={0}
        maximumValue={50}
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
  const fileName = useSettingValue('player.soundEffect.convolution.fileName')
  const mainGain = useSettingValue('player.soundEffect.convolution.mainGain')
  const sendGain = useSettingValue('player.soundEffect.convolution.sendGain')

  const select = (source: string) => {
    const target = convolutions.find(c => c.source == source)
    updateSetting(target
      ? {
          'player.soundEffect.convolution.fileName': source,
          'player.soundEffect.convolution.mainGain': Math.round(target.mainGain * 10),
          'player.soundEffect.convolution.sendGain': Math.round(target.sendGain * 10),
        }
      : { 'player.soundEffect.convolution.fileName': '' })
  }

  return (
    <View style={styles.container}>
      <Text>{t('player__sound_effect_convolution')}</Text>
      <View style={styles.list}>
        <CheckBox marginRight={8} marginBottom={3} check={!fileName} label={t('player__sound_effect_off')} onChange={() => { select('') }} need />
        {
          convolutions.map(item => (
            <CheckBox key={item.name} marginRight={8} marginBottom={3} check={fileName == item.source}
              label={t(`player__sound_effect_convolution_file_${item.name}`)} onChange={() => { select(item.source) }} need />
          ))
        }
      </View>
      <GainSlider label={t('player__sound_effect_convolution_main_gain')} value={mainGain} disabled={!fileName}
        onChange={value => { updateSetting({ 'player.soundEffect.convolution.mainGain': value }) }} />
      <GainSlider label={t('player__sound_effect_convolution_send_gain')} value={sendGain} disabled={!fileName}
        onChange={value => { updateSetting({ 'player.soundEffect.convolution.sendGain': value }) }} />
    </View>
  )
}
