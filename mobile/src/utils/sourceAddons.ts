import { SECONDARY_SOURCE_NAMES, decodeHtml, isSecondarySource, secondaryGetJson, secondaryGetText, secondaryRequest, runSecondaryYtdlp, type SecondaryStream } from './secondarySources'

// Source addons (the same file in the desktop and the mobile app): the audio of the songs of the secondary
// sources (YouTube, SoundCloud, Bandcamp, KHInsider) is not part of the app, it comes from addons the user
// installs, like the plugins of Nuclear. An addon is a script:
//
//   /**
//    * @name SoundCloud
//    * @id soundcloud
//    * @version 1.0.0
//    * @author someone
//    * @description Plays the songs of SoundCloud
//    * @homepage https://...
//    */
//   module.exports = {
//     sources: ['sc'],
//     async resolve(track, api) { return { url, hls: false, ext: 'mp3' } },
//   }
//
// `track`: { source, id, url, name, singer, albumName, interval, quality }, `api`: the requests of the app (see
// AddonApi). An addon that plays the sources of the Music API (kw, kg, tx, wy, mg) is a backup: it is used when
// the Music API can't play a song, while it is enabled.
// The addons run with the rights of the app (like the custom sources of LX Music): the user is warned before
// installing one.

export const ADDON_API_VERSION = 1
const ADDON_MAX_SIZE = 2_000_000

export interface AddonInfo {
  id: string
  name: string
  version: string
  author: string
  description: string
  homepage: string
  /** the sources it plays (yt, sc, bc, kh) */
  sources: string[]
  /** where it was installed from (its updates), empty: a file */
  url: string
  enabled: boolean
  installedAt: number
}

interface StoredAddon extends AddonInfo {
  code: string
}

export interface AddonTrack {
  source: string
  id: string
  /** the page of the song on its source */
  url: string
  name: string
  singer: string
  albumName: string
  interval: string | null
  /** the quality wanted (128k, 320k, flac...): the songs of the Music API sources */
  quality: string
}

export interface AddonApi {
  apiVersion: number
  /** a request whose answer is read whatever its status */
  request: typeof secondaryRequest
  getText: typeof secondaryGetText
  getJson: typeof secondaryGetJson
  /** runs the yt-dlp of the app (url, options), resolves with what it prints */
  ytdlp: (url: string, options: string[]) => Promise<string>
  decodeHtml: typeof decodeHtml
  log: (...args: unknown[]) => void
}

interface AddonModule {
  sources: string[]
  resolve: (track: AddonTrack, api: AddonApi) => Promise<SecondaryStream>
}

export interface AddonStorage {
  load: () => Promise<string | null>
  save: (data: string) => Promise<void>
}

let storage: AddonStorage | null = null
let addons: StoredAddon[] = []
const modules = new Map<string, AddonModule>()
const listeners = new Set<(list: AddonInfo[]) => void>()
let ready: Promise<void> | null = null

const api: AddonApi = {
  apiVersion: ADDON_API_VERSION,
  request: secondaryRequest,
  getText: secondaryGetText,
  getJson: secondaryGetJson,
  ytdlp: runSecondaryYtdlp,
  decodeHtml,
  log: (...args) => { console.log('[addon]', ...args) },
}

const toInfo = ({ code, ...info }: StoredAddon): AddonInfo => info

/**
 * The addons installed
 */
export const getAddons = (): AddonInfo[] => addons.map(toInfo)

/**
 * Called with the addons each time they change
 */
