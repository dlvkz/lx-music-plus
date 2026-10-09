import { createI18n } from '@/lang/i18n'
import type { I18n } from '@/lang/i18n'
import { getDeviceLanguage } from '@/utils/tools'
import { setLanguage, updateSetting } from '@/core/common'


export default async(setting: LX.AppSetting) => {
  let lang = setting['common.langId']

  global.i18n = createI18n()

  if (!lang || !global.i18n.availableLocales.includes(lang)) {
    const deviceLanguage = String(await getDeviceLanguage()).toLowerCase().replace('-', '_')
    if (global.i18n.availableLocales.includes(deviceLanguage as I18n['locale'])) {
      lang = deviceLanguage as I18n['locale']
    } else if (/^zh_(tw|hk|mo|hant)/.test(deviceLanguage)) {
      lang = 'zh_tw'
    } else {
      // the same language in another country (de_at, pt_pt, es_mx...)
      const prefix = deviceLanguage.split('_')[0]
      lang = global.i18n.availableLocales.find(locale => locale.split('_')[0] == prefix) ?? 'en_us'
    }
    updateSetting({ 'common.langId': lang })
  }
  setLanguage(lang)
}
