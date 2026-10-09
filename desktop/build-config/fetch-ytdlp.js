// Downloads the latest yt-dlp for the platform the app is packed for into resources/yt-dlp (shipped with the app as
// an extra resource, the YouTube secondary source). The app keeps its own copy up to date afterwards (yt-dlp -U).
// The downloads are kept in resources/yt-dlp-cache, so packing several targets downloads each one once.
const fs = require('fs')
const path = require('path')
const https = require('https')

const BASE_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/'
// the standalone builds (no Python needed): [release asset, file name in the app]
const BUILDS = {
  'win32-x64': ['yt-dlp.exe', 'yt-dlp.exe'],
  'win32-ia32': ['yt-dlp_x86.exe', 'yt-dlp.exe'],
  'win32-arm64': ['yt-dlp_arm64.exe', 'yt-dlp.exe'],
  'linux-x64': ['yt-dlp_linux', 'yt-dlp'],
  'linux-arm64': ['yt-dlp_linux_aarch64', 'yt-dlp'],
}
const TARGET_DIR = path.join(__dirname, '../resources/yt-dlp')
const CACHE_DIR = path.join(__dirname, '../resources/yt-dlp-cache')

const download = (url, to, redirects = 5) => new Promise((resolve, reject) => {
  https.get(url, { headers: { 'User-Agent': 'lx-music-build' } }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects) {
      res.resume()
      download(res.headers.location, to, redirects - 1).then(resolve, reject)
      return
    }
    if (res.statusCode != 200) {
      res.resume()
      reject(new Error(`yt-dlp download failed: ${res.statusCode}`))
      return
    }
    const file = fs.createWriteStream(to)
    res.pipe(file)
    file.on('finish', () => { file.close(resolve) })
    file.on('error', reject)
  }).on('error', reject)
})

/**
 * @param {string} platform win32 / linux
 * @param {string} arch x64 / ia32 / arm64
 */
const fetchYtdlp = async(platform = process.platform, arch = process.arch, force = false) => {
  const build = BUILDS[`${platform}-${arch}`]
  if (!build) throw new Error(`No yt-dlp build for ${platform}-${arch}`)
  const [asset, fileName] = build
  const cached = path.join(CACHE_DIR, asset)
  if (force || !fs.existsSync(cached) || !fs.statSync(cached).size) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    console.log(`downloading ${asset}...`)
    await download(BASE_URL + asset, `${cached}.tmp`)
    fs.renameSync(`${cached}.tmp`, cached)
  }
  // only the binary of this target is shipped
  fs.rmSync(TARGET_DIR, { recursive: true, force: true })
  fs.mkdirSync(TARGET_DIR, { recursive: true })
  const target = path.join(TARGET_DIR, fileName)
  fs.copyFileSync(cached, target)
  if (platform != 'win32') fs.chmodSync(target, 0o755)
}

module.exports = fetchYtdlp
if (require.main === module) {
  const [platform, arch] = process.argv.slice(2).filter(arg => !arg.startsWith('--'))
  fetchYtdlp(platform, arch, process.argv.includes('--force')).catch(err => { console.error(err); process.exit(1) })
}
