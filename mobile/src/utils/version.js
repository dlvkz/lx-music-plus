import { httpGet } from '@/utils/request'
import { REPO_NAME, REPO_OWNER } from '@/config/repo'
import { downloadFile, existsFile, stopDownload, temporaryDirectoryPath, unlink } from '@/utils/fs'
import { getData, saveData, removeData } from '@/plugins/storage'
import { canInstallApk, getSupportedAbis, installApk } from '@/utils/nativeModules/utils'
import { AppState } from 'react-native'
import { APP_PROVIDER_NAME } from '@/config/constant'

const abis = [
  'arm64-v8a',
  'armeabi-v7a',
  'x86_64',
  'x86',
  'universal',
]

// LX Music+: the update info of its repository (mobile/publish/version.json of its main branch)
const address = [
  [`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/mobile/publish/version.json`, 'direct'],
  [`https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main/mobile/publish/version.json`, 'direct'],
  [`https://fastly.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main/mobile/publish/version.json`, 'direct'],
]


const request = async(url, retryNum = 0) => {
  return new Promise((resolve, reject) => {
    httpGet(url, {
      timeout: 10000,
    }, (err, resp, body) => {
      if (err || resp.statusCode != 200) {
        ++retryNum >= 3
          ? reject(err || new Error(resp.statusMessage || resp.statusCode))
          : request(url, retryNum).then(resolve).catch(reject)
      } else resolve(body)
    })
  })
}

const getDirectInfo = async(url) => {
  return request(url).then(info => {
    if (info.version == null) throw new Error('failed')
    return info
  })
}

const getNpmPkgInfo = async(url) => {
  return request(url).then(json => {
    if (!json.versionInfo) throw new Error('failed')
    const info = JSON.parse(json.versionInfo)
    if (info.version == null) throw new Error('failed')
    return info
  })
}

export const getVersionInfo = async(index = 0) => {
  const [url, source] = address[index]
  let promise
  switch (source) {
    case 'direct':
      promise = getDirectInfo(url)
      break
    case 'npm':
      promise = getNpmPkgInfo(url)
      break
  }

  return promise.catch(async(err) => {
    index++
    if (index >= address.length) throw err
    return getVersionInfo(index)
  })
}

const getTargetAbi = async() => {
  const supportedAbis = await getSupportedAbis()
  for (const abi of abis) {
    if (supportedAbis.includes(abi)) return abi
  }
  return abis[abis.length - 1]
}
let downloadJobId = null
const noop = (total, download) => {}
let apkSavePath

// The apk downloaded is kept until it is installed: when the app is restarted before (Android restarts it when it is
// allowed to install apps), the update is installed from it, not downloaded again
const DOWNLOADED_APK_KEY = '@update_downloaded_apk'
const getApkSavePath = version => `${temporaryDirectoryPath}/lx-music-plus-v${version}.apk`

/**
 * Whether the apk of this version is downloaded already (it is then the one installed)
 */
export const isNewVersionDownloaded = async(version) => {
  const info = await getData(DOWNLOADED_APK_KEY).catch(() => null)
  if (info?.version != version || !await existsFile(info.path).catch(() => false)) return false
  apkSavePath = info.path
  return true
}

/**
 * The apk of an update already installed (this version, an older one) is removed
 */
export const removeInstalledApk = async(currentVersion, compareVer) => {
  const info = await getData(DOWNLOADED_APK_KEY).catch(() => null)
  if (!info || compareVer(info.version, currentVersion) > 0) return
  await unlink(info.path).catch(() => {})
  await removeData(DOWNLOADED_APK_KEY).catch(() => {})
}

export const downloadNewVersion = async(version, onDownload = noop) => {
  if (await isNewVersionDownloaded(version)) return updateApp()
  const abi = await getTargetAbi()
  const url = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${version}/lx-music-plus-v${version}-${abi}.apk`
  let savePath = getApkSavePath(version)

  if (downloadJobId) stopDownload(downloadJobId)

  const { jobId, promise } = downloadFile(url, savePath, {
    progressInterval: 500,
    connectionTimeout: 20000,
    readTimeout: 30000,
    begin({ statusCode, contentLength }) {
      onDownload(contentLength, 0)
      // switch (statusCode) {
      //   case 200:
      //   case 206:
      //     break
      //   default:
      //     onDownload(null, contentLength, 0)
      //     break
      // }
    },
    progress({ contentLength, bytesWritten }) {
      onDownload(contentLength, bytesWritten)
    },
  })
  downloadJobId = jobId
  return promise.then(async({ statusCode }) => {
    // (an error page is not an apk)
    if (statusCode < 200 || statusCode >= 300) throw new Error(`download failed: ${statusCode}`)
    apkSavePath = savePath
    await saveData(DOWNLOADED_APK_KEY, { version, path: savePath })
    return updateApp()
  })
}

// Not allowed to install apps yet: Android asks for it and drops the install. When the user comes back to the app with
// it allowed, the install goes on by itself (else the update would have to be started again)
let permissionListener = null
const continueAfterPermission = () => {
  permissionListener?.remove()
  permissionListener = AppState.addEventListener('change', state => {
    if (state != 'active') return
    permissionListener?.remove()
    permissionListener = null
    canInstallApk().then(isAllowed => {
      if (isAllowed && apkSavePath) return installApk(apkSavePath, APP_PROVIDER_NAME)
    }).catch(err => {
      console.log(err)
    })
  })
}

export const updateApp = async() => {
  if (!apkSavePath) throw new Error('apk Save Path is null')
  if (!await canInstallApk().catch(() => true)) continueAfterPermission()
  await installApk(apkSavePath, APP_PROVIDER_NAME)
}
