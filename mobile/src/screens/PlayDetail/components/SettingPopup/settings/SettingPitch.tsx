import { useState } from 'react'
import { View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import Slider, { type SliderProps } from '@/components/common/Slider'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import ButtonPrimary from '@/components/common/ButtonPrimary'
import styles from './style'

// Pitch adjustment, 0.50 - 1.50 (desktop: components/common/SoundEffectBtn/PitchShifter.vue)
const MIN_VALUE = 50
const MAX_VALUE = 150

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const pitch = Math.round(useSettingValue('player.soundEffect.pitchShifter.playbackRate') * 100)
  const [sliderValue, setSliderValue] = useState(pitch)
  const [isSliding, setSliding] = useState(false)

  const handleSlidingStart: SliderProps['onSlidingStart'] = () => {
    setSliding(true)
  }
  const handleValueChange: SliderProps['onValueChange'] = value => {
    setSliderValue(Math.round(value))
  }
  const handleSlidingComplete: SliderProps['onSlidingComplete'] = value => {
    setSliding(false)
    value = Math.round(value)
    if (value == pitch) return
    updateSetting({ 'player.soundEffect.pitchShifter.playbackRate': value / 100 })
  }
  const handleReset = () => {
    setSliderValue(100)
    updateSetting({ 'player.soundEffect.pitchShifter.playbackRate': 1 })
  }

  return (
    <View style={styles.container}>
      <Text>{t('player__sound_effect_pitch_shifter')}</Text>
      <View style={styles.content}>
        <Text style={styles.label} color={theme['c-font-label']}>{`${((isSliding ? sliderValue : pitch) / 100).toFixed(2)}x`}</Text>
        <Slider
          minimumValue={MIN_VALUE}
          maximumValue={MAX_VALUE}
          onSlidingComplete={handleSlidingComplete}
          onValueChange={handleValueChange}
          onSlidingStart={handleSlidingStart}
          step={1}
          value={pitch}
        />
      </View>
      <ButtonPrimary onPress={handleReset}>{t('player__sound_effect_pitch_shifter_reset_btn')}</ButtonPrimary>
    </View>
  )
}
