<template>
  <!-- Ported from Any Listen: components/material/SearchInput.svelte -->
  <div :class="[$style.searchInput, 'search-input', 'no-drag']">
    <div :class="[$style.content, { [$style.active]: focus }, { [$style.big]: big }, { [$style.small]: small }]">
      <div :class="$style.form">
        <button v-if="showBack" type="button" :aria-label="$t('back')" @click="sendEvent('back')">
          <svg height="100%" viewBox="0 0 24 24">
            <use xlink:href="#icon-back" />
          </svg>
        </button>
        <input
          ref="dom_input"
          v-model.trim="text"
          :placeholder="placeholder"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="$emit('update:modelValue', text)"
          @change="sendEvent('change')"
          @keyup.enter="handleSearch"
          @keydown.arrow-down.arrow-up.prevent
          @keyup.arrow-down.prevent="handleKeyDown"
          @keyup.arrow-up.prevent="handleKeyUp"
          @contextmenu="handleContextMenu"
        >
        <button
          v-if="showTranslateToggle" type="button" :class="[$style.translateBtn, { [$style.active]: isAutoTranslateSearch }]"
          :aria-label="$t('setting__search_auto_translate')" @click="toggleAutoTranslate"
        >
          中
        </button>
        <button v-if="text" type="button" @click="handleClearList">
          <svg height="100%" viewBox="0 0 24 24">
            <use xlink:href="#icon-window-close" />
          </svg>
        </button>
        <button type="button" @click="handleSearch">
          <slot>
            <svg height="100%" viewBox="0 0 30.239 30.239">
              <use xlink:href="#icon-search" />
            </svg>
          </slot>
        </button>
      </div>
      <div v-if="list" :class="[$style.listContent, 'scroll']" :style="listStyle">
        <div ref="dom_list" role="list" :class="$style.list" @mouseleave="selectIndex = -1">
          <div
            v-for="(item, index) in list"
            :key="item"
            role="button"
            :class="[$style.listItem, { [$style.select]: selectIndex === index }]"
            @mouseenter="selectIndex = index"
            @click.stop="handleTemplistClick(index)"
          >
            <p :class="$style.listItemTitle">{{ item }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { clipboardReadText } from '@common/utils/electron'
import { HOTKEY_COMMON } from '@common/hotKey'
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  props: {
    placeholder: {
      type: String,
      default: 'Search for something...',
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    visibleList: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: String,
      default: '',
    },
    big: {
      type: Boolean,
      default: false,
    },
    small: {
      type: Boolean,
      default: false,
    },
    showBack: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'event'],
  data() {
    return {
      isShow: false,
      text: '',
      selectIndex: -1,
      focus: false,
      listStyle: {
        height: 0,
      },
    }
  },
  computed: {
    showTranslateToggle() {
      const locale = appSetting['common.langId'] ?? window.i18n.locale
      return locale && !locale.startsWith('zh')
    },
    isAutoTranslateSearch() {
      return appSetting['search.isAutoTranslateSearch']
    },
  },
  watch: {
    list(n) {
      if (!this.visibleList) return
      if (this.selectIndex > -1) this.selectIndex = -1
      this.$nextTick(() => {
        this.listStyle.height = this.$refs.dom_list.scrollHeight + 'px'
      })
    },
    modelValue(n) {
      this.text = n
    },
    visibleList(n) {
      n ? this.showList() : this.hideList()
    },
  },
  mounted() {
    if (appSetting['search.isFocusSearchBox']) this.handleFocusInput()
    this.handleRegisterEvent('on')
  },
  beforeUnmount() {
    this.handleRegisterEvent('off')
  },
  methods: {
    handleRegisterEvent(action) {
      let eventHub = window.key_event
      let name = action == 'on' ? 'on' : 'off'
      // eslint-disable-next-line @typescript-eslint/unbound-method
      eventHub[name](HOTKEY_COMMON.focusSearchInput.action, this.handleFocusInput)
    },
    handleFocusInput() {
      this.$refs.dom_input.focus()
    },
    handleTemplistClick(index) {
      console.log(index)
      this.sendEvent('listClick', index)
    },
    handleFocus() {
      this.focus = true
      this.sendEvent('focus')
    },
    handleBlur() {
      setTimeout(() => {
        this.focus = false
        this.sendEvent('blur')
      }, 80)
    },
    handleSearch() {
      this.hideList()
      if (this.selectIndex < 0) {
        this.sendEvent('submit')
        return
      }
      this.sendEvent('listClick', this.selectIndex)
    },
    showList() {
      this.isShow = true
      this.listStyle.height = this.$refs.dom_list.scrollHeight + 'px'
      this.listStyle.maxHeight = document.body.clientHeight * 0.6 + 'px'
    },
    hideList() {
      this.isShow = false
      this.listStyle.height = 0
      this.$nextTick(() => {
        this.selectIndex = -1
      })
    },
    sendEvent(action, data) {
      this.$emit('event', {
        action,
        data,
      })
    },
    handleKeyDown() {
      if (this.list.length) {
        this.selectIndex = this.selectIndex + 1 < this.list.length ? this.selectIndex + 1 : 0
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleKeyUp() {
      if (this.list.length) {
        this.selectIndex = this.selectIndex - 1 < -1 ? this.list.length - 1 : this.selectIndex - 1
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleContextMenu() {
      let str = clipboardReadText()
      str = str.trim()
      str = str.replace(/\t|\r\n|\n|\r/g, ' ')
      str = str.replace(/\s+/g, ' ')
      let dom_input = this.$refs.dom_input
      this.text = this.text.substring(0, dom_input.selectionStart) + str + this.text.substring(dom_input.selectionEnd, this.text.length)
      this.$emit('update:modelValue', this.text)
    },
    handleClearList() {
      this.text = ''
      this.$emit('update:modelValue', this.text)
      this.sendEvent('submit')
    },
    toggleAutoTranslate() {
      updateSetting({ 'search.isAutoTranslateSearch': !appSetting['search.isAutoTranslateSearch'] })
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// Ported from Any Listen: components/material/SearchInput.svelte
@input-height: @height-toolbar * 0.6;
.searchInput {
  position: relative;
  width: var(--width, 35%);
  min-width: var(--min-width, none);
  max-width: var(--max-width, none);
  height: @input-height;
  -webkit-app-region: no-drag;
}
.content {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  background-color: var(--color-primary-light-300-alpha-700);
  border-radius: @form-radius;
  transition: box-shadow 0.4s ease, background-color @transition-fast;

  &.active {
    background-color: var(--color-primary-light-600-alpha-100);
    box-shadow: 0 1px 5px 0 rgb(0 0 0 / 20%);
    .form {
      input {
        border-bottom-left-radius: 0;
      }
      button {
        border-bottom-right-radius: 0;
      }
    }
  }
}
.form {
  position: relative;
  display: flex;
  height: @input-height;
  input {
    flex: auto;
    min-width: 0;
    padding: 0 5px;
    overflow: hidden;
    font-size: 13.5px;
    outline: none;
    background-color: transparent;
    border: none;
    border-top-left-radius: 3px;
    border-bottom-left-radius: 3px;
    &::placeholder {
      font-size: 0.98em;
      color: var(--color-button-font);
    }
  }
  button {
    display: flex;
    flex: none;
    height: 100%;
    padding: 6px 7px;
    color: var(--color-button-font);
    cursor: pointer;
    outline: none;
    background-color: transparent;
    border: none;
    transition: background-color 0.2s ease;

    &:last-child {
      border-top-right-radius: 3px;
      border-bottom-right-radius: 3px;
    }
    &:hover {
      background-color: var(--color-button-background-hover);
    }
    &:active {
      background-color: var(--color-button-background-active);
    }
  }
}
.translateBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  padding: 0;
  font-size: 12px;
  font-weight: bold;
  color: var(--color-button-font);
  opacity: 0.5;
  &.active {
    color: var(--color-primary-font);
    opacity: 1;
    background-color: var(--color-primary-alpha-300);
  }
}
.listContent {
  height: 0;
  max-height: 300px;
  font-size: 13px;
  transition: 0.3s ease;
  transition-property: height;
}
.listItem {
  max-width: 100%;
  padding: 8px 5px;
  line-height: 1.3;
  cursor: pointer;
  transition: background-color 0.3s ease;
  &.select {
    background-color: var(--color-primary-dark-100-alpha-700);
  }
  &:last-child {
    border-bottom-right-radius: 3px;
    border-bottom-left-radius: 3px;
  }
}
.listItemTitle {
  .mixin-ellipsis-1();
}

.big {
  width: 100%;
  .form {
    height: 30px;
    button {
      padding: 6px 10px;
    }
  }
}
</style>
