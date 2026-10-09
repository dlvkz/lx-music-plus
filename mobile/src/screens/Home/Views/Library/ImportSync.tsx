import { useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import Import from './Import'
import Sync from './Sync'

// One page for the import of other platforms and the sync with the computer (like the desktop app)

type Tab = 'import' | 'sync'

export default ({ initialTab = 'import' }: { initialTab?: Tab }) => {
  const t = useI18n()
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>(initialTab)
  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['import', 'sync'] as const).map(item => (
          <TouchableOpacity key={item} activeOpacity={0.7} onPress={() => { setTab(item) }}
            style={{ ...styles.tab, borderBottomColor: item == tab ? theme['c-primary'] : 'transparent' }}>
            <Text size={15} color={item == tab ? theme['c-font'] : theme['c-font-label']}>{t(item == 'import' ? 'import__tab_import' : 'import__tab_sync')}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab == 'import' ? <Import /> : <Sync />}
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 18,
  },
  tab: {
    paddingVertical: 6,
    borderBottomWidth: 2,
  },
})
