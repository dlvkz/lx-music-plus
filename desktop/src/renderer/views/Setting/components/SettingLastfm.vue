<template lang="pug">
dt#lastfm {{ $t('setting__lastfm') }}
dd
  h3 {{ $t('setting__lastfm_api') }}
  div
    .p.small {{ $t('setting__lastfm_api_tip') }}
      |
      span.hover.underline(@click="openUrl(LASTFM_CREATE_KEY_URL)") {{ LASTFM_CREATE_KEY_URL }}
    .gap-top
      base-input(:class="$style.input" :model-value="appSetting['lastfm.apiKey']" :placeholder="$t('setting__lastfm_api_key')" @update:model-value="setKey('lastfm.apiKey', $event)")
    .gap-top
      base-input(:class="$style.input" type="password" :model-value="appSetting['lastfm.apiSecret']" :placeholder="$t('setting__lastfm_api_secret')" @update:model-value="setKey('lastfm.apiSecret', $event)")
dd
  h3 {{ $t('setting__lastfm_account') }}
  div
    .p.small(v-if="appSetting['lastfm.sessionKey']") {{ $t('setting__lastfm_connected', { name: appSetting['lastfm.userName'] }) }}
    .p.small(v-else) {{ $t('setting__lastfm_account_tip') }}
    .p.small(v-if="message" :class="$style.message") {{ message }}
    .gap-top
      base-btn.btn(v-if="appSetting['lastfm.sessionKey']" min @click="disconnect") {{ $t('setting__lastfm_disconnect') }}
      template(v-else)
        base-btn.btn(min :disabled="!canConnect || !!token" @click="connect") {{ $t('setting__lastfm_connect') }}
        base-btn.btn.gap-left(v-if="token" min @click="finishConnect") {{ $t('setting__lastfm_connect_done') }}
    .gap-top
      base-checkbox(id="setting_lastfm_scrobble" :disabled="!appSetting['lastfm.sessionKey']" :model-value="appSetting['lastfm.scrobble']" :label="$t('setting__lastfm_scrobble')" @update:model-value="updateSetting({'lastfm.scrobble': $event})")
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { openUrl } from '@common/utils/electron'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { LASTFM_CREATE_KEY_URL, getLastfmAuthUrl, getLastfmSession, getLastfmToken } from '@renderer/utils/lastfm'

// Last.fm (utils/lastfm.ts): the key of the API account of the user for the recommendations, its account
// connected for the scrobbles (a token approved on the page of Last.fm, then its session)
export default {
  name: 'SettingLastfm',
  setup() {
    const token = ref('')
    const message = ref('')
    // the key of the user, else the default one (of LX Music+)
    const canConnect = computed(() => true)

    const setKey = (key, value) => {
      if (appSetting[key] == value.trim()) return
      // another key: the session of the other one is not valid
      updateSetting({ [key]: value.trim(), 'lastfm.sessionKey': '', 'lastfm.userName': '' })
      token.value = ''
    }
    const connect = async() => {
      message.value = ''
      try {
        token.value = await getLastfmToken()
        void openUrl(getLastfmAuthUrl(token.value))
        message.value = window.i18n.t('setting__lastfm_connect_wait')
      } catch (err) {
        message.value = err.message
      }
    }
    const finishConnect = async() => {
      try {
        const session = await getLastfmSession(token.value)
        updateSetting({ 'lastfm.sessionKey': session.key, 'lastfm.userName': session.name })
        message.value = ''
      } catch (err) {
        message.value = err.message
      }
      token.value = ''
    }
    const disconnect = () => {
      updateSetting({ 'lastfm.sessionKey': '', 'lastfm.userName': '' })
    }

    return {
      appSetting,
      updateSetting,
      openUrl,
      LASTFM_CREATE_KEY_URL,
      token,
      message,
      canConnect,
      setKey,
      connect,
      finishConnect,
      disconnect,
    }
  },
}
</script>

<style lang="less" module>
.input {
  width: 320px;
}
.message {
  color: var(--color-primary-font);
}
</style>
