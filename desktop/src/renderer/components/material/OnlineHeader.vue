<template>
  <header :class="$style.header">
    <h2 :class="$style.title">{{ title }}</h2>
    <div :class="$style.right">
      <slot />
    </div>
  </header>
</template>

<script>
import { computed } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'

// Ported from Any Listen: views/Online/Header.svelte
const TITLES = {
  search: 'online__type_search',
  songlist: 'online__type_songlist',
  topSongs: 'online__type_top_songs',
  library: 'my_list',
}

export default {
  props: {
    active: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const t = useI18n()
    const title = computed(() => t(TITLES[props.active]))
    return {
      title,
    }
  },
}
</script>

<style lang="less" module>
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 0 15px 0 12px;
}
.title {
  flex: none;
  font-size: 20px;
  color: var(--color-font);
}
.right {
  display: flex;
  flex-flow: row nowrap;
  gap: 15px;
  align-items: center;
  min-width: 0;
}
</style>
