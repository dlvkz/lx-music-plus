import { memo, useEffect, useMemo, useState } from 'react'
import { toast } from '@/utils/tools'
import { MUSIC_TOGGLE_MODE_LIST, MUSIC_TOGGLE_MODE } from '@/config/constant'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { fmState, onFmStateChanged } from '@/core/recommend'
import { isRadioPlaying } from '@/core/player/playMethod'
import { usePlayInfo } from '@/store/player/hook'
import Btn from './Btn'


export default memo(() => {
  const togglePlayMethod = useSettingValue('player.togglePlayMethod')
  const t = useI18n()
  // the radio always plays in order (core/player/playMethod.ts): its mode can't be changed
  // (after a restart too: the radio list restored, before it plays)
  const [isRadioActive, setRadioActive] = useState(fmState.active)
  useEffect(() => onFmStateChanged(state => { setRadioActive(state.active) }), [])
  usePlayInfo()
  const isRadio = isRadioActive || isRadioPlaying()

  const toggleNextPlayMode = () => {
    if (isRadio) {
      toast(t('player__radio_play_mode'))
      return
    }
    let index = MUSIC_TOGGLE_MODE_LIST.indexOf(togglePlayMethod)
    if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
    const mode = MUSIC_TOGGLE_MODE_LIST[index]
    updateSetting({ 'player.togglePlayMethod': mode })
    let modeName: 'play_list_loop' | 'play_list_random' | 'play_list_order' | 'play_single_loop' | 'play_single'
    switch (mode) {
      case MUSIC_TOGGLE_MODE.listLoop:
        modeName = 'play_list_loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        modeName = 'play_list_random'
        break
      case MUSIC_TOGGLE_MODE.list:
        modeName = 'play_list_order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        modeName = 'play_single_loop'
        break
      default:
        modeName = 'play_single'
        break
    }
    toast(t(modeName))
  }

  const playModeIcon = useMemo(() => {
    let playModeIcon = null
    switch (isRadio ? MUSIC_TOGGLE_MODE.listLoop : togglePlayMethod) {
      case MUSIC_TOGGLE_MODE.listLoop:
        playModeIcon = 'list-loop'
        break
      case MUSIC_TOGGLE_MODE.random:
        playModeIcon = 'list-random'
        break
      case MUSIC_TOGGLE_MODE.list:
        playModeIcon = 'list-order'
        break
      case MUSIC_TOGGLE_MODE.singleLoop:
        playModeIcon = 'single-loop'
        break
      default:
        playModeIcon = 'single'
        break
    }
    return playModeIcon
  }, [togglePlayMethod, isRadio])

  return <Btn icon={playModeIcon} onPress={toggleNextPlayMode} />
})
