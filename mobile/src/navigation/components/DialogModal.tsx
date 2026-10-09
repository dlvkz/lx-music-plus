import { useEffect, useRef } from 'react'
import { View, ScrollView, TouchableOpacity, BackHandler } from 'react-native'
import { Navigation } from 'react-native-navigation'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'

// Dialog in the colors of the app theme, shown as an overlay.
// It replaces the system alert for confirm / tip / permission dialogs and the language picker.

export interface DialogButton<T = any> {
  text: string
  value: T
  /**
   * highlighted with the theme color
   */
  primary?: boolean
}

export interface DialogProps<T = any> {
  title?: string
  message?: string
  buttons: Array<DialogButton<T>>
  /**
   * buttons as a list of full width options instead of a row
   */
  vertical?: boolean
  /**
   * close when the back button is pressed or the outside is touched
   */
  bgClose?: boolean
  onClose: (value: T | null) => void
}

export default ({ componentId, title, message, buttons, vertical = false, bgClose = true, onClose }: DialogProps & { componentId: string }) => {
  const theme = useTheme()
  const isClosedRef = useRef(false)
  // a long list of options (the languages) in two columns, so it fits the screen
  const isGrid = vertical && buttons.length > 6

  const close = (value: unknown) => {
    if (isClosedRef.current) return
    isClosedRef.current = true
    void Navigation.dismissOverlay(componentId)
    onClose(value)
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (bgClose) close(null)
      return true
    })
    return () => {
      subscription.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.mask}>
      <TouchableOpacity style={styles.maskBtn} activeOpacity={1} onPress={() => { if (bgClose) close(null) }} />
      <View style={{ ...styles.dialog, backgroundColor: theme['c-content-background'] }}>
        <View style={{ ...styles.header, backgroundColor: theme['c-primary-light-100-alpha-100'] }} />
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          { title ? <Text size={17} style={styles.title}>{title}</Text> : null }
          { message ? <Text size={14} color={theme['c-font-label']} style={styles.message} selectable>{message}</Text> : null }
        </ScrollView>
        <ScrollView style={styles.btnsScroll} contentContainerStyle={vertical ? isGrid ? styles.btnsGrid : styles.btnsVertical : styles.btns}>
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index} activeOpacity={0.7} onPress={() => { close(button.value) }}
              style={{
                ...(vertical ? isGrid ? styles.btnGrid : styles.btnVertical : styles.btn),
                backgroundColor: button.primary ? theme['c-primary-background-active'] : theme['c-button-background'],
              }}
            >
              <Text size={14} color={button.primary ? theme['c-primary-font-active'] : theme['c-button-font']} numberOfLines={vertical && !isGrid ? 1 : 2} style={styles.btnText}>{button.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = createStyle({
  mask: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(50, 50, 50, 0.3)',
  },
  maskBtn: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  dialog: {
    width: '84%',
    maxWidth: 420,
    maxHeight: '78%',
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 4,
  },
  header: {
    height: 0,
  },
  body: {
    flexGrow: 0,
    flexShrink: 1,
  },
  bodyContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 6,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  message: {
    lineHeight: 21,
  },
  btns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  btn: {
    minWidth: 72,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  btnsVertical: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  btnVertical: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 24,
    alignItems: 'center',
  },
  btnsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  btnGrid: {
    width: '48.5%',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    textAlign: 'center',
  },
})
