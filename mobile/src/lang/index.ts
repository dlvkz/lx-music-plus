import zh_cn from './zh-cn.json'
import zh_tw from './zh-tw.json'
import en_us from './en-us.json'
import ja_jp from './ja-jp.json'
import ko_kr from './ko-kr.json'
import es_es from './es-es.json'
import pt_br from './pt-br.json'
import ru_ru from './ru-ru.json'
import vi_vn from './vi-vn.json'
import de_de from './de-de.json'
import fr_fr from './fr-fr.json'
import it_it from './it-it.json'
import pl_pl from './pl-pl.json'

type Message = Record<keyof typeof zh_cn, string>
| Record<keyof typeof zh_tw, string>
| Record<keyof typeof en_us, string>
| Record<keyof typeof ja_jp, string>
| Record<keyof typeof ko_kr, string>
| Record<keyof typeof es_es, string>
| Record<keyof typeof pt_br, string>
| Record<keyof typeof ru_ru, string>
| Record<keyof typeof vi_vn, string>
| Record<keyof typeof de_de, string>
| Record<keyof typeof fr_fr, string>
| Record<keyof typeof it_it, string>
| Record<keyof typeof pl_pl, string>


const langs = [
  {
    name: 'English',
    locale: 'en_us',
    country: 'us',
    message: en_us,
  },
  {
    name: '简体中文',
    locale: 'zh_cn',
    country: 'cn',
    fallback: true,
    message: zh_cn,
  },
  {
    name: '繁體中文',
    locale: 'zh_tw',
    country: 'cn',
    message: zh_tw,
  },
  {
    name: '日本語',
    locale: 'ja_jp',
    country: 'jp',
    message: ja_jp,
  },
  {
    name: '한국어',
    locale: 'ko_kr',
    country: 'kr',
    message: ko_kr,
  },
  {
    name: 'Español',
    locale: 'es_es',
    country: 'es',
    message: es_es,
  },
  {
    name: 'Português (Brasil)',
    locale: 'pt_br',
    country: 'br',
    message: pt_br,
  },
  {
    name: 'Русский',
    locale: 'ru_ru',
    country: 'ru',
    message: ru_ru,
  },
  {
    name: 'Tiếng Việt',
    locale: 'vi_vn',
    country: 'vn',
    message: vi_vn,
  },
  {
    name: 'Deutsch',
    locale: 'de_de',
    country: 'de',
    message: de_de,
  },
  {
    name: 'Français',
    locale: 'fr_fr',
    country: 'fr',
    message: fr_fr,
  },
  {
    name: 'Italiano',
    locale: 'it_it',
    country: 'it',
    message: it_it,
  },
  {
    name: 'Polski',
    locale: 'pl_pl',
    country: 'pl',
    message: pl_pl,
  },
] as const

const langList: Array<{
  name: string
  locale: (typeof langs)[number]['locale']
  // alternate?: string
}> = []
type Messages = Record<(typeof langs)[number]['locale'], Message>

// @ts-expect-error
const messages: Messages = {}

langs.forEach(item => {
  langList.push({
    name: item.name,
    locale: item.locale,
    // alternate: item.alternate,
  })
  messages[item.locale] = item.message
})

export {
  langList,
  messages,
}

export type {
  Messages,
  Message,
}

export * from './i18n'
