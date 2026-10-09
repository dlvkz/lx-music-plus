<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  //- LX Music+: an unofficial fork of LX Music (lyswhut)
  .p.small
    | {{ $t('about__intro') }}&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl(REPO + '#readme')") {{ REPO.replace('https://', '') }}
  .p.small
    | {{ $t('about__download') }}&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl(REPO + '/releases')") GitHub Releases
  .p.small
    | {{ $t('about__issues') }}&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl(REPO + '/issues')") GitHub Issues
  br
  .p.small
    | {{ $t('about__based_on') }}&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop')") LX Music
    | &nbsp;{{ $t('about__based_on_by') }}
  .p.small {{ $t('about__not_affiliated') }}
  .p.small
    | {{ $t('about__docs') }}&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/faq')") LX Music FAQ
  br
  .p.small
    | {{ $t('about__pact') }}&nbsp;
    base-btn(min @click="handleShowPact") {{ $t('about__pact_btn') }}
</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { isShowPact } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'
import { REPO } from '@common/repo'

export default {
  name: 'SettingAbout',
  setup() {
    const handleShowPact = () => {
      isShowPact.value = true
    }
    return {
      REPO,
      openUrl,
      clipboardWriteText,
      handleShowPact,
    }
  },
}
</script>
