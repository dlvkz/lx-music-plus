<template lang="pug">
//- part: 'all' (settings), 'main' (the enable switch, how new devices sync), 'advanced' (the mode, the server / client)
dt#sync(v-if="part != 'advanced'")
  | {{ $t('setting__sync') }}
  button(class="help-btn" :aria-label="$t('setting__sync_tip')" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/faq/sync')")
    svg-icon(name="help-circle-outline")
dd(v-if="part != 'advanced'")
  base-checkbox(id="setting_sync_enable" :model-value="appSetting['sync.enable']" :label="$t('setting__sync_enable')" @update:model-value="handleToggleEnable")
  //- the server: how the lists of the new devices are synced (chosen when the sync is enabled)
  .gap-top(v-if="appSetting['sync.mode'] == 'server'" :class="$style.modeRow")
    span {{ $t('sync__new_device_label') }}
    strong {{ $t(newDeviceModeLabel) }}
    base-btn.btn(min @click="openChooser(false)") {{ $t('sync__change') }}

material-modal(:show="isShowChooser" teleport="#view" width="520px" @close="isShowChooser = false")
  main(:class="$style.chooser")
    h2 {{ $t('sync__choose_title') }}
    p(:class="$style.chooserDesc") {{ $t('sync__choose_desc') }}
    ul(:class="$style.options")
      li(v-for="option in MODE_OPTIONS" :key="option.mode")
        label(:class="[$style.option, { [$style.optionActive]: chosenMode == option.mode }]")
          input(type="radio" name="sync_new_device_mode" :value="option.mode" :checked="chosenMode == option.mode" @change="chosenMode = option.mode")
          div
            strong {{ $t(option.label) }}
            p {{ $t(option.desc) }}
    div(:class="$style.chooserBtns")
      base-btn(@click="isShowChooser = false") {{ $t('btn_cancel') }}
      base-btn(@click="confirmChooser") {{ $t(isEnabling ? 'sync__enable_confirm' : 'sync__save') }}

dd(v-if="part != 'main'")
  h3#sync_mode {{ $t('setting__sync_mode') }}
  div
    base-checkbox.gap-left(id="setting_sync_mode_server" :disabled="sync.enable" :model-value="appSetting['sync.mode']" need value="server" :label="$t('setting__sync_mode_server')" @update:model-value="updateSetting({ 'sync.mode': $event })")
    base-checkbox.gap-left(id="setting_sync_mode_client" :disabled="sync.enable" :model-value="appSetting['sync.mode']" need value="client" :label="$t('setting__sync_mode_client')" @update:model-value="updateSetting({ 'sync.mode': $event })")


template(v-if="part != 'main'")
  SyncClient(v-if="sync.mode == 'client'")
  SyncServer(v-else)

</template>

<script>
// import { computed } from '@common/utils/vueTools'
import { sync } from '@renderer/store'
import { openUrl } from '@common/utils/electron'
import { appSetting, updateSetting } from '@renderer/store/setting'
import SyncServer from './SyncServer.vue'
import SyncClient from './SyncClient.vue'
import { computed, ref } from '@common/utils/vueTools'

// how the lists of a new device are synced (setting sync.server.newDeviceMode)
const MODE_OPTIONS = [
  { mode: 'merge_local_remote', label: 'sync__mode_merge', desc: 'sync__mode_merge_desc' },
  { mode: 'overwrite_local_remote_full', label: 'sync__mode_computer', desc: 'sync__mode_computer_desc' },
  { mode: 'overwrite_remote_local_full', label: 'sync__mode_device', desc: 'sync__mode_device_desc' },
  { mode: '', label: 'sync__mode_ask', desc: 'sync__mode_ask_desc' },
]

export default {
  name: 'SettingSync',
  components: {
    SyncServer,
    SyncClient,
  },
  props: {
    part: {
      type: String,
      default: 'all',
    },
  },
  setup() {
    // enabling the sync (server): how new devices are synced is chosen first, the sync starts once it is confirmed
    const isShowChooser = ref(false)
    const isEnabling = ref(false)
    const chosenMode = ref(appSetting['sync.server.newDeviceMode'] ?? 'merge_local_remote')
    const openChooser = (enabling) => {
      isEnabling.value = enabling
      chosenMode.value = appSetting['sync.server.newDeviceMode'] ?? 'merge_local_remote'
      isShowChooser.value = true
    }
    const handleToggleEnable = (enable) => {
      if (enable && appSetting['sync.mode'] == 'server') {
        openChooser(true)
        return
      }
      updateSetting({ 'sync.enable': enable })
    }
    const confirmChooser = () => {
      isShowChooser.value = false
      updateSetting(isEnabling.value
        ? { 'sync.server.newDeviceMode': chosenMode.value, 'sync.enable': true }
        : { 'sync.server.newDeviceMode': chosenMode.value })
    }
    const newDeviceModeLabel = computed(() => (MODE_OPTIONS.find(o => o.mode == (appSetting['sync.server.newDeviceMode'] ?? 'merge_local_remote')) ?? MODE_OPTIONS[0]).label)

    return {
      appSetting,
      updateSetting,
      sync,
      openUrl,
      MODE_OPTIONS,
      isShowChooser,
      isEnabling,
      chosenMode,
      openChooser,
      handleToggleEnable,
      confirmChooser,
      newDeviceModeLabel,
    }
  },
}
</script>

<style lang="less" module>
.modeRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  strong {
    color: var(--color-primary-font);
  }
}
.chooser {
  padding: 0 18px 16px;
  h2 {
    font-size: 16px;
    padding: 16px 0 6px;
    color: var(--color-font);
  }
}
.chooserDesc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-font-label);
  margin-bottom: 10px;
}
.options {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
}
.option {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid var(--color-primary-light-300-alpha-800);
  transition: background-color 0.2s ease;
  input {
    margin-top: 3px;
    accent-color: var(--color-primary);
  }
  strong {
    font-size: 14px;
    color: var(--color-font);
  }
  p {
    font-size: 12px;
    line-height: 1.4;
    margin-top: 2px;
    color: var(--color-font-label);
  }
  &:hover {
    background-color: var(--color-primary-background-hover);
  }
}
.optionActive {
  border-color: var(--color-primary);
  background-color: var(--color-primary-background-hover);
}
.chooserBtns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
</style>
