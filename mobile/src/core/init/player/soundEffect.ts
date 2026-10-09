import { applySoundEffects, SOUND_EFFECT_KEYS } from '@/core/player/soundEffect'

export default () => {
  void applySoundEffects().catch(() => {})
  global.state_event.on('configUpdated', (keys) => {
    if (keys.some(key => SOUND_EFFECT_KEYS.includes(key))) void applySoundEffects().catch(() => {})
  })
}
