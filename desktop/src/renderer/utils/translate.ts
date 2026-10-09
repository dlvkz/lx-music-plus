// Live translation service into the language of the app: non-English text when the app is in English, the text
// that is not Chinese when it is in Chinese, the text in another script for the other languages.
// Primary: Google Translate public endpoint, Fallback: Bing Translator edge endpoint (the other way around when the
// app is in Chinese).
import { httpFetch } from './request'
import { appSetting } from '@renderer/store/setting'

const CACHE_KEY = 'lx_live_translation_cache_v1'
const MAX_CACHE_SIZE = 5000
// the whole cache is serialized on save, so writes are batched instead of done per translation
const SAVE_DELAY = 3000
// list rows request translations while scrolling: limit parallel requests and don't retry misses right away
const MAX_CONCURRENT = 6
const MISS_RETRY_TIME = 60_000

let memoryCache = new Map<string, string>()

const loadCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      memoryCache = new Map(Object.entries(parsed))
    }
  } catch (e) {
    console.log('load translation cache failed', e)
  }
}

const saveCache = () => {
  try {
    const obj = Object.fromEntries(memoryCache.entries())
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj))
  } catch (e) {
    console.log('save translation cache failed', e)
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
const scheduleSaveCache = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    saveCache()
  }, SAVE_DELAY)
}
window.addEventListener('beforeunload', () => {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  saveCache()
})

loadCache()

const pendingRequests = new Map<string, Promise<string | null>>()
const missTimes = new Map<string, number>()
const waitingTasks: Array<() => void> = []
let runningCount = 0
const acquireSlot = async() => new Promise<void>(resolve => {
  if (runningCount < MAX_CONCURRENT) {
    runningCount++
    resolve()
  } else waitingTasks.push(resolve)
})
const releaseSlot = () => {
  // last in first out: the most recently requested texts are the ones currently on screen
  const next = waitingTasks.pop()
  if (next) next()
  else runningCount--
}

export const isEnglishText = (text: string): boolean => {
  if (!text?.trim()) return true
  // Treat Basic Latin + Latin-1 Supplement as "English/Western" already.
  return /^[\u0020-\u007E\u00A0-\u00FF\s]*$/.test(text)
}

const HAN_RE = /[㐀-鿿豈-﫿]/
const KANA_HANGUL_RE = /[぀-ヿᄀ-ᇿ가-힯]/
const LETTER_RE = /\p{L}/u

/**
 * The language names are translated to: the one of the app
 */
export const getTranslationTarget = (): string | null => {
  // (the setting changes before the language of i18n, the components that follow it see the new one)
  const locale: string | null | undefined = appSetting['common.langId'] ?? (typeof window === 'undefined' ? null : window.i18n?.locale)
  switch (locale) {
    case 'en-us': return 'en'
    case 'zh-cn': return 'zh-CN'
    case 'zh-tw': return 'zh-TW'
    default: return locale ? locale.split('-')[0] : null
  }
}

// the scripts a language reads, its names in them are not translated (Latin: English names stay as they are)
const LATIN = 'A-Za-zªºÀ-ɏḀ-ỿ'
const SCRIPTS: Record<string, RegExp> = {
  ja: new RegExp(`[${LATIN}぀-ヿㇰ-ㇿｦ-ﾟ㐀-鿿豈-﫿]`, 'g'),
  ko: new RegExp(`[${LATIN}ᄀ-ᇿ㄰-㆏가-힯]`, 'g'),
  ru: new RegExp(`[${LATIN}Ѐ-ӿ]`, 'g'),
  latin: new RegExp(`[${LATIN}]`, 'g'),
}

/**
 * Whether a text is not in the language it would be translated to (Japanese with kanji is not Chinese)
 */
export const needsTranslation = (text: string | null | undefined, targetLang = getTranslationTarget()): boolean => {
  if (!text?.trim() || !targetLang) return false
  if (targetLang == 'en') return !isEnglishText(text)
  if (targetLang.startsWith('zh')) return LETTER_RE.test(text) && (!HAN_RE.test(text) || KANA_HANGUL_RE.test(text))
  // the other languages: names with letters of another script
  return LETTER_RE.test(text.replace(SCRIPTS[targetLang] ?? SCRIPTS.latin, ''))
}

