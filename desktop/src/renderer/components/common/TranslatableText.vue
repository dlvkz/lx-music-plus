<template>
  <span :class="[$style.container, compact ? $style.compact : $style.stacked, { 'select': selectable }]">
    <template v-if="translation && replace">
      <span :class="$style.original">{{ translation }}</span>
    </template>
    <template v-else-if="swap && translation">
      <span :class="$style.original">{{ translation }}</span>
      <span :class="$style.translation"><slot>{{ text }}</slot></span>
    </template>
    <template v-else>
      <span :class="$style.original"><slot>{{ text }}</slot></span>
      <span v-if="translation" :class="$style.translation">{{ translation }}</span>
    </template>
  </span>
</template>

<script setup>
import { ref, watch } from '@common/utils/vueTools'
import { translateText, getCachedTranslation, needsTranslation } from '@renderer/utils/translate'
import { appSetting } from '@renderer/store/setting'

const props = defineProps({
  text: {
    type: String,
    default: '',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  replace: {
    type: Boolean,
    default: false,
  },
  swap: {
    type: Boolean,
    default: false,
  },
})

const translation = ref('')

// a translation that only repeats the text adds nothing
const useful = (text, result) => result && result.trim().toLowerCase() != text.trim().toLowerCase() ? result : ''

let loadId = 0
const load = () => {
  const text = props.text
  const id = ++loadId
  // into the language of the app (English, or Chinese for the text that is not Chinese)
  if (!needsTranslation(text)) {
    translation.value = ''
    return
  }
  // cached translations are applied synchronously so recycled list rows don't flash the untranslated text
  const cached = getCachedTranslation(text)
  translation.value = useful(text, cached)
  if (cached != null) return
  void translateText(text).then(res => {
    // the row may have been reused for another text while the request was running
    if (id == loadId && res) translation.value = useful(text, res)
  })
}

// translated again into the new language when it changes
watch([() => props.text, () => appSetting['common.langId']], load, { immediate: true })
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: inline;
}

.original {
  color: inherit;
}

.translation {
  color: var(--color-font-label);
}

.stacked {
  display: inline-flex;
  flex-flow: column nowrap;
  vertical-align: middle;
  // (in a line too short for it: each line ends with "…" instead of being cut)
  max-width: 100%;
  min-width: 0;
  .original, .translation {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .translation {
    font-size: 10px;
    line-height: 1.2;
  }
}

.compact {
  .translation {
    font-size: 0.85em;
    opacity: 0.8;
    &::before {
      content: ' / ';
      opacity: 0.5;
    }
  }
}
</style>
