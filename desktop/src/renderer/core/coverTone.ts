import { ref, computed, watch } from '@common/utils/vueTools'
import { displayPic } from '@renderer/core/displayPic'
import { appSetting } from '@renderer/store/setting'
import { themeInfo, themeShouldUseDarkColors } from '@renderer/store'
import { findTheme, getThemes } from '@renderer/store/utils'

// The dynamic background of the player (playDetail.isDynamicBackground) keeps the theme: the color of the theme over
// the cover, as much of it as the cover needs. A light cover in a dark theme gets more of the dark color, a dark cover
// in a light theme more of the light one. The light parts of a cover still come out grey in a dark theme (the dark
// parts in a light one): the text and the buttons then get lighter (darker) so they keep their contrast over them
// (mobile: core/coverTone.ts)

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
const SAMPLE_SIZE = 24

const toLinear = (channel: number) => {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * How much of the color of the theme goes over a cover of this lightness (0 - 1)
 * @param themeLightness the lightness of the background color of the theme
 */
export const getCoverOverlay = (lightness: number, isDark: boolean, themeLightness: number) => {
  const target = isDark ? themeLightness + BG_RANGE : themeLightness - BG_RANGE
  const overlay = (lightness - target) / (lightness - themeLightness)
  return Number.isFinite(overlay) && overlay > 0 ? clamp(overlay, MIN_OVERLAY, MAX_OVERLAY) : MIN_OVERLAY
}

/**
 * How far the text and the buttons go toward white (a dark theme) or black (a light one), 0 - MAX_FG_MIX
 * @param cover the lightness of the cover: its average, its light parts, its dark parts
 */
export const getForegroundMix = (cover: CoverLightness, isDark: boolean, themeLightness: number) => {
  const overlay = getCoverOverlay(cover.mean, isDark, themeLightness)
  // (the blurred cover under the color of the theme): its lightest parts in a dark theme, its darkest in a light one
  const extreme = (1 - overlay) * (isDark ? cover.light : cover.dark) + overlay * themeLightness
  const distance = isDark ? extreme - themeLightness : themeLightness - extreme
  return MAX_FG_MIX * clamp((distance - FG_FROM) / (FG_FULL - FG_FROM), 0, 1)
}

// the lightness (L*, 0 - 1) of a css color: rgb() / rgba()
const colorLightness = (color: string | undefined, fallback: number) => {
  const match = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(color ?? '')
  if (!match) return fallback
  const y = 0.2126 * toLinear(Number(match[1])) + 0.7152 * toLinear(Number(match[2])) + 0.0722 * toLinear(Number(match[3]))
  return (116 * Math.cbrt(y) - 16) / 100
}

export interface CoverLightness {
  mean: number
  /** the light parts (90th percentile) */
  light: number
  /** the dark parts (10th percentile) */
  dark: number
}
const lightnessCache = new Map<string, CoverLightness | null>()
// the lightness of the cover (L*, 0 - 1)
const measure = async(url: string): Promise<CoverLightness | null> => new Promise(resolve => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = SAMPLE_SIZE
      canvas.height = SAMPLE_SIZE
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
      const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE)
      const values: number[] = []
      let sum = 0
      for (let i = 0; i < data.length; i += 4) {
        const y = 0.2126 * toLinear(data[i]) + 0.7152 * toLinear(data[i + 1]) + 0.0722 * toLinear(data[i + 2])
        sum += y
        values.push((116 * Math.cbrt(y) - 16) / 100)
      }
      values.sort((a, b) => a - b)
      resolve({
        mean: (116 * Math.cbrt(sum / values.length) - 16) / 100,
        light: values[Math.floor(values.length * 0.9)],
        dark: values[Math.floor(values.length * 0.1)],
      })
    } catch (err) {
      console.log(err)
      resolve(null)
    }
  }
  img.onerror = () => {
    resolve(null)
  }
  img.src = url
})

const coverLightness = ref<CoverLightness | null>(null)
watch(() => appSetting['playDetail.isDynamicBackground'] ? displayPic.value : null, async pic => {
  if (!pic) {
    coverLightness.value = null
    return
  }
  let lightness = lightnessCache.get(pic)
  if (lightness === undefined) {
    lightness = await measure(pic)
    if (lightnessCache.size > 200) lightnessCache.clear()
    lightnessCache.set(pic, lightness)
  }
  if (pic == displayPic.value) coverLightness.value = lightness
}, { immediate: true })

const themeLoaded = ref(false)
getThemes(() => {
  themeLoaded.value = true
})
const activeTheme = computed(() => {
  void themeLoaded.value
  const id = appSetting['theme.id']
  const themeId = id == 'auto' ? themeShouldUseDarkColors.value ? appSetting['theme.darkId'] : appSetting['theme.lightId'] : id
  return findTheme(themeInfo, themeId) ?? null
})

// the colors of the text and the buttons (the ones made of other variables are set again too: they are resolved on
// :root, else they keep the colors of the app)
const FOREGROUND_VARS: Record<string, string> = {
  '--color-850': '--color-850',
  '--color-650': '--color-650',
  '--color-550': '--color-550',
  '--color-450': '--color-450',
  '--color-font': '--color-850',
  '--color-font-label': '--color-450',
  '--color-primary': '--color-primary',
  '--color-primary-dark-100': '--color-primary-dark-100',
  '--color-primary-font': '--color-primary',
  '--color-primary-font-hover': '--color-primary-alpha-300',
  '--color-primary-font-active': '--color-primary-dark-100-alpha-200',
  '--color-button-font': '--color-primary-alpha-100',
  '--color-button-font-selected': '--color-primary-dark-100-alpha-100',
}

/**
 * The player and the play bar: how much of the color of the theme is over the cover (--cover-overlay), the text and
 * the buttons moved away from the background when it needs it; null: the defaults
 */
export const coverStyle = computed(() => {
  const lightness = coverLightness.value
  if (lightness == null || !appSetting['playDetail.isDynamicBackground'] || !displayPic.value) return null
  const theme = activeTheme.value
  const isDark = theme?.isDark ?? themeShouldUseDarkColors.value
  const colors = (theme?.config.themeColors ?? {}) as unknown as Record<string, string>
  // (the background of the player and the play bar: --color-content-background)
  const themeLightness = colorLightness(colors['--color-primary-light-1000'], isDark ? 0.1 : 0.97)
  const style: Record<string, string> = { '--cover-overlay': getCoverOverlay(lightness.mean, isDark, themeLightness).toFixed(3) }
  const mix = getForegroundMix(lightness, isDark, themeLightness)
  if (!theme || mix < 0.02) return style
  const target = isDark ? 'white' : 'black'
  const keep = Math.round((1 - mix) * 100)
  // the icons drawn see-through (volume, play mode...): less so
  style['--secondary-icon-opacity'] = (0.5 + 0.45 * mix / MAX_FG_MIX).toFixed(2)
  for (const [name, source] of Object.entries(FOREGROUND_VARS)) {
    const color = colors[source]
    if (color) style[name] = `color-mix(in srgb, ${color} ${keep}%, ${target})`
  }
  return style
})
