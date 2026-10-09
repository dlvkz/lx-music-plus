import { Text, TextInput } from 'react-native'
import settingState from '@/store/setting/state'

// Font of the app. The default is the bundled Resource Han Rounded (SIL Open Font License):
// a rounded face for latin, chinese and japanese text, with the hangul of its KR version merged in
// (android/app/src/main/assets/fonts/ResourceHanRounded*.ttf).

export const ROUNDED_FONT = 'ResourceHanRounded'

/**
 * Fonts offered in the settings, an empty family is the font of the system
 */
export const FONT_FAMILIES = [
  { id: 'rounded', family: ROUNDED_FONT },
  { id: 'system', family: '' },
  { id: 'light', family: 'sans-serif-light' },
  { id: 'condensed', family: 'sans-serif-condensed' },
  { id: 'serif', family: 'serif' },
  { id: 'monospace', family: 'monospace' },
  { id: 'casual', family: 'casual' },
  { id: 'cursive', family: 'cursive' },
] as const

const getFontFamily = () => settingState.setting['common.fontFamily']

interface RenderComponent {
  render?: (props: Record<string, unknown>, ref: unknown) => React.ReactNode
}

// Every text of the app goes through the render function of these two components,
// the font is put in front of the style of the text so a text can still pick its own (the icons do).
const applyFont = (Component: RenderComponent) => {
  const render = Component.render
  if (!render) return
  Component.render = function(props, ref) {
    const fontFamily = getFontFamily()
    if (!fontFamily) return render.call(this, props, ref)
    return render.call(this, { ...props, style: [{ fontFamily }, props.style] }, ref)
  }
}

applyFont(Text as unknown as RenderComponent)
applyFont(TextInput as unknown as RenderComponent)
