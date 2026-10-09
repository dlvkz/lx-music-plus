/* eslint-disable no-template-curly-in-string */

const builder = require('electron-builder')
const beforePack = require('./build-before-pack')
const afterPack = require('./build-after-pack')

/**
* @type {import('electron-builder').Configuration}
* @see https://www.electron.build/configuration/configuration
*/
const options = {
  // LX Music+: an unofficial fork of LX Music (lyswhut), its own id / name (installed next to the official app)
  appId: 'com.lxmusicplus.desktop',
  productName: 'lx-music-plus',
  beforePack,
  afterPack,
  protocols: {
    name: 'lx-music-protocol',
    schemes: [
      'lxmusic',
    ],
  },
  directories: {
    buildResources: './resources',
    output: './build',
  },
  files: [
    '!node_modules/**/*',
    'node_modules/font-list',
    'node_modules/better-sqlite3/lib',
    'node_modules/better-sqlite3/package.json',
    'node_modules/better-sqlite3/build/Release/better_sqlite3.node',
    'node_modules/electron-font-manager/index.js',
    'node_modules/electron-font-manager/package.json',
    'node_modules/electron-font-manager/build/Release/font_manager.node',
    'node_modules/node-gyp-build',
    'node_modules/bufferutil',
    'node_modules/utf-8-validate',
    'dist/**/*',
  ],
  asar: {
    smartUnpack: false,
  },
  extraResources: [
    // the licence of LX Music+ and the one of LX Music it is based on
    { from: './LICENSE', to: 'licenses/LICENSE.txt' },
    { from: './LICENSE-LX-Music', to: 'licenses/LICENSE-LX-Music.txt' },
    // the YouTube secondary source (build-config/fetch-ytdlp.js)
    { from: './resources/yt-dlp', to: 'yt-dlp' },
  ],
  publish: [
    {
      provider: 'github',
      // LX Music+: the releases of its own repository (the auto update)
      owner: 'dlvkz',
      repo: 'lx-music-plus',
    },
  ],
}
/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const winOptions = {
  win: {
    icon: './resources/icons/icon.ico',
    // artifactName: '${productName}-v${version}-${env.ARCH}-${env.TARGET}.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    // differentialPackage: true,
    // the installer in the language of the system (the licence agreement is shown by the app, in its language)
    multiLanguageInstaller: true,
    displayLanguageSelector: false,
    installerLanguages: ['en_US', 'zh_CN', 'zh_TW', 'ja_JP', 'ko_KR', 'es_ES', 'pt_BR', 'ru_RU', 'vi_VN', 'de_DE', 'fr_FR', 'it_IT', 'pl_PL'],
    shortcutName: 'LX Music+',
    uninstallDisplayName: 'LX Music+ ${version}',
  },
}
/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const linuxOptions = {
  linux: {
    maintainer: 'dlvkz <73993630+dlvkz@users.noreply.github.com>',
    executableName: 'lx-music-plus',
    // the window is linked to its .desktop entry (taskbar icon, WM_CLASS)
    syncDesktopName: true,
    synopsis: 'Music player, an unofficial fork of LX Music',
    // artifactName: '${productName}-${version}.${env.ARCH}.${ext}',
    icon: './resources/icons',
    category: 'Utility;AudioVideo;Audio;Player;Music;',
    desktop: {
      // https://www.electron.build/app-builder-lib.interface.linuxdesktopfile
      // https://www.electronjs.org/docs/latest/tutorial/linux-desktop-actions
      // https://specifications.freedesktop.org/desktop-entry-spec/latest/example.html
      // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html#desktop-files
      entry: {
        Name: 'LX Music+',
        'Name[zh_CN]': 'LX Music+',
        'Name[zh_TW]': 'LX Music+',
        Encoding: 'UTF-8',
        MimeType: 'x-scheme-handler/lxmusic',
        StartupNotify: 'false',
      },
    },
  },
  appImage: {
    category: 'Utility;AudioVideo;Audio;Player;Music;',
  },
  // the defaults of electron-builder miss the sound library (ALSA) and libgbm, and for pacman list packages Arch no
  // longer has (http-parser)
  deb: {
    depends: [
      'libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libuuid1',
      'libsecret-1-0', 'libasound2 | libasound2t64', 'libgbm1',
    ],
  },
  rpm: {
    depends: [
      'gtk3', 'libnotify', 'nss', 'libXScrnSaver', '(libXtst or libXtst6)', 'xdg-utils', 'at-spi2-core',
      '(libuuid or libuuid1)', 'alsa-lib', 'mesa-libgbm',
    ],
  },
  pacman: {
    depends: [
      'gtk3', 'libnotify', 'nss', 'libxss', 'libxtst', 'xdg-utils', 'at-spi2-core', 'util-linux-libs', 'libsecret',
      'alsa-lib', 'mesa',
    ],
  },
}
// win: {
// tagret: {
//   setup: ['nsis', '${productName}-v${version}-${env.ARCH}-Setup.${ext}'],
//   green: ['7z', '${productName}-v${version}-${env.ARCH}-green.${ext}'],
//   portable: ['portable', '${productName}-v${version}-${env.ARCH}-portable.${ext}'],
// },
// },
// linux: {
// platform: Platform.WINDOWS,
// arch: {
//   x64: builder.Arch.x64,
//   arm64: builder.Arch.arm64,
//   armv7l: builder.Arch.armv7l,
// },
// tagret: {
//   deb: ['deb', '${productName}_${version}_${env.ARCH}.${ext}'],
//   appImage: ['AppImage', '${productName}_${version}_${env.ARCH}.${ext}'],
//   pacman: ['pacman', '${productName}_${version}_${env.ARCH}.${ext}'],
//   rpm: ['rpm', '${productName}-${version}.${env.ARCH}.${ext}'],
// },
// },

