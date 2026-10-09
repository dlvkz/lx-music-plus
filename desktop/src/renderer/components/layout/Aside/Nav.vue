<template>
  <ul :class="$style.asideNav" role="menu">
    <li v-for="item in menus" :key="item.to" :class="$style.navItem" role="presentation">
      <router-link
        :class="[$style.link, { [$style.active]: activePath == item.to }]" role="tab"
        :aria-selected="activePath == item.to" :to="item.to"
        @click="handleClick(item.to)"
      >
        <div :class="$style.left">
          <div :class="$style.icon">
            <svg :viewBox="item.iconSize">
              <use :xlink:href="item.icon" />
            </svg>
          </div>
          <span :class="$style.navName">{{ item.name }}</span>
        </div>
      </router-link>
    </li>
  </ul>
</template>

<script>
import { computed } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import { appSetting } from '@renderer/store/setting'
import { emitNavReselect } from '@renderer/store/navReselect'

// Ported from Any Listen: components/layout/Aside/Nav.svelte

export default {
  setup() {
    const t = useI18n()
    const route = useRoute()

    const menus = computed(() => {
      return [
        {
          to: '/home',
          name: t('home'),
          icon: '#icon-home',
          iconSize: '0 0 24 24',
          enable: true,
        },
        {
          to: '/search',
          name: t('online__type_search'),
          icon: '#icon-search',
          iconSize: '0 0 24 24',
          enable: true,
        },
        {
          to: '/songList/list',
          name: t('online__type_songlist'),
          icon: '#icon-music_library',
          iconSize: '0 0 24 24',
          enable: true,
        },
        {
          to: '/leaderboard',
          name: t('online__type_top_songs'),
          icon: '#icon-increase',
          iconSize: '0 0 24 24',
          enable: true,
        },
        {
          to: '/download',
          name: t('download'),
          icon: '#icon-download-2',
          iconSize: '0 0 425.2 425.2',
          enable: appSetting['download.enable'],
        },
        {
          to: '/stats',
          name: t('stats__title'),
          icon: '#icon-clock',
          iconSize: '0 0 24 24',
          enable: true,
        },
        // the import of the library of another platform and the sync of the devices (views/Import)
        {
          to: '/import',
          name: t('import__nav'),
          icon: '#icon-import',
          iconSize: '0 0 24 24',
          enable: true,
        },
        {
          to: '/setting',
          name: t('setting'),
          icon: '#icon-settings',
          iconSize: '0 0 24 24',
          enable: true,
        },
      ].filter(m => m.enable)
    })

    const activePath = computed(() => {
      const path = route.path
      if (path.startsWith('/songList')) return '/songList/list'
      return menus.value.some(m => m.to == path) ? path : ''
    })

    // the open section clicked again: back to its start
    const handleClick = (to) => {
      if (route.path == to) emitNavReselect(to)
    }

    return {
      menus,
      activePath,
      handleClick,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.asideNav {
  display: flex;
  flex: none;
  flex-flow: column nowrap;
  padding: 0 12px;
}
.navItem {
  position: relative;
}
.link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  color: var(--color-primary-font);
  text-decoration: none;
  cursor: pointer;
  outline: none;
  border-radius: @radius-border;
  transition: @transition-fast;
  transition-property: background-color, opacity;
  .mixin-ellipsis-1();

  &.active {
    cursor: default;
    background-color: var(--color-primary-light-300-alpha-700);
  }

  &:hover {
    color: var(--color-primary-font);
    &:not(.active) {
      background-color: var(--color-primary-light-400-alpha-700);
      opacity: 0.8;
    }
  }
  &:active:not(.active) {
    background-color: var(--color-primary-light-300-alpha-600);
    opacity: 0.6;
  }
}

.left {
  display: flex;
  gap: 6px;
  align-items: center;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 20px;
  & > svg {
    height: 20px;
    width: 20px;
  }
}
.navName {
  font-size: 13px;
  line-height: 1.2;
}
</style>
