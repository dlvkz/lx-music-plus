import { useEffect, useMemo, useState } from 'react'
import { getImageLightness } from '@/utils/nativeModules/utils'
import { useTheme } from '@/store/theme/hook'

// The dynamic background of the player (playDetail.isDynamicBg) keeps the theme: the color of the theme over the
// cover, as much of it as the cover needs. A light cover in a dark theme gets more of the dark color, a dark cover in
// a light theme more of the light one. The light parts of a cover still come out grey in a dark theme (the dark parts
// in a light one): the text and the buttons then get lighter (darker) so they keep their contrast over them
// (desktop: core/coverTone.ts)

// how far (L*, 0 - 1) the background may be from the background color of the theme (lighter in a dark theme, darker in
// a light one)
const BG_RANGE = 0.08
// how much of the color of the theme is over the cover
const MIN_OVERLAY = 0.6
const MAX_OVERLAY = 0.9
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getCoverOverlay = (lightness: number, isDark: boolean, themeLightness: number) => {
  const target = isDark ? themeLightness + BG_RANGE : themeLightness - BG_RANGE
  const overlay = (lightness - target) / (lightness - themeLightness)
  return Number.isFinite(overlay) && overlay > 0 ? clamp(overlay, MIN_OVERLAY, MAX_OVERLAY) : MIN_OVERLAY
}

const getForegroundMix = (cover: CoverLightness, isDark: boolean, themeLightness: number) => {
  const overlay = getCoverOverlay(cover.mean, isDark, themeLightness)
  // (the blurred cover under the color of the theme): its lightest parts in a dark theme, its darkest in a light one
  const extreme = (1 - overlay) * (isDark ? cover.light : cover.dark) + overlay * themeLightness
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
 * How much of the color of the theme goes over the cover (0 - 1)
 * @param pic the cover shown, null: none
 * @param defaultOverlay used until the cover is measured
 */
export const useCoverOverlay = (pic: string | null, defaultOverlay: number) => {
  const theme = useTheme()
  const lightness = useCoverLightness(pic)
  return lightness == null ? defaultOverlay : getCoverOverlay(lightness.mean, theme.isDark, getThemeLightness(theme))
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
    return result as unknown as LX.ActiveTheme
  }, [pic, lightness, theme])
}
