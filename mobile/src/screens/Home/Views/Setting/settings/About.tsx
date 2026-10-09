import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import Section from '../components/Section'
// import Button from './components/Button'

import { createStyle, openUrl } from '@/utils/tools'
// import { showPactModal } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { showPactModal } from '@/core/common'
import { REPO } from '@/config/repo'

// const qqGroupUrl = 'mqqopensdkapi://bizAgent/qm/qr?url=http%3A%2F%2Fqm.qq.com%2Fcgi-bin%2Fqm%2Fqr%3Ffrom%3Dapp%26p%3Dandroid%26jump_from%3Dwebapi%26k%3Du1zyxek8roQAwic44nOkBXtG9CfbAxFw'
// const qqGroupUrl2 = 'mqqopensdkapi://bizAgent/qm/qr?url=http%3A%2F%2Fqm.qq.com%2Fcgi-bin%2Fqm%2Fqr%3Ffrom%3Dapp%26p%3Dandroid%26jump_from%3Dwebapi%26k%3D-l4kNZ2bPQAuvfCQFFhl1UoibvF5wcrQ'
// const qqGroupWebUrl = 'https://qm.qq.com/cgi-bin/qm/qr?k=jRZkyFSZ4FmUuTHA3P_RAXbbUO_Rrn5e&jump_from=webapi'
// const qqGroupWebUrl2 = 'https://qm.qq.com/cgi-bin/qm/qr?k=HPNJEfrZpBZ9T8szYWbe2d5JrAAeOt_l&jump_from=webapi'

// LX Music+: an unofficial fork of LX Music (lyswhut)
export default memo(() => {
  const theme = useTheme()
  const t = useI18n()
  const textLinkStyle = {
    ...styles.text,
    textDecorationLine: 'underline',
    color: theme['c-primary-font'],
  } as const
  const link = (url: string, label: string) => (
    <TouchableOpacity onPress={() => { void openUrl(url) }}><Text style={textLinkStyle}>{label}</Text></TouchableOpacity>
  )

  return (
    <Section title={t('setting_about')}>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__intro')} </Text>
        {link(`${REPO}#readme`, REPO.replace('https://', ''))}
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__download')} </Text>
        {link(`${REPO}/releases`, 'GitHub Releases')}
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__issues')} </Text>
        {link(`${REPO}/issues`, 'GitHub Issues')}
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__based_on')} </Text>
        {link('https://github.com/lyswhut/lx-music-mobile', 'LX Music')}
        <Text style={styles.text}> {t('about__based_on_by')}</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__not_affiliated')}</Text>
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__docs')} </Text>
        {link('https://lyswhut.github.io/lx-music-doc/mobile/faq', 'LX Music FAQ')}
      </View>
      <View style={styles.part}>
        <Text style={styles.text}>{t('about__pact')} </Text>
        <TouchableOpacity onPress={() => { showPactModal() }}><Text style={textLinkStyle}>{t('about__pact_btn')}</Text></TouchableOpacity>
      </View>
    </Section>
  )
})

const styles = createStyle({
  part: {
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 14,
    textAlignVertical: 'bottom',
  },
  boldText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlignVertical: 'bottom',
  },
  throughText: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    textAlignVertical: 'bottom',
  },
  btn: {
    flexDirection: 'row',
  },
})
