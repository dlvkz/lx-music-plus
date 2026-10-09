<template>
  <!-- Layout ported from Any Listen: views/Setting/{index,Header,AppSetting/AppSetting,AppSetting/SettingList,AppSetting/SettingView}.svelte -->
  <div :class="$style.container">
    <header :class="$style.header">
      <base-tab model-value="app" :list="viewList" />
    </header>
    <div :class="$style.main">
      <div :class="$style.settingsAppList">
        <div :class="[$style.list, 'scroll', 'hide-scrollbar']" role="toolbar">
          <div
            v-for="h2 in tocList" :key="h2.id" role="tab" tabindex="0"
            :class="[$style.listItem, { [$style.active]: avtiveComponentName == h2.id }]"
            :aria-selected="avtiveComponentName == h2.id" :aria-label="h2.title" ignore-tip
            @keydown.enter="toggleTab(h2.id)" @click="toggleTab(h2.id)"
          >
            <svg-icon v-if="avtiveComponentName == h2.id" name="angle-right-solid" />
            {{ h2.title }}
          </div>
        </div>
      </div>
      <div :class="$style.settingsListContainer">
        <div ref="dom_content_ref" class="scroll" :class="$style.setting">
          <dl>
            <component :is="avtiveComponentName" />
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick, watch, onBeforeUnmount } from '@common/utils/vueTools'
import { onSettingSection } from '@renderer/core/sourcePrompt'
// import { currentStting } from './setting'
import { useI18n } from '@renderer/plugins/i18n'
import { useRoute } from '@common/utils/vueRouter'

import SettingBasic from './components/SettingBasic.vue'
import SettingPlay from './components/SettingPlay.vue'
import SettingPlayDetail from './components/SettingPlayDetail.vue'
import SettingDesktopLyric from './components/SettingDesktopLyric.vue'
import SettingSearch from './components/SettingSearch.vue'
import SettingList from './components/SettingList.vue'
import SettingDownload from './components/SettingDownload.vue'
import SettingSync from './components/SettingSync/index.vue'
import SettingOpenAPI from './components/SettingOpenAPI.vue'
import SettingLastfm from './components/SettingLastfm.vue'
import SettingAddons from './components/SettingAddons.vue'
import SettingHotKey from './components/SettingHotKey.vue'
import SettingNetwork from './components/SettingNetwork.vue'
import SettingOdc from './components/SettingOdc.vue'
import SettingBackup from './components/SettingBackup.vue'
import SettingOther from './components/SettingOther.vue'
import SettingUpdate from './components/SettingUpdate.vue'
import SettingAbout from './components/SettingAbout.vue'

