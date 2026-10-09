<template>
  <div :class="[$style.tagList, {[$style.active]: popupVisible}]">
    <div :ref="setDomBtn" :class="$style.label" @click.stop="handleShow">
      <span><common-translatable-text :text="tagName" compact replace /></span>
      <div :class="$style.icon">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.847 451.847" space="preserve">
          <use xlink:href="#icon-down" />
        </svg>
      </div>
    </div>
    <base-popup v-model:visible="popupVisible" :btn-el="getDomBtn" :max-height="popupMaxHeight">
      <div :class="$style.list" class="scroll" :style="listStyle">
        <div :class="$style.tag" @click="handleToggleTag('')">{{ $t('default') }}</div>
        <dl v-for="tagInfo in list" :key="tagInfo.name">
          <dt :class="$style.type"><common-translatable-text :text="tagInfo.name" compact replace /></dt>
          <dd v-for="tag in tagInfo.list" :key="tag.id" :class="$style.tag" @click="handleToggleTag(tag.id)"><common-translatable-text :text="tag.name" compact replace /></dd>
        </dl>
      </div>
    </base-popup>
  </div>
</template>

<script setup>
import { watch, shallowReactive, ref, onMounted, onBeforeUnmount, computed, reactive } from '@common/utils/vueTools'
import { setTags, getTags } from '@renderer/store/songList/action'
import { tags } from '@renderer/store/songList/state'
import { useRouter, useRoute } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import BasePopup from '@renderer/components/base/Popup.vue'

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
  tagId: {
    type: String,
    required: true,
  },
  sortId: {
    type: [String, undefined],
    default: undefined,
  },
})

const router = useRouter()
const route = useRoute()
const t = useI18n()

const list = shallowReactive([])
const handleToggleTag = (id) => {
  void router.replace({
    path: route.path,
    query: {
      source: props.source,
      tagId: id,
      sortId: props.sortId,
    },
  })
  popupVisible.value = false
}
watch(() => props.source, async(source) => {
  if (!source) return
  // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
  let tagInfo = tags[source]
  // console.log(await getTags(source))
  if (tagInfo == null) setTags(tagInfo = await getTags(source), source)

  list.splice(0, list.length, ...[{ name: window.i18n.t('songlist__tag_info_hot_tag'), list: [...tagInfo.hotTag] }, ...tagInfo.tags])
}, {
  immediate: true,
})
const tagName = computed(() => {
  if (!props.tagId) return t('default')
  for (const tags of list) {
    const tag = tags.list.find(t => t.id == props.tagId)
    if (tag) return tag.name
  }
  return props.tagId
})

const listStyle = reactive({
  width: '645px',
})
const popupMaxHeight = ref(250)

const setListSize = () => {
  window.setTimeout(() => {
    const dom_view = document.getElementById('view')
    if (!dom_view) return
    listStyle.width = dom_view.clientWidth * 0.96 + 'px'
    popupMaxHeight.value = dom_view.clientHeight * 0.65
  }, 50)
}

const dom_btn = ref(null)
const setDomBtn = (el) => {
  dom_btn.value = el
}
const getDomBtn = () => dom_btn.value
const popupVisible = ref(false)
const handleShow = () => {
  popupVisible.value = !popupVisible.value
}

onMounted(() => {
  setListSize()
  window.addEventListener('resize', setListSize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', setListSize)
})

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.tagList {
  font-size: 12px;
  position: relative;

  &.active {
    .label {
      .icon {
        svg{
          transform: rotate(180deg);
        }
      }
    }
  }
}

.label {
  // Any Listen: views/Online/Songlist/list/header/Tags.svelte
  max-width: 150px;
  align-items: center;
  padding: 0 15px;
  // background-color: var(--color-button-background);
  transition: color @transition-normal;
  // border-top: 2px solid @color-tab-border-bottom;
  // border-left: 2px solid @color-tab-border-bottom;
  box-sizing: border-box;
  text-align: center;
  // border-top-left-radius: 3px;
  color: var(--color-font);
  cursor: pointer;

  display: flex;

  span {
    flex: auto;
    padding: 8px 0;
    .mixin-ellipsis-1();
  }
  .icon {
    flex: none;
    margin-left: 7px;
    line-height: 0;
    svg {
      width: .8em;
      transition: transform .2s ease;
      transform: rotate(0);
    }
  }

  &:hover {
    color: var(--color-primary-font-hover);
  }
  &:active {
    color: var(--color-primary-font-active);
  }
}

.list {
  box-sizing: border-box;
  // base-popup already provides 10px padding on its inner wrapper
}

.type {
  padding-top: 10px;
  padding-bottom: 3px;
  color: var(--color-font-label);
}

.tag {
  display: inline-block;
  margin: 5px;
  background-color: var(--color-button-background);
  padding: 8px 10px;
  border-radius: @radius-progress-border;
  transition: background-color @transition-normal;
  cursor: pointer;
  &:hover {
    background-color: var(--color-button-background-hover);
  }
  &:active {
    background-color: var(--color-button-background-active);
  }
}

</style>
