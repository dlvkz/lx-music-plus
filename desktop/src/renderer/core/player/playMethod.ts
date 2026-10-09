import { LIST_IDS } from '@common/constants'
import { tempListMeta } from '@renderer/store/list/state'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
import { appSetting } from '@renderer/store/setting'

// The radio (core/recommend.ts: its songs in the temporary list) always plays in order, its list repeated: the
// play mode chosen is kept for the other lists (it comes back after the radio)

export const RADIO_LIST_ID = 'recommend_fm'

export const isRadioPlaying = () => (playMusicInfo.listId ?? playInfo.playerListId) == LIST_IDS.TEMP && tempListMeta.id == RADIO_LIST_ID

/**
 * The play mode used: the one chosen, list repeat for the radio
 */
export const getPlayMethod = (): LX.AppSetting['player.togglePlayMethod'] => isRadioPlaying() ? 'listLoop' : appSetting['player.togglePlayMethod']
