import { useEffect, useMemo, useState } from 'react'
import { getImageLightness } from '@/utils/nativeModules/utils'
import { useTheme } from '@/store/theme/hook'

// The dynamic background of the player (playDetail.isDynamicBg) is the cover, its colors kept, made to fit the theme.
// In a dark theme the cover is darkened (all its colors in the same measure, so they stay what they are) until its
// light parts and its average are dark enough, a little of the color of the theme over it: never a bright background
// in a dark theme. In a light theme the color of the theme goes over it, enough to bring its dark parts up some way: a
// dark cover stays colorful there, darker than the theme. The text and the buttons move away from the background when
// it comes near them: lighter in a dark theme, darker in a light one (desktop: core/coverTone.ts)

// a dark theme: how light the light parts of the background (90th percentile) and its average may be (L*, 0 - 1)
const DARK_MAX_LIGHT = 0.42
const DARK_MAX_MEAN = 0.28
// how much of the color of the theme is over the darkened cover
const DARK_TINT = 0.15
// how dark the cover is made at most (its brightness, 0 - 1)
const MIN_BRIGHTNESS = 0.2
// a light theme: how far the color of the theme brings the dark parts (10th percentile) up, how much of it is over
// the cover
const LIGHT_MIN_DARK = 0.5
const LIGHT_MIN_TINT = 0.3
const LIGHT_MAX_TINT = 0.55
// how far the lightest parts of the background (the darkest in a light theme) are from the color of the theme when the
// text and the buttons start to move away from them, when they are as far as they go
const FG_FROM = 0.03
const FG_FULL = 0.15
// how far toward white (black) they go at most
const MAX_FG_MIX = 0.9

interface CoverLightness {
  mean: number
  /** the light parts (90th percentile) */
  light: number
  /** the dark parts (10th percentile) */
  dark: number
}

/**
 * The background made of a cover: over the cover an overlay of the color of the theme (darkened in a dark theme)
 */
