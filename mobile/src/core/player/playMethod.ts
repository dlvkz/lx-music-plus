import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'

// The radio (core/recommend.ts: its songs in the temporary list) always plays in order, its list repeated: the
// play mode chosen is kept for the other lists (it comes back after the radio)

export const RADIO_LIST_ID = 'recommend_fm'

export const isRadioPlaying = () => (playerState.playMusicInfo.listId ?? playerState.playInfo.playerListId) == LIST_IDS.TEMP && listState.tempListMeta.id == RADIO_LIST_ID

/**
 * The play mode used: the one chosen, list repeat for the radio
 */
export const getPlayMethod = (): LX.AppSetting['player.togglePlayMethod'] => isRadioPlaying() ? 'listLoop' : settingState.setting['player.togglePlayMethod']
