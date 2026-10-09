import { TranslatedText } from '@/components/common/TranslatedText'
import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { forwardRef, useImperativeHandle, useState } from 'react'


export interface CurrentTagBtnProps {
  onShowList: () => void
}

export interface CurrentTagBtnType {
  setCurrentTagInfo: (name: string) => void
}

export default forwardRef<CurrentTagBtnType, CurrentTagBtnProps>(({ onShowList }, ref) => {
  const t = useI18n()
  const [name, setName] = useState('')
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    setCurrentTagInfo(name) {
      if (!name) name = t('songlist_tag_default')
      setName(name)
    },
  }))

  return (
    <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={onShowList}>
      <Text size={13} numberOfLines={1} color={theme['c-button-font']} style={styles.sourceMenu}><TranslatedText text={name} replace /></Text>
      <Icon name="chevron-right" size={9} color={theme['c-button-font']} style={styles.arrow} />
    </Button>
  )
})


const styles = createStyle({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    maxWidth: 170,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  // points down: the category opens a list
  arrow: {
    transform: [{ rotate: '90deg' }],
  },
  sourceMenu: {
    // height: 38,
    // lineHeight: 38,
    flexShrink: 1,
    textAlign: 'center',
    // minWidth: 70,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
})