const translateGoogle = async(text: string, targetLang: string): Promise<string | null> => {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dj=1&source=input&q=${encodeURIComponent(text)}`
  const { body, statusCode } = await (httpFetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }) as any).promise
  if (statusCode !== 200) throw new Error(`google translate ${statusCode}`)
  const data = body
  if (!data[0]?.length) return null
  return data[0].map((s: any) => s[0]).join('')
}

const translateBing = async(text: string, targetLang: string): Promise<string | null> => {
  const url = `https://edge.microsoft.com/translate/translatetext?isEnterpriseClient=false&to=${targetLang}`
  const { body, statusCode } = await (httpFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    body: JSON.stringify([text]),
  }) as any).promise
  if (statusCode !== 200) throw new Error(`bing translate ${statusCode}`)
  const data = body
  return data[0]?.translations?.[0]?.text ?? null
}

export interface TranslateOptions {
  targetLang?: string
  useCache?: boolean
  skipIfEnglish?: boolean
}

/**
 * Synchronous cache lookup, lets already translated text render without an async round trip
 */
export const getCachedTranslation = (text: string, targetLang = getTranslationTarget() ?? 'en'): string | null => {
  return memoryCache.get(`${targetLang}::${text}`) ?? null
}

export const translateText = async(text: string, options: TranslateOptions = {}): Promise<string | null> => {
  const { targetLang = getTranslationTarget() ?? 'en', useCache = true, skipIfEnglish = true } = options
  // (the text already in the language it is translated to)
  if (skipIfEnglish && !needsTranslation(text, targetLang)) return null
  const cacheKey = `${targetLang}::${text}`
  if (useCache && memoryCache.has(cacheKey)) return memoryCache.get(cacheKey)!

  // the same text is often requested by many rows at once (e.g. an artist name)
  const pending = pendingRequests.get(cacheKey)
  if (pending) return pending
  const missTime = missTimes.get(cacheKey)
  if (missTime && Date.now() - missTime < MISS_RETRY_TIME) return null

  const request = requestTranslation(text, targetLang, cacheKey, useCache).finally(() => {
    pendingRequests.delete(cacheKey)
  })
  pendingRequests.set(cacheKey, request)
  return request
}

const requestTranslation = async(text: string, targetLang: string, cacheKey: string, useCache: boolean): Promise<string | null> => {
  await acquireSlot()
  try {
    return await fetchTranslation(text, targetLang, cacheKey, useCache)
  } finally {
    releaseSlot()
  }
}

// the app in Chinese: Bing first (Google is blocked in mainland China, its requests would only be waited for)
const getTranslators = () => getTranslationTarget()?.startsWith('zh')
  ? [{ name: 'bing', translate: translateBing }, { name: 'google', translate: translateGoogle }]
  : [{ name: 'google', translate: translateGoogle }, { name: 'bing', translate: translateBing }]

const fetchTranslation = async(text: string, targetLang: string, cacheKey: string, useCache: boolean): Promise<string | null> => {
  let result: string | null = null
  for (const translator of getTranslators()) {
    try {
      result = await translator.translate(text, targetLang)
    } catch (e) {
      console.log(`${translator.name} translate error`, e)
    }
    if (result) break
  }
  if (result && useCache) {
    memoryCache.set(cacheKey, result)
    if (memoryCache.size > MAX_CACHE_SIZE) {
      const first = memoryCache.keys().next().value
      if (first) memoryCache.delete(first)
    }
    scheduleSaveCache()
  }
  if (result) missTimes.delete(cacheKey)
  else missTimes.set(cacheKey, Date.now())
  return result
}

const CJK_RE = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/

/**
 * Returns the term that should actually be sent to the platform search API.
 * When the user-enabled switch is on and the query is not already CJK,
 * it translates the query to Chinese before searching.
 */
export const getSearchText = async(text: string): Promise<string> => {
  const trimmed = text.trim()
  if (!trimmed) return text
  if (!appSetting['search.isAutoTranslateSearch']) return text
  if (CJK_RE.test(trimmed)) return text
  const translated = await translateText(text, { targetLang: 'zh-CN', skipIfEnglish: false, useCache: true })
  if (!translated) return text
  return translated
}

export const clearTranslationCache = () => {
  memoryCache.clear()
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {}
}
