import { useRef, forwardRef, useImperativeHandle } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { updateSetting } from '@/core/common'

// import music from '@/utils/musicSdk'
import { Icon } from '@/components/common/Icon'
// import InsetShadow from 'react-native-inset-shadow'
import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import SearchInput, { type SearchInputType, type SearchInputProps } from './SearchInput'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { type Source as MusicSource } from '@/store/search/music/state'
import { type Source as SonglistSource } from '@/store/search/songlist/state'

type Sources = Readonly<Array<MusicSource | SonglistSource>>
type SourceSelectorProps = _SourceSelectorProps<Sources>
type SourceSelectorType = _SourceSelectorType<Sources>

export interface HeaderBarProps {
  onSourceChange: SourceSelectorProps['onSourceChange']
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
  /**
   * the switch that translates the search terms to Chinese was toggled
   */
  onTranslateToggle: () => void
}

export interface HeaderBarType {
  setSourceList: SourceSelectorType['setSourceList']
  setText: SearchInputType['setText']
  blur: SearchInputType['blur']
}


export default forwardRef<HeaderBarType, HeaderBarProps>(({ onSourceChange, onTipSearch, onSearch, onHideTipList, onShowTipList, onTranslateToggle }, ref) => {
  const sourceSelectorRef = useRef<SourceSelectorType>(null)
  const searchInputRef = useRef<SearchInputType>(null)
  const theme = useTheme()
  const isAutoTranslate = useSettingValue('search.isAutoTranslateSearch')
  const toggleTranslate = () => {
    updateSetting({ 'search.isAutoTranslateSearch': !isAutoTranslate })
    onTranslateToggle()
  }

  useImperativeHandle(ref, () => ({
    setSourceList(list, source) {
      sourceSelectorRef.current?.setSourceList(list, source)
    },
    setText(text) {
      searchInputRef.current?.setText(text)
    },
    blur() {
      searchInputRef.current?.blur()
    },
  }), [])


  return (
    <View style={{ ...styles.searchBar, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
      <Icon name="search-2" size={15} color={theme['c-font-label']} style={styles.searchIcon} />
      <View style={styles.selector}>
        <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} center />
      </View>
      <SearchInput
        ref={searchInputRef}
        onChangeText={onTipSearch}
        onSubmit={onSearch}
        onBlur={onHideTipList}
        onTouchStart={onShowTipList}
      />
      <TouchableOpacity
        activeOpacity={0.6} onPress={toggleTranslate} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        style={{ ...styles.translateBtn, backgroundColor: isAutoTranslate ? theme['c-primary-font-active'] : 'transparent', borderColor: isAutoTranslate ? theme['c-primary-font-active'] : theme['c-font-label'] }}
      >
        <Text size={11} color={isAutoTranslate ? theme['c-content-background'] : theme['c-font-label']} style={styles.translateText}>{'\u4e2d'}</Text>
      </TouchableOpacity>
    </View>
  )
})

const styles = createStyle({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    zIndex: 2,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 21,
  },
  translateBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  translateText: {
    fontWeight: 'bold',
  },
  searchIcon: {
    marginRight: 4,
  },
  selector: {
    // width: 86,
  },
})