const createTarget = {
  /**
   *
   * @param {*} arch
   * @param {*} packageType
   * @returns {{ buildOptions: import('electron-builder').CliOptions, options: import('electron-builder').Configuration }}
   */
  win(arch, packageType) {
    switch (packageType) {
      case 'setup':
        winOptions.artifactName = `\${productName}-v\${version}-${arch}-Setup.\${ext}`
        return {
          buildOptions: { win: ['nsis'] },
          options: winOptions,
        }
      case 'green':
        winOptions.artifactName = `\${productName}-v\${version}-win_${arch}-green.\${ext}`
        return {
          buildOptions: { win: ['7z'] },
          options: winOptions,
        }
      case 'win7_setup':
        winOptions.artifactName = `\${productName}-v\${version}-win7_${arch}-Setup.\${ext}`
        return {
          buildOptions: { win: ['nsis'] },
          options: winOptions,
        }
      case 'win7_green':
        winOptions.artifactName = `\${productName}-v\${version}-win7_${arch}-green.\${ext}`
        return {
          buildOptions: { win: ['7z'] },
          options: winOptions,
        }
      case 'portable':
        winOptions.artifactName = `\${productName}-v\${version}-${arch}-portable.\${ext}`
        return {
          buildOptions: { win: ['portable'] },
          options: winOptions,
        }
      default: throw new Error('Unknown package type: ' + packageType)
    }
  },
  /**
   *
   * @param {*} arch
   * @param {*} packageType
   * @returns {{ buildOptions: import('electron-builder').CliOptions, options: import('electron-builder').Configuration }}
   */
  linux(arch, packageType) {
    const debArch = arch == 'x64' ? 'amd64' : arch
    const rpmArch = arch == 'x64' ? 'x86_64' : 'aarch64'
    const names = {
      AppImage: `\${productName}_\${version}_${arch}.\${ext}`,
      deb: `\${productName}_\${version}_${debArch}.\${ext}`,
      rpm: `\${productName}-\${version}.${rpmArch}.\${ext}`,
      pacman: `\${productName}-\${version}-${arch}.\${ext}`,
    }
    const types = {
      appImage: ['AppImage'],
      deb: ['deb'],
      rpm: ['rpm'],
      pacman: ['pacman'],
      // every package of the arch in one build: its update info (latest-linux*.yml) lists them all
      all: ['AppImage', 'deb', 'rpm', 'pacman'],
    }[packageType]
    if (!types) throw new Error('Unknown package type: ' + packageType)
    for (const type of types) {
      const key = type == 'AppImage' ? 'appImage' : type
      linuxOptions[key] = { ...linuxOptions[key], artifactName: names[type] }
    }
    return {
      buildOptions: { linux: types },
      options: linuxOptions,
    }
  },
}

/**
 *
 * @param {'win' | 'linux' | 'dir'} target 构建目标平台
 * @param {'x86_64' | 'x64' | 'x86' | 'arm64' | 'armv7l'} arch 包架构
 * @param {*} packageType 包类型
 * @param {'onTagOrDraft' | 'always' | 'never'} publishType 发布类型
 */
const build = async(target, arch, packageType, publishType) => {
  if (target == 'dir') {
    await builder.build({
      dir: true,
      config: { ...options, ...winOptions, ...linuxOptions },
    })
    return
  }
  const targetInfo = createTarget[target](arch, packageType)
  // Promise is returned
  await builder.build({
    ...targetInfo.buildOptions,
    publish: publishType ?? 'never',
    x64: arch == 'x64' || arch == 'x86_64',
    ia32: arch == 'x86' || arch == 'x86_64',
    arm64: arch == 'arm64',
    armv7l: arch == 'armv7l',
    config: { ...options, ...targetInfo.options },
  })
  // .then((result) => {
  //   console.log(JSON.stringify(result))
  // })
  // .catch((error) => {
  //   console.error(error)
  // })
}

const params = {}

for (const param of process.argv.slice(2)) {
  const [name, value] = param.split('=')
  params[name] = value
}

if (params.target == null) throw new Error('Missing target')
if (params.target != 'dir' && params.arch == null) throw new Error('Missing arch')
if (params.target != 'dir' && params.type == null) throw new Error('Missing type')

console.log(params.target, params.arch, params.type, params.publish ?? '')
build(params.target, params.arch, params.type, params.publish)
