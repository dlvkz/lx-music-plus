import { memo, useState } from 'react'
import { View } from 'react-native'

import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import InputItem from '../../components/InputItem'
import CheckBoxItem from '../../components/CheckBoxItem'
import Button from '../../components/Button'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'
import { createStyle, openUrl } from '@/utils/tools'
import { LASTFM_CREATE_KEY_URL, getLastfmAuthUrl, getLastfmSession, getLastfmToken } from '@/utils/lastfm'

// Last.fm (utils/lastfm.ts): the key of the API account of the user for the recommendations, its account
// connected for the scrobbles (a token approved on the page of Last.fm, then its session)
export default memo(() => {
  const t = useI18n()
  const theme = useTheme()
  const apiKey = useSettingValue('lastfm.apiKey')
  const apiSecret = useSettingValue('lastfm.apiSecret')
  const sessionKey = useSettingValue('lastfm.sessionKey')
  const userName = useSettingValue('lastfm.userName')
  const isScrobble = useSettingValue('lastfm.scrobble')
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')

  // another key: the session of the other one is not valid
  const setKey = (key: 'lastfm.apiKey' | 'lastfm.apiSecret') => (text: string, callback: (value: string) => void) => {
    const value = text.trim()
    callback(value)
    if (value == (key == 'lastfm.apiKey' ? apiKey : apiSecret)) return
    updateSetting({ [key]: value, 'lastfm.sessionKey': '', 'lastfm.userName': '' })
    setToken('')
  }
  const connect = async() => {
    setMessage('')
    try {
      const newToken = await getLastfmToken()
      setToken(newToken)
      void openUrl(getLastfmAuthUrl(newToken))
      setMessage(t('setting__lastfm_connect_wait'))
    } catch (err: any) {
      setMessage(String(err.message))
    }
  }
  const finishConnect = async() => {
    try {
      const session = await getLastfmSession(token)
      updateSetting({ 'lastfm.sessionKey': session.key, 'lastfm.userName': session.name })
      setMessage('')
    } catch (err: any) {
      setMessage(String(err.message))
    }
    setToken('')
  }

  return (
    <Section title={t('setting__lastfm')}>
      <SubTitle title={t('setting__lastfm_api')}>
        <Text size={13} color={theme['c-font-label']}>{t('setting__lastfm_api_tip')}</Text>
        <Text size={13} color={theme['c-primary-font']} onPress={() => { void openUrl(LASTFM_CREATE_KEY_URL) }}>{LASTFM_CREATE_KEY_URL}</Text>
        <InputItem value={apiKey} label={t('setting__lastfm_api_key')} onChanged={setKey('lastfm.apiKey')} />
        <InputItem value={apiSecret} label={t('setting__lastfm_api_secret')} secureTextEntry onChanged={setKey('lastfm.apiSecret')} />
      </SubTitle>
      <SubTitle title={t('setting__lastfm_account')}>
        <Text size={13} color={theme['c-font-label']}>
          {sessionKey ? t('setting__lastfm_connected', { name: userName }) : t('setting__lastfm_account_tip')}
        </Text>
        {message ? <Text size={13} color={theme['c-primary-font']}>{message}</Text> : null}
        <View style={styles.buttons}>
          {
            sessionKey
              ? <Button onPress={() => { updateSetting({ 'lastfm.sessionKey': '', 'lastfm.userName': '' }) }}>{t('setting__lastfm_disconnect')}</Button>
              : (
                  <>
                    <Button disabled={!!token} onPress={() => { void connect() }}>{t('setting__lastfm_connect')}</Button>
                    {token ? <Button onPress={() => { void finishConnect() }}>{t('setting__lastfm_connect_done')}</Button> : null}
                  </>
                )
          }
        </View>
        <CheckBoxItem check={isScrobble} disabled={!sessionKey} onChange={check => { updateSetting({ 'lastfm.scrobble': check }) }} label={t('setting__lastfm_scrobble')} />
      </SubTitle>
    </Section>
  )
})

const styles = createStyle({
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 6,
  },
})
