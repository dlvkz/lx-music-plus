import { dateFormat } from '@common/utils/common'

export * from '@common/utils/renderer'
export * from '@common/utils/nodejs'
export * from '@common/utils/common'
export * from '@common/utils/tools'

/**
 * 格式化播放数量
 * @param {*} num 数字
 */
export const formatPlayCount = (num: number): string => {
  if (num > 100000000) return `${Math.trunc(num / 10000000) / 10}亿`
  if (num > 10000) return `${Math.trunc(num / 1000) / 10}万`
  return String(num)
}

const COUNT_RXP = /^([\d.]+)\s*(亿|万)?(\+?)$/
const formatCountUnit = (num: number, unit: number, label: string) => `${Math.trunc(num / unit * 10) / 10}${label}`
/**
 * Show a play count in the units of the app language.
 * The music sources give counts in 万 / 亿, other languages get K / M / B (Korean 만 / 억)
 * @param count number or an already formatted count like 1.2万
 */
export const localizeCount = (count: string | number | null | undefined): string => {
  if (count == null) return ''
  const text = String(count).trim()
  const locale: string = window.i18n.locale ?? ''
  if (locale.startsWith('zh')) return typeof count == 'number' ? formatPlayCount(count) : text
  const result = COUNT_RXP.exec(text)
  if (!result) return text
  const num = parseFloat(result[1]) * (result[2] == '亿' ? 100000000 : result[2] == '万' ? 10000 : 1)
  if (Number.isNaN(num)) return text
  let formatted: string
  if (locale.startsWith('ko')) {
    formatted = num >= 100000000 ? formatCountUnit(num, 100000000, '억') : num >= 10000 ? formatCountUnit(num, 10000, '만') : String(num)
  } else {
    formatted = num >= 1000000000
      ? formatCountUnit(num, 1000000000, 'B')
      : num >= 1000000
        ? formatCountUnit(num, 1000000, 'M')
        : num >= 1000 ? formatCountUnit(num, 1000, 'K') : String(num)
  }
  return formatted + result[3]
}


/**
 * 时间格式化
 */
export const dateFormat2 = (time: number): string => {
  let differ = Math.trunc((Date.now() - time) / 1000)
  if (differ < 60) {
    return window.i18n.t('date_format_second', { num: differ })
  } else if (differ < 3600) {
    return window.i18n.t('date_format_minute', { num: Math.trunc(differ / 60) })
  } else if (differ < 86400) {
    return window.i18n.t('date_format_hour', { num: Math.trunc(differ / 3600) })
  } else {
    return dateFormat(time)
  }
}


/**
 * 设置标题
 */
let dom_title = document.getElementsByTagName('title')[0]
export const setTitle = (title: string | null) => {
  title ||= 'LX Music'
  dom_title.innerText = title
}


// export const getProxyInfo = () => {
//   return proxy.enable && proxy.host
//     ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
//     : proxy.envProxy
//       ? `http://${proxy.envProxy.host}:${proxy.envProxy.port}`
//       : undefined
// }


export const getFontSizeWithScreen = (screenWidth: number = window.innerWidth): number => {
  return screenWidth <= 1440
    ? 16
    : screenWidth <= 1920
      ? 18
      : screenWidth <= 2560
        ? 20
        : screenWidth <= 2560 ? 20 : 22
}


export const deduplicationList = <T extends LX.Music.MusicInfo>(list: T[]): T[] => {
  const ids = new Set<string>()
  return list.filter(s => {
    if (ids.has(s.id)) return false
    ids.add(s.id)
    return true
  })
}

export const langS2T = async(str: string) => {
  return window.lx.worker.main.langS2t(Buffer.from(str).toString('base64')).then(b64 => Buffer.from(b64, 'base64').toString())
}

export const decodeName = (str: string | null = '') => {
  if (!str) return ''
  return new window.DOMParser().parseFromString(str, 'text/html').body.textContent
}
