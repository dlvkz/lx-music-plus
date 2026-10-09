import { memo, useEffect, useState } from 'react'
import { Text as RNText } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { translateText, getCachedTranslation, needsTranslation, onCacheLoaded } from '@/utils/translate'

/**
 * Translation of a name (song, artist, album, playlist...) into the language of the app (English, or Chinese for
 * the names that are not Chinese), '' when there is none
 */
export const useTranslation = (text: string | null | undefined): string => {
  const [translation, setTranslation] = useState('')
  // translated again into the new language when it changes
  const langId = useSettingValue('common.langId')

  useEffect(() => {
    if (!text || !needsTranslation(text)) {
      setTranslation('')
      return
    }
    let isCanceled = false
    const load = () => {
      // cached translations are applied at once so recycled list rows don't flash the untranslated text
      const cached = getCachedTranslation(text)
      setTranslation(cached ?? '')
      if (cached != null) return true
      void translateText(text).then(result => {
        // the row may have been reused for another text while the request was running
        if (!isCanceled && result) setTranslation(result)
      })
      return false
    }
    const off = load() ? null : onCacheLoaded(() => {
      const cached = getCachedTranslation(text)
      if (cached != null && !isCanceled) setTranslation(cached)
    })
    return () => {
      isCanceled = true
      off?.()
    }
  }, [text, langId])

  // a translation that only repeats the text adds nothing
  return translation && translation.trim().toLowerCase() != text?.trim().toLowerCase() ? translation : ''
}

/**
 * Text with its translation, to be used inside a <Text>:
 * the translation follows the original in a lighter color, replaces it with `replace`,
 * or comes first with the original after it in a lighter color with `translationFirst`
 */
export const TranslatedText = memo(({ text, replace = false, translationFirst = false }: { text: string, replace?: boolean, translationFirst?: boolean }) => {
  const theme = useTheme()
  const translation = useTranslation(text)
  if (!translation) return <>{text}</>
  if (replace) return <>{translation}</>
  if (translationFirst) {
    return (
      <>
        {translation}
        <RNText style={{ color: theme['c-font-label'], fontSize: 11, fontWeight: 'normal' }}>{'  '}{text}</RNText>
      </>
    )
  }
  return (
    <>
      {text}
      <RNText style={{ color: theme['c-font-label'], fontSize: 11 }}>{'  '}{translation}</RNText>
    </>
  )
})
