import { compareVer } from '@/utils'
import { downloadNewVersion, getVersionInfo, isNewVersionDownloaded, removeInstalledApk } from '@/utils/version'
import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { getIgnoreVersion, getIgnoreVersionFailTipTime, saveIgnoreVersion, saveIgnoreVersionFailTipTime } from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { showDialog } from '@/navigation/utils'
import { Navigation } from 'react-native-navigation'
import { toast } from '@/utils/tools'
import { getData, saveData } from '@/plugins/storage'
import publishInfo from '../../publish/version.json'

export const showModal = () => {
  if (versionState.showModal) return
  versionActions.setVisibleModal(true)
  showVersionModal()
}

export const hideModal = (componentId: string) => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
  void Navigation.dismissOverlay(componentId)
}

/**
 * Check for a new version
 * @param isShowModal show it when there is one (not when the changelog of the update just installed is shown)
 */
export const checkUpdate = async(isShowModal = true) => {
  versionActions.setVersionInfo({ status: 'checking' })
  let versionInfo: InitState['versionInfo'] = { ...versionState.versionInfo }
  try {
    const { version, desc, history } = await getVersionInfo()
    versionInfo.newVersion = {
      version,
      desc,
      history,
    }
  } catch (err) {
    versionInfo.newVersion = {
      version: '0.0.0',
      desc: '',
      history: [],
    }
  }
  // const versionInfo = {
  //   version: '1.9.0',
  //   desc: '- 更新xxx\n- 修复xxx123的萨达修复xxx123的萨达修复xxx123的萨达修复xxx123的萨达修复xxx123的萨达',
  //   history: [{ version: '1.8.0', desc: '- 更新xxx22\n- 修复xxx22' }, { version: '1.7.0', desc: '- 更新xxx22\n- 修复xxx22' }],
  // }
  if (versionInfo.newVersion.version == '0.0.0') {
    versionInfo.isUnknown = true
    versionInfo.status = 'error'
  } else {
    versionInfo.status = 'idle'
    versionInfo.isUnknown = false
    if (compareVer(versionInfo.version, versionInfo.newVersion.version) != -1) {
      versionInfo.isLatest = true
    // downloaded before the app was restarted: it is installed from there
    } else if (await isNewVersionDownloaded(versionInfo.newVersion.version)) {
      versionInfo.status = 'downloaded'
    }
  }

  versionActions.setVersionInfo(versionInfo)

  if (!versionInfo.isLatest && isShowModal) {
    if (versionInfo.isUnknown) {
      const time = await getIgnoreVersionFailTipTime()
      if (Date.now() - time < 7 * 86400000) return
      saveIgnoreVersionFailTipTime(Date.now())
      toast(global.i18n.t('version_tip_unknown'))
    } else if (versionInfo.newVersion.version != await getIgnoreVersion()) {
      showModal()
    }
  }
  // console.log(compareVer(process.versions.app, versionInfo.version))
  // console.log(process.versions.app, versionInfo.version)
}

const LAST_VERSION_KEY = '@last_run_version'

/**
 * The version run now is remembered (a first run: there is no changelog to show)
 */
export const saveRunVersion = async() => {
  await saveData(LAST_VERSION_KEY, versionState.versionInfo.version)
}

/**
 * After an update: what is new, once (the changelog of the versions since the one run before)
 * @returns whether it is shown
 */
export const showChangelogAfterUpdate = async() => {
  const current = versionState.versionInfo.version
  const last = await getData<string>(LAST_VERSION_KEY).catch(() => null)
  if (last == current) return false
  await saveRunVersion()
  void removeInstalledApk(current, compareVer)
  // (an older version installed again: nothing new)
  if (last && compareVer(last, current) >= 0) return false
  // (updated from a version that didn't remember itself: the changelog of this version only)
  const versions = [{ version: publishInfo.version, desc: publishInfo.desc }, ...publishInfo.history]
    .filter(info => compareVer(info.version, current) <= 0 && (!last || compareVer(last, info.version) < 0))
    .slice(0, last ? undefined : 1)
  if (!versions.length) return false
  void showDialog({
    title: global.i18n.t('version_title_updated', { version: current }),
    message: versions.map(info => versions.length > 1 ? `v${info.version}\n${info.desc}` : info.desc).join('\n\n'),
    buttons: [{ text: global.i18n.t('version_btn_close'), value: true, primary: true }],
  })
  return true
}

export const downloadUpdate = () => {
  versionActions.setVersionInfo({ status: 'downloading' })
  versionActions.setProgress({ total: 0, current: 0 })

  downloadNewVersion(versionState.versionInfo.newVersion!.version, (total: number, current: number) => {
    // console.log(total, current)
    versionActions.setProgress({ total, current })
  }).then(() => {
    versionActions.setVersionInfo({ status: 'downloaded' })
  }).catch(() => {
    versionActions.setVersionInfo({ status: 'error' })
    // console.log(err)
  })
}


export const setIgnoreVersion = (version: InitState['ignoreVersion']) => {
  versionActions.setIgnoreVersion(version)
  saveIgnoreVersion(version)
}
