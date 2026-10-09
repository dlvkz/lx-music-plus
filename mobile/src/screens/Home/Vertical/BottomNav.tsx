import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { useI18n } from '@/lang'
import { useNavActiveId } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'
import { useKeyboard } from '@/utils/hooks'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { NAV_MENUS, type NAV_ID_Type } from '@/config/constant'
import { setNavActiveId } from '@/core/common'
import { emitNavReselect } from '@/store/navReselect'

// Bottom tab bar of the phone layout (the pages used to be reachable from the side drawer only)

const TAB_MENUS = NAV_MENUS.filter(menu => menu.id != 'nav_setting')

const NavItem = memo(({ id, icon, active, onPress }: {
  id: NAV_ID_Type
  icon: string
  active: boolean
  onPress: (id: NAV_ID_Type) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const color = active ? theme['c-font'] : theme['c-font-label']
  return (
    <TouchableOpacity style={styles.item} activeOpacity={0.6} onPress={() => { onPress(id) }}>
      <View style={{ ...styles.iconPill, backgroundColor: active ? theme['c-primary-light-400-alpha-700'] : 'transparent' }}>
        <Icon name={icon} size={18} color={color} />
      </View>
      <Text size={10} color={color} numberOfLines={1} style={active ? styles.labelActive : styles.label}>{t(`${id}_short`)}</Text>
    </TouchableOpacity>
  )
})

export default memo(() => {
  const theme = useTheme()
  const activeId = useNavActiveId()
  const { keyboardShown } = useKeyboard()

  const handlePress = (id: NAV_ID_Type) => {
    if (id == activeId) {
      // the open tab: back to its start
      emitNavReselect(id)
      return
    }
    global.app_event.changeMenuVisible(false)
    setNavActiveId(id)
  }

  if (keyboardShown) return null
  return (
    <View style={{ ...styles.container, backgroundColor: theme['c-content-background'] }}>
      {TAB_MENUS.map(menu => <NavItem key={menu.id} id={menu.id} icon={menu.icon} active={activeId == menu.id} onPress={handlePress} />)}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    paddingBottom: 3,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  iconPill: {
    width: 54,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 2,
  },
  labelActive: {
    marginTop: 2,
    fontWeight: 'bold',
  },
})
