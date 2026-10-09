// Live translation of names into the language of the app: the ones that are not in English when it is in English,
// the ones that are not Chinese when it is in Chinese, the ones in another script for the other languages.
// Primary: Google Translate public endpoint, fallback: Bing Translator edge endpoint (the other way around when the
// app is in Chinese).
// (desktop: renderer/utils/translate.ts)
import settingState from '@/store/setting/state'
import { httpFetch } from './request'
import { getData, saveData } from '@/plugins/storage'

const CACHE_KEY = '@live_translation_cache_v1'
const MAX_CACHE_SIZE = 5000
// the whole cache is serialized on save, so writes are batched instead of done per translation
const SAVE_DELAY = 5000
// list rows request translations while scrolling: limit parallel requests and don't retry misses right away
const MAX_CONCURRENT = 6
const MISS_RETRY_TIME = 60_000

let memoryCache = new Map<string, string>()
void getData<Record<string, string>>(CACHE_KEY).then(data => {
  if (!data) return
  // translations fetched before the stored cache was read are kept
  memoryCache = new Map([...Object.entries(data), ...memoryCache])
  for (const listener of cacheListeners) listener()
}).catch(err => {
  console.log(err)
})

// lets components that rendered before the stored cache was read pick up their translation
const cacheListeners = new Set<() => void>()
export const onCacheLoaded = (listener: () => void) => {
  cacheListeners.add(listener)
  return () => {
    cacheListeners.delete(listener)
  }
}

let saveTimer: NodeJS.Timeout | null = null
const scheduleSaveCache = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveData(CACHE_KEY, Object.fromEntries(memoryCache.entries()))
  }, SAVE_DELAY)
}

export const isEnglishText = (text: string): boolean => {
  if (!text?.trim()) return true
  // Basic Latin + Latin-1 Supplement count as "English/Western" already
  return /^[\x20-\x7E\xA0-\xFF\s]*$/.test(text)
}

const HAN_RXP = /[㐀-鿿豈-﫿]/
const KANA_HANGUL_RXP = /[぀-ヿᄀ-ᇿ가-힯]/
const LETTER_RXP = /\p{L}/u

/**
 * The language names are translated to: the one of the app
 */
export const getTranslationTarget = (): string | null => {
  // (the setting changes before the language of i18n, the components that follow it see the new one)
  const locale: string | undefined = settingState.setting['common.langId'] ?? global.i18n?.locale
  switch (locale) {
    case 'en_us': return 'en'
    case 'zh_cn': return 'zh-CN'
    case 'zh_tw': return 'zh-TW'
    default: return locale ? locale.split('_')[0] : null
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

export const isTranslationEnabled = () => getTranslationTarget() != null

/**
 * Whether a text is not in the language it would be translated to (Japanese with kanji is not Chinese)
 */
export const needsTranslation = (text: string | null | undefined, targetLang = getTranslationTarget()): boolean => {
  if (!text?.trim() || !targetLang) return false
  if (targetLang == 'en') return !isEnglishText(text)
  if (targetLang.startsWith('zh')) return LETTER_RXP.test(text) && (!HAN_RXP.test(text) || KANA_HANGUL_RXP.test(text))
  // the other languages: names with letters of another script
  return LETTER_RXP.test(text.replace(SCRIPTS[targetLang] ?? SCRIPTS.latin, ''))
}

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
const translateGoogle = async(text: string, targetLang: string): Promise<string | null> => {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&dj=1&source=input&q=${encodeURIComponent(text)}`
  const { body, statusCode } = await (httpFetch(url, { headers: { 'User-Agent': userAgent } }) as any).promise
  if (statusCode !== 200) throw new Error(`google translate ${statusCode as number}`)
  // dj=1 returns { sentences: [{ trans }] }
  const sentences: Array<{ trans?: string }> | undefined = body?.sentences
  if (sentences?.length) return sentences.map(s => s.trans ?? '').join('') || null
  if (Array.isArray(body?.[0])) return (body[0] as Array<[string]>).map(s => s[0]).join('') || null
  return null
}

const translateBing = async(text: string, targetLang: string): Promise<string | null> => {
  const url = `https://edge.microsoft.com/translate/translatetext?isEnterpriseClient=false&to=${targetLang}`
  const { body, statusCode } = await (httpFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': userAgent },
    body: JSON.stringify([text]),
  }) as any).promise
  if (statusCode !== 200) throw new Error(`bing translate ${statusCode as number}`)
  return body?.[0]?.translations?.[0]?.text ?? null
}

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

/**
 * Synchronous cache lookup, lets already translated text render without an async round trip
 */
export const getCachedTranslation = (text: string, targetLang = getTranslationTarget() ?? 'en'): string | null => {
  return memoryCache.get(`${targetLang}::${text}`) ?? null
}

// the app in Chinese: Bing first (Google is blocked in mainland China, its requests would only be waited for)
const getTranslators = () => getTranslationTarget()?.startsWith('zh')
  ? [{ name: 'bing', translate: translateBing }, { name: 'google', translate: translateGoogle }]
  : [{ name: 'google', translate: translateGoogle }, { name: 'bing', translate: translateBing }]

const fetchTranslation = async(text: string, targetLang: string, cacheKey: string): Promise<string | null> => {
  let result: string | null = null
  for (const translator of getTranslators()) {
    try {
      result = await translator.translate(text, targetLang)
    } catch (e) {
      console.log(`${translator.name} translate error`, e)
    }
    if (result) break
  }
  if (result) {
    memoryCache.set(cacheKey, result)
    if (memoryCache.size > MAX_CACHE_SIZE) {
      const first = memoryCache.keys().next().value
      if (first) memoryCache.delete(first)
    }
    scheduleSaveCache()
    missTimes.delete(cacheKey)
  } else missTimes.set(cacheKey, Date.now())
  return result
}

export const translateText = async(text: string, targetLang = getTranslationTarget() ?? 'en'): Promise<string | null> => {
  if (!needsTranslation(text, targetLang)) return null
  const cacheKey = `${targetLang}::${text}`
  const cached = memoryCache.get(cacheKey)
  if (cached != null) return cached

  // the same text is often requested by many rows at once (e.g. an artist name)
  const pending = pendingRequests.get(cacheKey)
  if (pending) return pending
  const missTime = missTimes.get(cacheKey)
  if (missTime && Date.now() - missTime < MISS_RETRY_TIME) return null

  const request = acquireSlot().then(async() => fetchTranslation(text, targetLang, cacheKey)).finally(() => {
    releaseSlot()
    pendingRequests.delete(cacheKey)
  })
  pendingRequests.set(cacheKey, request)
  return request
}

const CJK_RXP = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/

/**
 * Term that is sent to the search of the platforms: with the search switch on, a term that is not
 * chinese / japanese / korean already is translated to Chinese first (the platforms index
 * most songs under their Chinese names)
 */
export const getSearchText = async(text: string): Promise<string> => {
  const trimmed = text.trim()
  if (!trimmed || !settingState.setting['search.isAutoTranslateSearch'] || CJK_RXP.test(trimmed)) return text
  const translated = await translateText(trimmed, 'zh-CN').catch(() => null)
  return translated ?? text
}
