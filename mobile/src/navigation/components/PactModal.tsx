import { useMemo } from 'react'
import { View, ScrollView } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import { createStyle, openUrl } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import ModalContent from './ModalContent'
import { exitApp } from '@/utils/nativeModules/utils'
import { updateSetting } from '@/core/common'
import { checkUpdate } from '@/core/version'
import { initDeeplink } from '@/core/init/deeplink'
import settingState from '@/store/setting/state'
import { REPO } from '@/config/repo'
import { useI18n } from '@/lang'
import { getPactText } from '@/utils/pactText'

const Content = () => {
  const theme = useTheme()
  const t = useI18n()
  // t: changes with the language
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pact = useMemo(() => getPactText(String(global.i18n.locale ?? ''), { platform: 'mobile', license: 'apache' }), [t])

  const openLink = (link: 'license' | 'repo') => {
    void openUrl(link == 'license' ? 'http://www.apache.org/licenses/LICENSE-2.0' : `${REPO}#readme`)
  }

  const textLinkStyle = {
    ...styles.text,
    textDecorationLine: 'underline',
    color: theme['c-primary-font'],
  } as const

  return (
    <View style={styles.main}>
      <Text style={styles.title} size={18} >{pact.title}</Text>
      <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
        {!settingState.setting['common.isAgreePact'] && <Text selectable style={styles.bold} >{pact.mustAgree}{'\n'}</Text>}
        {
          pact.paragraphs.map((paragraph, index) => (
            <Text key={index} selectable style={paragraph.heading ? styles.bold : styles.text}>
              {
                paragraph.parts.map((part, partIndex) => {
                  if (typeof part == 'string') return part
                  if ('bold' in part) return <Text key={partIndex} style={styles.bold}>{part.bold}</Text>
                  return <Text key={partIndex} onPress={() => { openLink(part.link) }} style={textLinkStyle}>{part.text}</Text>
                })
              }
              {'\n'}
            </Text>
          ))
        }
      </ScrollView>
    </View>
  )
}

// the agreement accepted (on first run): no timer before the button
const Footer = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const t = useI18n()
  const isAgreePact = useSettingValue('common.isAgreePact')
  // t: changes with the language
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pact = useMemo(() => getPactText(String(global.i18n.locale ?? ''), { platform: 'mobile', license: 'apache' }), [t])

  const handleRejct = () => {
    exitApp()
  }

  const handleConfirm = () => {
    const _isAgreePact = isAgreePact
    if (!isAgreePact) updateSetting({ 'common.isAgreePact': true })
    void Navigation.dismissOverlay(componentId)
    if (!_isAgreePact) {
      void checkUpdate()
      void initDeeplink()
    }
  }

  return (
    <>
      {
        isAgreePact
          ? null
          : (
              <Text selectable style={styles.tip} size={13}>{pact.acceptTip}</Text>
            )
      }
      <View style={styles.btns}>
        {
          isAgreePact
            ? null
            : (
                <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleRejct}>
                  <Text color={theme['c-button-font']}>{t('pact__decline')}</Text>
                </Button>
              )
        }
        <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleConfirm}>
          <Text color={theme['c-button-font']}>{isAgreePact ? t('close') : t('pact__accept')}</Text>
        </Button>
      </View>
    </>
  )
}

const PactModal = ({ componentId }: { componentId: string }) => {
  return (
    <ModalContent>
      <Content />
      <Footer componentId={componentId} />
    </ModalContent>
  )
}

const styles = createStyle({
  main: {
    // flexGrow: 0,
    flexShrink: 1,
    marginTop: 15,
    marginBottom: 10,
  },
  content: {
    flexGrow: 0,
    marginLeft: 5,
    marginRight: 5,
    paddingLeft: 10,
    paddingRight: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: 15,
  },
  part: {
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    textAlignVertical: 'bottom',
    marginBottom: 5,
  },
  bold: {
    fontSize: 14,
    textAlignVertical: 'bottom',
    fontWeight: 'bold',
  },
  tip: {
    textAlignVertical: 'bottom',
    fontWeight: 'bold',
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 15,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingLeft: 15,
    // paddingRight: 15,
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})

export default PactModal

