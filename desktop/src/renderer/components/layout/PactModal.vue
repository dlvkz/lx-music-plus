<template>
  <material-modal :show="!isAgreePact || isShowPact" max-width="70%" :bg-close="isAgreePact" :close-btn="isAgreePact" @close="handleClose(false)">
    <!-- first run: the language first, the agreement (and what follows) is then in that language -->
    <main v-if="!isAgreePact && !isLanguagePicked" :class="$style.main">
      <h2>Language / 语言</h2>
      <div :class="$style.langs">
        <base-btn v-for="lang in langList" :key="lang.locale" :class="$style.lang" @click="pickLanguage(lang.locale)">{{ lang.name }}</base-btn>
      </div>
    </main>
    <main v-else :class="$style.main">
      <h2>{{ pact.title }}</h2>
      <div class="select scroll" :class="$style.content">
        <template v-if="!isAgreePact"><p><strong>{{ pact.mustAgree }}</strong></p><br></template>
        <template v-for="(paragraph, index) in pact.paragraphs" :key="index">
          <p>
            <strong v-if="paragraph.heading">{{ paragraph.parts[0] }}</strong>
            <template v-else>
              <template v-for="(part, partIndex) in paragraph.parts" :key="partIndex">
                <template v-if="typeof part == 'string'">{{ part }}</template>
                <strong v-else-if="part.bold">{{ part.bold }}</strong>
                <strong v-else class="hover underline" @click="openLink(part.link)">{{ part.text }}</strong>
              </template>
            </template>
          </p><br>
        </template>
        <p v-if="!isAgreePact"><strong>{{ pact.acceptTip }}</strong></p>
      </div>
      <div v-if="!isAgreePact" :class="$style.btns">
        <base-btn :class="$style.btn" @click="handleClose(true)">{{ $t('not_agree') }}</base-btn>
        <base-btn :class="$style.btn" @click="handleAgree">{{ $t('agree') }}</base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script>
import { checkUpdate, quitApp } from '@renderer/utils/ipc'
import { REPO } from '@common/repo'
import { openUrl } from '@common/utils/electron'
import { isShowPact } from '@renderer/store'
import { appSetting, saveAgreePact, updateSetting } from '@renderer/store/setting'
import { computed, ref } from '@common/utils/vueTools'
import { langList } from '@root/lang'
import { getPactText } from '@renderer/utils/pactText'

// The licence agreement (utils/pactText.ts): on first run, after the language is picked
export default {
  setup() {
    const isAgreePact = computed(() => appSetting['common.isAgreePact'])
    const isLanguagePicked = ref(false)
    const pact = computed(() => getPactText(String(appSetting['common.langId'] ?? window.i18n.locale ?? ''), { platform: 'desktop', license: 'agpl' }))

    const pickLanguage = locale => {
      updateSetting({ 'common.langId': locale })
      isLanguagePicked.value = true
    }
    const openLink = link => {
      void openUrl(link == 'license' ? `${REPO}/blob/main/LICENSE` : `${REPO}#readme`)
    }
    const handleAgree = () => {
      saveAgreePact(true)
      checkUpdate()
    }
    const handleClose = isExit => {
      if (isExit) {
        quitApp(true)
        return
      }
      isShowPact.value = false
    }

    return {
      isShowPact,
      isAgreePact,
      isLanguagePicked,
      langList,
      pact,
      pickLanguage,
      openLink,
      handleAgree,
      handleClose,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px 8px 12px;
  min-width: 200px;
  min-height: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  h2 {
    font-size: 16px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
  }
}

// two columns: the 13 languages fit the window
.langs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 20px auto 5px;
  width: 380px;
}
.lang {
  display: block;
  width: 100%;
  margin: 0;
}

.content {
  flex: auto;
  margin: 15px 0;
  padding: 0 7px;
  h3 {
    font-weight: bold;
    line-height: 2;
  }
  p {
    line-height: 1.5;
    font-size: 14px;
    text-align: justify;
  }
}

.btns {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.btn {
  display: block;
  width: 48%;
  &:last-child {
    margin-bottom: 0;
  }
}


</style>
