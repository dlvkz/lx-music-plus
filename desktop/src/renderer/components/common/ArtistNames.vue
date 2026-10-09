<template>
  <span :class="[$style.artists, { [$style.stacked]: !inline && translation }]">
    <span :class="$style.names">
      <template v-for="(name, index) in names" :key="index">
        <span v-if="index > 0" :class="$style.separator">{{ separator }}</span>
        <a
          :class="['select', $style.artist]" role="link" :aria-label="name"
          @click.stop="openArtist(name)" @dblclick.stop
        ><common-translatable-text v-if="inline" :text="name" compact selectable /><template v-else>{{ name }}</template></a>
      </template>
    </span>
    <span v-if="!inline && translation" :class="$style.translation">{{ translation }}</span>
  </span>
</template>

<script>
import { normalizeArtistName } from '@renderer/utils/artistName'
import { computed, ref, watch } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { translateText, getCachedTranslation, needsTranslation } from '@renderer/utils/translate'
import { appSetting } from '@renderer/store/setting'

const SPLIT_RXP = /\s*(?:、|&|;|；|\/|,|，|\|)\s*/

/**
 * Artist names of a song, each one opens the artist profile page.
 * Translated names are shown on a second line under the original names,
 * with `inline` they follow each name instead (for single line places like the play bar)
 */
export default {
  props: {
    singer: {
      type: String,
      default: '',
    },
    musicInfo: {
      type: Object,
      default: null,
    },
    separator: {
      type: String,
      default: '、',
    },
    inline: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const router = useRouter()
    const names = computed(() => (props.singer ?? '').split(SPLIT_RXP).map(n => n.trim()).filter(n => n))

    // translation line: the translated names in the same order, names that need none are kept as they are
    const translations = ref([])
    let loadId = 0
    const loadTranslations = () => {
      const id = ++loadId
      const list = names.value
      // into the language of the app (English, or Chinese for the names that are not Chinese)
      if (props.inline || list.every(name => !needsTranslation(name))) {
        translations.value = []
        return
      }
      translations.value = list.map(name => needsTranslation(name) ? getCachedTranslation(name) : name)
      list.forEach((name, index) => {
        if (translations.value[index] != null) return
        void translateText(name).then(result => {
          if (id != loadId || !result) return
          const newList = [...translations.value]
          newList[index] = result
          translations.value = newList
        })
      })
    }
    // translated again into the new language when it changes
    watch([names, () => appSetting['common.langId']], loadTranslations, { immediate: true })
    // shown once every name is translated, so the line doesn't change while it loads
    const translation = computed(() => {
      const list = translations.value
      return list.length && list.every(name => name != null) ? list.join(props.separator + ' ') : ''
    })

    const openArtist = (name) => {
      const source = props.musicInfo?.source
      emit('navigate')
      void router.push({
        path: '/artist',
        query: {
          // "NewJeans (뉴진스)" and "NewJeans" are the same page
          name: normalizeArtistName(name),
          source: source && source != 'local' ? source : undefined,
          songmid: props.musicInfo && source != 'local' ? String(props.musicInfo.meta?.songId ?? '') : undefined,
        },
      }).catch(_ => _)
    }

    return {
      names,
      translation,
      openArtist,
    }
  },
}
</script>

<style lang="less" module>
.artists {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: inherit;
}
.stacked {
  display: inline-flex;
  flex-flow: column nowrap;
  max-width: 100%;
  vertical-align: middle;
  .names, .translation {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .translation {
    font-size: 10px;
    line-height: 1.2;
    color: var(--color-font-label);
  }
}
.artist {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  &:hover {
    color: var(--color-primary-font-hover);
    text-decoration: underline;
  }
}
.separator {
  opacity: 0.8;
}
</style>