interface CoverTone {
  /** how solid the overlay is (0 - 1) */
  overlay: number
  /** how much of its color is the color of the theme, the rest black (0 - 1) */
  tint: number
  /** in the background: how much of the cover, how much of the color of the theme */
  coverShare: number
  themeShare: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getCoverTone = (cover: CoverLightness, isDark: boolean, themeLightness: number): CoverTone => {
  if (isDark) {
    const theme = DARK_TINT * themeLightness
    // (a black cover: Infinity, kept as it is)
    const brightness = clamp(Math.min(
      (DARK_MAX_LIGHT - theme) / ((1 - DARK_TINT) * cover.light),
      (DARK_MAX_MEAN - theme) / ((1 - DARK_TINT) * cover.mean),
    ), MIN_BRIGHTNESS, 1)
    const coverShare = (1 - DARK_TINT) * brightness
    const overlay = 1 - coverShare
    return { overlay, tint: DARK_TINT / overlay, coverShare, themeShare: DARK_TINT }
  }
  const range = themeLightness - cover.dark
  const overlay = range > 0.01 ? clamp((LIGHT_MIN_DARK - cover.dark) / range, LIGHT_MIN_TINT, LIGHT_MAX_TINT) : LIGHT_MIN_TINT
  return { overlay, tint: 1, coverShare: 1 - overlay, themeShare: overlay }
}

const getForegroundMix = (cover: CoverLightness, isDark: boolean, themeLightness: number) => {
  const tone = getCoverTone(cover, isDark, themeLightness)
  // (in the background): the lightest parts of the cover in a dark theme, its darkest in a light one
  const extreme = tone.coverShare * (isDark ? cover.light : cover.dark) + tone.themeShare * themeLightness
  const distance = isDark ? extreme - themeLightness : themeLightness - extreme
  return MAX_FG_MIX * clamp((distance - FG_FROM) / (FG_FULL - FG_FROM), 0, 1)
}

const COLOR_RXP = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/
const toLinear = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
// the lightness (L*, 0 - 1) of a color: rgb() / rgba()
const colorLightness = (color: unknown, fallback: number) => {
  const match = typeof color == 'string' ? COLOR_RXP.exec(color) : null
  if (!match) return fallback
  const y = 0.2126 * toLinear(Number(match[1])) + 0.7152 * toLinear(Number(match[2])) + 0.0722 * toLinear(Number(match[3]))
  return (116 * Math.cbrt(y) - 16) / 100
}
// a color made darker (its see-through part kept)
const darkenColor = (color: unknown, amount: number) => {
  const match = typeof color == 'string' ? COLOR_RXP.exec(color) : null
  if (!match) return color
  const [r, g, b] = [1, 2, 3].map(i => Math.round(Number(match[i]) * (1 - amount)))
  return match[4] == null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${match[4]})`
}
// a color moved toward white / black
const mixColor = (color: unknown, target: number, amount: number) => {
  const match = typeof color == 'string' ? COLOR_RXP.exec(color) : null
  if (!match) return color
  const [r, g, b] = [1, 2, 3].map(i => Math.round(Number(match[i]) + (target - Number(match[i])) * amount))
  // (a see-through color gets more solid too)
  const alpha = match[4] == null ? 1 : Number(match[4]) + (1 - Number(match[4])) * amount
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}
// the colors of the text and the buttons
const FOREGROUND_KEYS = [
  'c-font', 'c-font-label', 'c-primary', 'c-primary-dark-100', 'c-primary-font', 'c-primary-font-hover', 'c-primary-font-active',
  'c-button-font', 'c-button-font-selected', 'c-850', 'c-650', 'c-550', 'c-450',
] as const
// the dimmer text (the lyric lines not sung, labels): moved less, so it stays dimmer than the text
const SECONDARY_KEYS = ['c-400', 'c-350', 'c-300', 'c-250', 'c-primary-alpha-200'] as const
const SECONDARY_MIX = 0.7

const lightnessCache = new Map<string, CoverLightness | null>()
const getLightness = async(url: string): Promise<CoverLightness | null> => {
  if (lightnessCache.has(url)) return lightnessCache.get(url)!
  const lightness = await getImageLightness(url).catch((err: unknown) => {
    console.log(err)
    return null
  })
  if (lightnessCache.size > 200) lightnessCache.clear()
  lightnessCache.set(url, lightness)
  return lightness
}

const useCoverLightness = (pic: string | null) => {
  const [lightness, setLightness] = useState<CoverLightness | null>(() => pic ? lightnessCache.get(pic) ?? null : null)
  useEffect(() => {
    if (!pic) {
      setLightness(null)
      return
    }
    if (lightnessCache.has(pic)) {
      setLightness(lightnessCache.get(pic)!)
      return
    }
    let isActive = true
    // (the lightness of the cover before is kept until this one is measured)
    void getLightness(pic).then(lightness => {
      if (isActive) setLightness(lightness)
    })
    return () => {
      isActive = false
    }
  }, [pic])
  return lightness
}

const getThemeLightness = (theme: LX.ActiveTheme) => colorLightness(theme['c-content-background'], theme.isDark ? 0.1 : 0.97)

/**
 * The overlay over the cover: its color (the color of the theme, darkened in a dark theme) and how solid it is (0 - 1)
 * @param pic the cover shown, null: none
 * @param defaultOverlay used until the cover is measured
 */
export const useCoverOverlay = (pic: string | null, defaultOverlay: number) => {
  const theme = useTheme()
  const lightness = useCoverLightness(pic)
  return useMemo(() => {
    const color = theme['c-content-background']
    if (lightness == null) return { color, opacity: defaultOverlay }
    const tone = getCoverTone(lightness, theme.isDark, getThemeLightness(theme))
    return { color: darkenColor(color, 1 - tone.tint) as string, opacity: tone.overlay }
  }, [lightness, theme, defaultOverlay])
}

/**
 * The theme of the player and the play bar over the cover: the text and the buttons moved away from the background
 * when it needs it (lighter in a dark theme, darker in a light one)
 * @param pic the cover shown, null: none
 */
export const useCoverTheme = (pic: string | null) => {
  const theme = useTheme()
  const lightness = useCoverLightness(pic)
  return useMemo(() => {
    if (!pic || !lightness) return theme
    const mix = getForegroundMix(lightness, theme.isDark, getThemeLightness(theme))
    if (mix < 0.02) return theme
    const target = theme.isDark ? 255 : 0
    const result: Record<string, unknown> = { ...theme }
    for (const key of FOREGROUND_KEYS) {
      if (key in result) result[key] = mixColor(result[key], target, mix)
    }
    for (const key of SECONDARY_KEYS) {
      if (key in result) result[key] = mixColor(result[key], target, mix * SECONDARY_MIX)
    }
    return result as unknown as LX.ActiveTheme
  }, [pic, lightness, theme])
}
