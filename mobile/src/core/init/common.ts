// import musicSdk from '@/utils/musicSdk'
// import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { formatPicUri, getDisplayPic, onDisplayPicChanged } from '@/core/displayPic'
import { setBgPic } from '@/core/common'

// const handleUpdateSourceNmaes = () => {
//   const prefix = settingState.setting['common.sourceNameType'] == 'real' ? 'source_' : 'source_alias_'
//   const sourceNames: Record<LX.OnlineSource | 'all', string> = {
//     kw: 'kw',
//     tx: 'tx',
//     kg: 'kg',
//     mg: 'mg',
//     wy: 'wy',
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
//     all: global.i18n.t(prefix + 'all' as any),
//   }
//   for (const { id } of musicSdk.sources) {
//     // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
//     sourceNames[id as LX.OnlineSource] = global.i18n.t(prefix + id as any)
//   }
//   commonActions.setSourceNames(sourceNames)
// }

export default async(setting: LX.AppSetting) => {
  // const handleConfigUpdated = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
  //   // if (keys.includes('common.sourceNameType')) handleUpdateSourceNmaes()
  //   handleConfigUpdate(keys, setting)
  // }

  // the cover is loaded when the player or the menus use it (PageContent, PlayerBar): the cover shown, which stays
  // until the one of the next song is loaded (core/displayPic.ts)
  let isDynamicBg = setting['theme.dynamicBg'] || setting['playDetail.isDynamicBg']
  const applyPic = (pic: string | null) => {
    if (!isDynamicBg) return
    setBgPic(pic ? formatPicUri(pic) : null)
  }
  const handleConfigUpdate = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
    if (!keys.includes('theme.dynamicBg') && !keys.includes('playDetail.isDynamicBg')) return
    isDynamicBg = settingState.setting['theme.dynamicBg'] || settingState.setting['playDetail.isDynamicBg']
    if (isDynamicBg) applyPic(getDisplayPic())
    else setBgPic(null)
  }
  applyPic(getDisplayPic())
  onDisplayPicChanged(applyPic)
  global.state_event.on('configUpdated', handleConfigUpdate)
}
