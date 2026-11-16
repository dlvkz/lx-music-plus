<template>
  <!-- The lists a song (or songs) can be added / moved to: shown in a popup next to what opened it, like the queue
       (ListAddModal.vue, ListAddMultipleModal.vue: the menus of the songs, AddToListBtn.vue: the play bar) -->
  <div :class="$style.panel">
    <div :class="$style.header">
      <h2 v-if="musicList.length == 1" :class="$style.title">
        {{ $t(isMove ? 'list_add__title_first_move' : 'list_add__title_first_add') }}
        <span :class="$style.name">{{ musicName }}</span>
        {{ $t('list_add__title_last') }}
      </h2>
      <h2 v-else :class="$style.title">{{ $t(isMove ? 'list_add__multiple_title_move' : 'list_add__multiple_title_add', { num: musicList.length }) }}</h2>
      <base-input v-if="isShowFilter" v-model="filterText" :class="$style.filter" :placeholder="$t('search')" />
    </div>
    <ul :class="$style.list" role="listbox">
      <li>
        <div v-if="isEditing" :class="[$style.item, $style.newList]">
          <svg-icon name="plus" :class="$style.icon" />
          <input ref="inputRef" v-model="newListName" :class="$style.input" :placeholder="$t('lists__new_list_input')" @keydown.enter="handleSaveList" @blur="handleSaveList">
        </div>
        <button v-else type="button" :class="[$style.item, $style.newList]" @click="handleEditing">
          <svg-icon name="plus" :class="$style.icon" />
          <span :class="$style.label">{{ $t('lists__new_list_btn') }}</span>
        </button>
      </li>
      <li v-for="item in shownLists" :key="item.id">
        <button
          type="button" role="option" :class="$style.item" :disabled="item.isExist" :aria-selected="item.isExist"
          :aria-label="$t(musicList.length == 1 ? 'list_add__btn_title' : 'list_add__multiple_btn_title', { name: item.name })"
          @click="handleSelect(item)"
        >
          <svg-icon :name="item.id == loveList.id ? 'love' : 'music_library'" :class="$style.icon" />
          <span :class="$style.label">{{ item.name }}</span>
          <svg-icon v-if="item.isExist" name="check" :class="$style.check" />
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { defaultList, loveList, userLists } from '@renderer/store/list/state'
import { getListDisplayName } from '@renderer/store/list/defaultListCustom'
import { addListMusics, moveListMusics, createUserList, getMusicExistListIds } from '@renderer/store/list/action'
import useKeyDown from '@renderer/utils/compositions/useKeyDown'
import { dialog } from '@renderer/plugins/Dialog'

const props = defineProps({
  // the songs (songs of the downloads too)
  musicList: {
    type: Array,
    required: true,
  },
  excludeListId: {
    type: Array,
    default() {
      return []
    },
  },
  fromListId: {
    type: String,
    default: null,
  },
  isMove: {
    type: Boolean,
    default: false,
  },
})
const emit = defineEmits(['close', 'confirm'])

const keyModDown = useKeyDown('mod')
const songs = computed(() => props.musicList.map(m => 'progress' in m ? m.metadata.musicInfo : m))
const musicName = computed(() => songs.value[0]?.name ?? '')

// the lists that have the song already (one song): shown checked
const existIds = ref([])
const updateExistIds = () => {
  existIds.value = []
  if (songs.value.length != 1) return
  const id = songs.value[0].id
  void getMusicExistListIds(id).then(ids => {
    if (songs.value[0]?.id != id) return
    existIds.value = ids
  })
}
watch(songs, updateExistIds, { immediate: true })

const lists = computed(() => {
  return [
    { ...defaultList, name: getListDisplayName(defaultList) },
    { ...loveList, name: getListDisplayName(loveList) },
    ...userLists,
  ].filter(l => !props.excludeListId.includes(l.id)).map(l => ({ id: l.id, name: l.name, isExist: existIds.value.includes(l.id) }))
})
const isShowFilter = computed(() => lists.value.length > 8)
const filterText = ref('')
const shownLists = computed(() => {
  const text = filterText.value.trim().toLowerCase()
  return text ? lists.value.filter(l => l.name.toLowerCase().includes(text)) : lists.value
})

const handleSelect = (item) => {
  if (props.isMove) void moveListMusics(props.fromListId, item.id, songs.value)
  else void addListMusics(item.id, songs.value)
  existIds.value = [...existIds.value, item.id]
  // (with the mod key: added to other lists too)
  if (keyModDown.value && !props.isMove) return
  emit('confirm')
  emit('close')
}

const isEditing = ref(false)
const newListName = ref('')
const inputRef = ref(null)
const handleEditing = () => {
  isEditing.value = true
  void nextTick(() => inputRef.value?.focus())
}
// the new list has the song(s) right away
const handleSaveList = async() => {
  if (!isEditing.value) return
  const name = newListName.value.trim()
  newListName.value = ''
  isEditing.value = false
  if (!name || (
    userLists.some(l => l.name == name) && !(await dialog.confirm(window.i18n.t('list_duplicate_tip'))))
  ) return
  const id = `userlist_${Date.now()}`
  if (props.isMove) {
    await createUserList({ name, id })
    void moveListMusics(props.fromListId, id, songs.value)
  } else await createUserList({ name, id, list: songs.value })
  emit('confirm')
  emit('close')
}

// Escape: the new list is left, or the popup is closed
const handleKeyDown = (event) => {
  if (event.key != 'Escape') return
  event.stopPropagation()
  if (isEditing.value) {
    newListName.value = ''
    isEditing.value = false
  } else emit('close')
}
onMounted(() => {
  updateExistIds()
  window.addEventListener('keydown', handleKeyDown, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown, true)
})
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.panel {
  display: flex;
  flex-flow: column nowrap;
  width: 300px;
  min-height: 0;
}
.header {
  position: sticky;
  top: -10px;
  z-index: 1;
  padding: 2px 4px 8px;
  margin-top: -10px;
  padding-top: 12px;
  background-color: var(--color-content-background);
}
.title {
  font-size: 13px;
  font-weight: normal;
  line-height: 1.4;
  color: var(--color-font-label);
  .mixin-ellipsis-2();
}
.name {
  color: var(--color-primary-font);
}
.filter {
  width: 100%;
  margin-top: 8px;
  font-size: 13px;
}
.list {
  display: flex;
  flex-flow: column nowrap;
  gap: 2px;
}
.item {
  display: flex;
  gap: 10px;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  height: 34px;
  padding: 0 8px;
  font-size: 14px;
  color: var(--color-font);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 4px;
  transition: background-color @transition-fast;
  &:hover:not(:disabled) {
    background-color: var(--color-primary-background-hover);
  }
  &:active:not(:disabled) {
    background-color: var(--color-primary-background-active);
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
}
.icon {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--color-primary-font);
}
.label {
  flex: auto;
  min-width: 0;
  .mixin-ellipsis-1();
}
.check {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--color-primary-font);
}
.newList {
  color: var(--color-primary-font);
}
.input {
  flex: auto;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  font-family: inherit;
  font-size: 14px;
  color: var(--color-font);
  background-color: var(--color-primary-background);
  border: none;
  border-radius: 4px;
  outline: none;
}
</style>