export const onAddonsChange = (listener: (list: AddonInfo[]) => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

const save = async() => {
  const list = getAddons()
  for (const listener of listeners) listener(list)
  await storage?.save(JSON.stringify(addons))
}

/**
 * The fields of the comment at the top of the script (`@name ...`)
 */
const parseHeader = (code: string) => {
  const fields: Record<string, string> = {}
  const comment = /^\s*\/\*([\s\S]*?)\*\//.exec(code)?.[1] ?? ''
  for (const line of comment.split('\n')) {
    const field = /^\s*\*?\s*@(\w+)\s+(.+?)\s*$/.exec(line)
    if (field) fields[field[1]] = field[2]
  }
  return fields
}

const evaluate = (code: string): AddonModule => {
  const module: { exports: unknown } = { exports: {} }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const run = new Function('module', 'exports', 'require', `'use strict';\n${code}\n`) as (module: unknown, exports: unknown, require: unknown) => void
  run(module, module.exports, (name: string) => { throw new Error(`require is not available in addons: ${name}`) })
  const exported = module.exports as Partial<AddonModule> | null
  if (!exported || typeof exported.resolve != 'function') throw new Error('the addon has no resolve function')
  if (!Array.isArray(exported.sources) || !exported.sources.length) throw new Error('the addon has no sources')
  return exported as AddonModule
}

const loadModule = (addon: StoredAddon) => {
  try {
    modules.set(addon.id, evaluate(addon.code))
  } catch (err) {
    modules.delete(addon.id)
    console.log(`[addon] ${addon.id} failed to load:`, err)
  }
}

/**
 * Set by the app at its start: where the addons are kept, then they are loaded
 */
export const initAddons = async(addonStorage: AddonStorage) => {
  storage = addonStorage
  ready = (async() => {
    try {
      const data = await addonStorage.load()
      addons = data ? JSON.parse(data) as StoredAddon[] : []
    } catch (err) {
      console.log('[addon] list failed to load:', err)
      addons = []
    }
    for (const addon of addons) loadModule(addon)
    for (const listener of listeners) listener(getAddons())
  })()
  return ready
}

export interface SourceScriptInfo {
  /** addon: a source addon, api: a Music API (a custom source of LX Music, the Chinese platforms) */
  kind: 'addon' | 'api'
  name: string
  version: string
  author: string
  description: string
}

/**
 * What a source script is, from its text only (nothing of it runs before the user agrees to install it):
 * the addons set `module.exports`, the other scripts are custom sources of LX Music
 */
export const readSourceScript = (code: string): SourceScriptInfo => {
  if (code.length > ADDON_MAX_SIZE) throw new Error('the script is too large')
  const header = parseHeader(code)
  const name = header.name?.trim()
  if (!name) throw new Error('the script has no @name')
  return {
    kind: /\bmodule\.exports\b/.test(code) ? 'addon' : 'api',
    name,
    version: header.version ?? '',
    author: header.author ?? '',
    description: header.description ?? '',
  }
}

const readAddon = (code: string, url: string): StoredAddon => {
  const info = readSourceScript(code)
  const header = parseHeader(code)
  const module = evaluate(code)
  return {
    id: (header.id ?? info.name).trim().toLowerCase().replace(/[^\w.-]+/g, '-'),
    name: info.name,
    version: info.version,
    author: info.author,
    description: info.description,
    homepage: header.homepage ?? '',
    sources: module.sources.map(String),
    url,
    enabled: true,
    installedAt: Date.now(),
    code,
  }
}

/**
 * Install an addon (an addon with the same id is replaced, an update)
 */
export const installAddon = async(code: string, url = ''): Promise<AddonInfo> => {
  await ready
  const addon = readAddon(code, url)
  const old = addons.find(item => item.id == addon.id)
  if (old) addon.enabled = old.enabled
  addons = old ? addons.map(item => item == old ? addon : item) : [...addons, addon]
  loadModule(addon)
  await save()
  return toInfo(addon)
}

/* ---------- downloads from GitHub, with its mirrors (GitHub is blocked in some places: China) ---------- */

// the proxies of GitHub: the link of GitHub after their address (they fetch it from GitHub)
const GITHUB_PROXIES = [
  'https://ghproxy.net/',
  'https://gh.llkk.cc/',
  'https://github.moeyy.xyz/',
  'https://ghproxy.cn/',
  'https://gh.api.99988866.xyz/',
  'https://ghp.ci/',
  'https://gh-proxy.org/',
]
const GITHUB_URL_RXP = /^https:\/\/(?:raw\.githubusercontent\.com|github\.com|gist\.githubusercontent\.com)\//
const RAW_URL_RXP = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/

/**
 * The mirrors of a file of GitHub: jsDelivr (raw files), then the proxies
 */
export const getGithubMirrors = (url: string): string[] => {
  if (!GITHUB_URL_RXP.test(url)) return []
  const mirrors: string[] = []
  const raw = RAW_URL_RXP.exec(url)
  if (raw) mirrors.push(`https://cdn.jsdelivr.net/gh/${raw[1]}/${raw[2]}@${raw[3]}/${raw[4]}`)
  for (const proxy of GITHUB_PROXIES) mirrors.push(`${proxy}${url}`)
  return mirrors
}

// a script / a list: not an error page (some proxies answer them with a success status)
const getFile = async(url: string) => {
  const res = await secondaryRequest(url)
  if (res.status < 200 || res.status >= 300) throw new Error(`download failed: ${res.status}`)
  if (!res.body.trim() || /^\s*</.test(res.body)) throw new Error('download failed: not a script')
  return res.body
}

// the first of the requests that succeeds (all of them failed: the first error)
const firstSuccess = async<T>(tasks: Array<Promise<T>>): Promise<T> => new Promise((resolve, reject) => {
  let failed = 0
  let firstError: unknown = null
  for (const task of tasks) {
    task.then(resolve, (err: unknown) => {
      firstError ??= err
      if (++failed == tasks.length) reject(firstError)
    })
  }
})

/**
 * A file (a script, the store): from its link, else from the mirrors of GitHub at the same time (the first
 * that answers)
 */
export const fetchScript = async(url: string): Promise<string> => {
  try {
    return await getFile(url)
  } catch (err) {
    const mirrors = getGithubMirrors(url)
    if (!mirrors.length) throw err
    try {
      return await firstSuccess(mirrors.map(getFile))
    } catch {
      throw err
    }
  }
}

/**
 * The script of a source (an addon, a Music API) from its link
 */
export const fetchAddon = async(url: string) => fetchScript(url)

/**
 * Install the new version of an addon installed from a link
 * @returns whether it changed
 */
export const updateAddon = async(id: string): Promise<boolean> => {
  const addon = addons.find(item => item.id == id)
  if (!addon?.url) throw new Error('the addon was not installed from a link')
  const code = await fetchAddon(addon.url)
  if (code == addon.code) return false
  await installAddon(code, addon.url)
  return true
}

export const removeAddon = async(id: string) => {
  addons = addons.filter(item => item.id != id)
  modules.delete(id)
  await save()
}

export const setAddonEnabled = async(id: string, enabled: boolean) => {
  addons = addons.map(item => item.id == id ? { ...item, enabled } : item)
  await save()
}

/**
 * Whether an addon loaded with no error (its script runs)
 */
export const isAddonLoaded = (id: string) => modules.has(id)

/* ---------- the store (like the plugin store of Nuclear) ---------- */

// the list of the sources to install, a file of the sources repository (registry.json): the addons of
// LX Music+ and the Music APIs of other authors (links to their scripts, nothing of them is hosted there).
// From the mirrors of GitHub when it is blocked (fetchScript)
const STORE_URL = 'https://raw.githubusercontent.com/dlvkz/lx-music-plus-sources/main/registry.json'

export interface StoreEntry {
  id: string
  name: string
  kind: 'addon' | 'api'
  author: string
  /** the addons: their version (an update when it differs from the one installed) */
  version: string
  /** the addons: the sources they play */
  plays: string[]
  description: string
  descriptionZh: string
  /** the script */
  url: string
  homepage: string
  /** the Music API used after installing when none is (registry.json "default": true) */
  isDefault: boolean
}

const toStoreEntry = (item: Partial<Record<keyof StoreEntry, unknown>>): StoreEntry | null => {
  const text = (value: unknown) => typeof value == 'string' ? value.trim() : ''
  const entry: StoreEntry = {
    id: text(item.id),
    name: text(item.name),
    kind: item.kind == 'api' ? 'api' : 'addon',
    author: text(item.author),
    version: text(item.version),
    plays: Array.isArray(item.plays) ? item.plays.filter(source => typeof source == 'string') : [],
    description: text(item.description),
    descriptionZh: text(item.descriptionZh),
    url: text(item.url),
    homepage: text(item.homepage),
    isDefault: (item as { default?: unknown }).default === true,
  }
  if (!entry.id || !entry.name || !/^https:\/\//.test(entry.url) || (item.kind != 'api' && item.kind != 'addon')) return null
  return entry
}

/**
 * The sources of the store
 */
export const fetchSourceStore = async(): Promise<StoreEntry[]> => {
  const data = JSON.parse(await fetchScript(STORE_URL)) as { sources?: unknown[] }
  if (!Array.isArray(data.sources)) throw new Error('not a source store')
  return data.sources.map(item => toStoreEntry(item as Partial<Record<keyof StoreEntry, unknown>>)).filter((entry): entry is StoreEntry => entry != null)
}

/**
 * The Music API to use when none is: the default one of the store when it is installed, else the first of the store
 * that is installed
 */
export const getDefaultStoreApi = <T extends MusicApiInfo>(store: StoreEntry[], apis: T[]): T | null => {
  const entries = store.filter(entry => entry.kind == 'api').sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  for (const entry of entries) {
    const api = apis.find(item => item.name == entry.name)
    if (api) return api
  }
  return null
}

/* ---------- the sources page: the store and the sources installed in one list ---------- */

/** a Music API installed (the custom sources of LX Music) */
export interface MusicApiInfo {
  id: string
  name: string
  description?: string | null
  version?: string | null
  author?: string | null
}

export interface SourceRow {
  key: string
  kind: 'addon' | 'api'
  name: string
  /** in the store */
  entry: StoreEntry | null
  /** installed */
  addon: AddonInfo | null
  api: MusicApiInfo | null
}

/**
 * The sources of the store (installed or not) then the ones installed that are not in it, the Music APIs first
 * (a Music API of the store: the one installed with its name)
 */
export const getSourceRows = (store: StoreEntry[], installedAddons: AddonInfo[], apis: MusicApiInfo[]): SourceRow[] => {
  const apiRows: SourceRow[] = []
  const addonRows: SourceRow[] = []
  const usedApis = new Set<string>()
  const usedAddons = new Set<string>()
  for (const entry of store) {
    if (entry.kind == 'api') {
      const api = apis.find(item => item.name == entry.name && !usedApis.has(item.id)) ?? null
      if (api) usedApis.add(api.id)
      apiRows.push({ key: `store_${entry.id}`, kind: 'api', name: entry.name, entry, addon: null, api })
    } else {
      const addon = installedAddons.find(item => item.id == entry.id) ?? null
      if (addon) usedAddons.add(addon.id)
      addonRows.push({ key: `store_${entry.id}`, kind: 'addon', name: entry.name, entry, addon, api: null })
    }
  }
  for (const api of apis) {
    if (!usedApis.has(api.id)) apiRows.push({ key: `api_${api.id}`, kind: 'api', name: api.name, entry: null, addon: null, api })
  }
  for (const addon of installedAddons) {
    if (!usedAddons.has(addon.id)) addonRows.push({ key: `addon_${addon.id}`, kind: 'addon', name: addon.name, entry: null, addon, api: null })
  }
  return [...apiRows, ...addonRows]
}

/**
 * An addon of the store with a version other than the one installed
 */
export const hasStoreUpdate = (row: SourceRow) => !!(row.addon && row.entry?.version && row.addon.version != row.entry.version)

/* ---------- batch downloads ---------- */

/** the sources played through the Music API */
export const MUSIC_API_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg']
const MUSIC_API_SOURCE_NAMES: Record<string, Record<string, string>> = {
  en: { kw: 'Kuwo', kg: 'Kugou', tx: 'QQ Music', wy: 'NetEase', mg: 'Migu' },
  cn: { kw: '酷我', kg: '酷狗', tx: 'QQ 音乐', wy: '网易云', mg: '咪咕' },
  tw: { kw: '酷我', kg: '酷狗', tx: 'QQ 音樂', wy: '網易雲', mg: '咪咕' },
}

/**
 * The name of a source an addon plays (the Chinese platforms: in the language of the app, its locale)
 */
export const getSourceName = (source: string, locale = '') => {
  if (isSecondarySource(source)) return SECONDARY_SOURCE_NAMES[source]
  const lang = /^zh[-_]?(tw|hk)/i.test(locale) ? 'tw' : /^zh/i.test(locale) ? 'cn' : 'en'
  return MUSIC_API_SOURCE_NAMES[lang][source] ?? source
}

/**
 * Whether nothing installed can play the songs of a source: its source addon (YouTube, SoundCloud...), or for the
 * Chinese platforms a Music API in use or a backup addon (the user is sent to the sources then)
 * @param hasMusicApi a Music API is in use
 */
export const isMissingSource = (source: string, hasMusicApi: boolean) => {
  if (isSecondarySource(source)) return !hasSourceAddon(source)
  if (MUSIC_API_SOURCES.includes(source)) return !hasMusicApi && !hasSourceAddon(source)
  return false
}

/**
 * A Music API whose author asks for no batch downloads (its description, e.g. Huibq: "禁止批量下载！")
 */
export const forbidsBatchDownload = (api: Pick<MusicApiInfo, 'description'> | null | undefined) => {
  return !!api && /禁止\s*批量\s*下载|禁止\s*批量|no\s+(?:bulk|batch)\s+download/i.test(api.description ?? '')
}

/**
 * The songs of a download played through the Music API
 */
export const countMusicApiSongs = (list: Array<{ source: string }>) => list.filter(item => MUSIC_API_SOURCES.includes(item.source)).length

/**
 * An addon of the store: installed (its version), not installed (null)
 */
export const getInstalledAddonVersion = (id: string) => addons.find(addon => addon.id == id)?.version ?? null

/**
 * The enabled addons that play a source, in the order they were installed
 */
const getSourceAddons = (source: string) => addons.filter(addon => addon.enabled && modules.get(addon.id)?.sources.includes(source))

/**
 * Whether an addon plays the songs of a source
 */
export const hasSourceAddon = (source: string) => getSourceAddons(source).length > 0

export class NoSourceAddonError extends Error {
  source: string
  constructor(source: string) {
    super(`No source addon plays ${getSourceName(source)}: install one in Settings → Sources`)
    this.source = source
  }
}

const toTrack = (musicInfo: LX.Music.MusicInfo, quality = ''): AddonTrack => {
  const meta = musicInfo.meta as unknown as { songId: string, secondaryUrl?: string, albumName?: string }
  return {
    source: musicInfo.source,
    id: meta.songId,
    url: meta.secondaryUrl ?? '',
    name: musicInfo.name,
    singer: musicInfo.singer,
    albumName: meta.albumName ?? '',
    interval: musicInfo.interval,
    quality,
  }
}

// the audio of a song from the addons that play its source (the next one when one fails)
const resolveFromAddons = async(musicInfo: LX.Music.MusicInfo, quality = ''): Promise<SecondaryStream & { quality: string }> => {
  await ready
  const list = getSourceAddons(musicInfo.source)
  if (!list.length) throw new NoSourceAddonError(musicInfo.source)
  const track = toTrack(musicInfo, quality)
  let error: unknown = null
  for (const addon of list) {
    try {
      const stream = await modules.get(addon.id)!.resolve({ ...track }, api) as SecondaryStream & { quality?: string }
      if (!stream?.url) throw new Error(`${addon.name}: no stream`)
      return { url: stream.url, hls: !!stream.hls, ext: stream.ext || 'mp3', quality: stream.quality ?? quality }
    } catch (err) {
      error = err
    }
  }
  throw error instanceof Error ? error : new Error(String(error))
}

/**
 * The audio of a secondary source song, from the addons that play its source
 */
export const resolveSecondaryStream = async(musicInfo: LX.Music.MusicInfo): Promise<SecondaryStream> => {
  const { quality, ...stream } = await resolveFromAddons(musicInfo)
  return stream
}

/**
 * Whether the addons can be a backup of the Music API for this source (the backup addons are only known once
 * they are loaded: resolveBackupStream fails when there is none)
 */
export const isBackupSource = (source: string) => MUSIC_API_SOURCES.includes(source)

/**
 * The link of a song of the Music API sources from a backup addon (e.g. GD Studio), when the Music API can't
 * play it, in this quality or the one the addon has
 */
export const resolveBackupStream = async(musicInfo: LX.Music.MusicInfo, quality: string): Promise<{ url: string, quality: string }> => {
  const stream = await resolveFromAddons(musicInfo, quality)
  return { url: stream.url, quality: stream.quality }
}
