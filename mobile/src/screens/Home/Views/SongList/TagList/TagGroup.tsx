import { TranslatedText } from '@/components/common/TranslatedText'
import { View } from 'react-native'

import Button from '@/components/common/Button'
import { type TagInfoItem } from '@/store/songlist/state'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'

export interface TagGroupProps {
  name: string
  list: TagInfoItem[]
  onTagChange: (name: string, id: string) => void
  activeId: string
}

export default ({ name, list, onTagChange, activeId }: TagGroupProps) => {
  const theme = useTheme()
  return (
    <View>
      {
        name
          ? <Text size={15} style={styles.tagTypeTitle}><TranslatedText text={name} replace /></Text>
          : null
      }
      <View style={styles.tagTypeList}>
        {list.map(item => (
          activeId == item.id
            ? (
                <View style={{ ...styles.tagButton, backgroundColor: theme['c-primary-font-active'] }} key={item.id}>
                  <Text style={{ ...styles.tagButtonText, fontWeight: 'bold' }} color={theme['c-content-background']}><TranslatedText text={item.name} replace /></Text>
                </View>
              )
            : (
                <Button
                  style={{ ...styles.tagButton, backgroundColor: theme['c-button-background'] }}
                  key={item.id}
                  onPress={() => { onTagChange(item.name, item.id) }}
                >
                  <Text style={styles.tagButtonText} color={theme['c-button-font']} ><TranslatedText text={item.name} replace /></Text>
                </Button>
              )

        ))}
      </View>
    </View>
  )
}

const styles = createStyle({
  tagTypeTitle: {
    marginTop: 14,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  tagTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagButton: {
    // marginRight: 10,
    borderRadius: 17,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 8,
  },
  tagButtonText: {
    fontSize: 13,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 7,
    paddingBottom: 7,
  },
})