export default {
  name: 'Setting',
  components: {
    SettingBasic,
    SettingPlay,
    SettingPlayDetail,
    SettingDesktopLyric,
    SettingSearch,
    SettingList,
    SettingDownload,
    SettingSync,
    SettingOpenAPI,
    SettingLastfm,
    SettingAddons,
    SettingHotKey,
    SettingNetwork,
    SettingOdc,
    SettingBackup,
    SettingOther,
    SettingUpdate,
    SettingAbout,
  },
  setup() {
    const t = useI18n()
    const route = useRoute()

    const dom_content_ref = ref(null)

    const tocList = computed(() => {
      return [
        { id: 'SettingBasic', title: t('setting__basic') },
        { id: 'SettingAddons', title: t('setting__addons') },
        { id: 'SettingPlay', title: t('setting__play') },
        { id: 'SettingPlayDetail', title: t('setting__play_detail') },
        { id: 'SettingDesktopLyric', title: t('setting__desktop_lyric') },
        { id: 'SettingSearch', title: t('setting__search') },
        { id: 'SettingList', title: t('setting__list') },
        { id: 'SettingDownload', title: t('setting__download') },
        { id: 'SettingHotKey', title: t('setting__hot_key') },
        { id: 'SettingSync', title: t('setting__sync') },
        { id: 'SettingOpenAPI', title: t('setting__open_api') },
        { id: 'SettingLastfm', title: t('setting__lastfm') },
        { id: 'SettingNetwork', title: t('setting__network') },
        { id: 'SettingOdc', title: t('setting__odc') },
        { id: 'SettingBackup', title: t('setting__backup') },
        { id: 'SettingOther', title: t('setting__other') },
        { id: 'SettingUpdate', title: t('setting__update') },
        { id: 'SettingAbout', title: t('setting__about') },
      ]
    })

    const viewList = computed(() => [{ id: 'app', label: t('settings__type_app') }])

    const avtiveComponentName = ref(route.query.name && tocList.value.some(t => t.id == route.query.name)
      ? route.query.name
      : tocList.value[0].id)

    const toggleTab = id => {
      avtiveComponentName.value = id
      void nextTick(() => {
        dom_content_ref.value?.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      })
    }

    // a section asked while the settings are open (e.g. the sources, from the player)
    const showSection = name => {
      if (name && name != avtiveComponentName.value && tocList.value.some(t => t.id == name)) toggleTab(name)
    }
    watch(() => route.query.name, showSection)
    onBeforeUnmount(onSettingSection(showSection))

    return {
      viewList,
      tocList,
      avtiveComponentName,
      dom_content_ref,
      toggleTab,
    }
  },
  // mounted() {
  //   this.initTOC()
  // },
  // methods: {
  //   initTOC() {
  //     const list = this.$refs.dom_setting_list.children
  //     const toc = []
  //     let prevTitle
  //     for (const item of list) {
  //       if (item.tagName == 'DT') {
  //         prevTitle = {
  //           title: item.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: item.getAttribute('id'),
  //           dom: item,
  //           children: [],
  //         }
  //         toc.push(prevTitle)
  //         continue
  //       }
  //       const h3 = item.querySelector('h3')
  //       if (h3) {
  //         prevTitle.children.push({
  //           title: h3.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: h3.getAttribute('id'),
  //           dom: h3,
  //         })
  //       }
  //     }
  //     console.log(toc)
  //     this.toc.list = toc
  //   },
  //   handleListScroll(event) {
  //     // console.log(event.target.scrollTop)
  //   },
  // },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  font-size: 14px;
}
.header {
  display: flex;
  flex: none;
  flex-flow: row nowrap;
  align-items: center;
  justify-content: space-between;
  padding: 0 15px;
}
.main {
  display: flex;
  flex: auto;
  flex-flow: row nowrap;
  min-height: 0;
  padding-top: 10px;
}
.settingsAppList {
  flex: none;
  width: 18%;
  max-width: 200px;
  margin-bottom: 12px;
  margin-left: 12px;
  overflow: hidden;
  background-color: var(--color-primary-light-300-alpha-900);
  border-radius: @radius-border;
}
.list {
  height: 100%;
}
.listItem {
  position: relative;
  display: block;
  padding: 0 10px;
  font-size: 13px;
  line-height: 36px;
  background-color: transparent;
  border-radius: @radius-border;
  transition: 0.3s ease;
  transition-property: color, background-color;
  .mixin-ellipsis-1();
  &:hover:not(.active) {
    cursor: pointer;
    background-color: var(--color-primary-background-hover);
  }
  &.active {
    color: var(--color-primary);
  }
  & > :global(svg) {
    width: 0.9em;
    height: 0.9em;
    margin-left: -0.45em;
    vertical-align: -0.05em;
  }
}
.settingsListContainer {
  display: flex;
  flex: auto;
  flex-flow: column nowrap;
  min-width: 0;
  overflow: hidden;
}
.setting {
  position: relative;
  flex: auto;
  min-height: 0;
  padding-bottom: 30px;
  margin: 0 10px;
  overflow-y: auto;

  :global {
    // Any Listen: .settings-title
    dt {
      padding: 3px 7px;
      margin-top: 6px;
      margin-bottom: 15px;
      font-size: 15px;
      border-left: 5px solid var(--color-primary-alpha-700);

      + dd h3 {
        margin-top: 0;
      }
    }
    // Any Listen: .settings-item
    dd {
      padding-right: 10px;
      > div {
        margin-left: 16px;
      }
      + dd {
        h3 {
          margin-top: 14px;
        }
      }
      .checkbox,
      .radio {
        font-size: 14px;
      }
    }
    // Any Listen: .settings-item-title
    h3 {
      padding-bottom: 8px;
      font-size: 13px;
    }
    .p {
      padding: 3px 0;
      line-height: 1.3;
      .btn {
        + .btn {
          margin-left: 10px;
        }
      }
    }
    .help-btn {
      padding: 0;
      margin: 0 0.4em;
      color: var(--color-button-font);
      cursor: pointer;
      background: none;
      border: none;
      transition: opacity 0.2s ease;
      &:hover {
        opacity: 0.7;
      }
    }
    .help-icon {
      margin: 0 0.4em;
    }
  }
}
</style>
