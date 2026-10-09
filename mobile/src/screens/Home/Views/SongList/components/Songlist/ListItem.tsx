import { TranslatedText } from '@/components/common/TranslatedText'
import { isSecondarySource, SECONDARY_SOURCE_NAMES } from '@/utils/secondarySources'
import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import Image from '@/components/common/Image'
import { useSettingValue } from '@/store/setting/hook'

// same look as the squares of the library: 12 between the covers, rounded corners, centered name
const gap = 12
export default memo(({ item, index, width, showSource, onPress }: {
  item: ListInfoItem
  index: number
  showSource: boolean
  width: number
  onPress: (item: ListInfoItem, index: number) => void
}) => {
  const isShowSourceSwitch = useSettingValue('common.isShowSourceSwitch')
  const itemWidth = width - gap
  const handlePress = () => {
    onPress(item, index)
  }
  return (
    item.source
      ? (
          <View style={{ ...styles.listItem, width: itemWidth }}>
            <View style={styles.listItemImg}>
              <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
                <Image url={item.img} nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_from_${item.id}`} style={{ width: itemWidth, height: itemWidth, borderRadius: 12 }} />
                {
                  // the playlists of the secondary sources always say where they are from
                  isSecondarySource(item.source)
                    ? <Text style={styles.sourceLabel} size={9} color="#fff" >{SECONDARY_SOURCE_NAMES[item.source]}</Text>
                    : showSource && isShowSourceSwitch ? <Text style={styles.sourceLabel} size={9} color="#fff" >{item.source}</Text> : null
                }
              </TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.5} onPress={handlePress}>
              <Text size={12} style={styles.listItemTitle} numberOfLines={ 2 }><TranslatedText text={item.name} replace /></Text>
            </TouchableOpacity>
            {/* <Text>{JSON.stringify(item)}</Text> */}
          </View>
        )
      : <View style={{ ...styles.listItem, width: itemWidth }} />
  )
})

const styles = createStyle({
  listItem: {
    // width: 90,
    marginHorizontal: 6,
    marginBottom: 14,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    borderRadius: 12,
    marginBottom: 5,
    overflow: 'hidden',
  },
  sourceLabel: {
    paddingLeft: 4,
    paddingBottom: 2,
    paddingRight: 4,
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  listItemTitle: {
    textAlign: 'center',
  },
})
