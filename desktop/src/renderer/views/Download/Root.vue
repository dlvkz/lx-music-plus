<template>
  <!-- the detailed task table is kept for the advanced interface -->
  <DownloadTasks v-if="appSetting['common.isShowSourceSwitch']" />
  <DownloadLibrary v-else />
</template>

<script setup>
import { appSetting } from '@renderer/store/setting'
import DownloadTasks from './index.vue'
import DownloadLibrary from './Library.vue'
</script>
