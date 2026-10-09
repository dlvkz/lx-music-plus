import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { View, TouchableOpacity, type ImageSourcePropType } from 'react-native'
import { setTheme } from '@/core/theme'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { useSettingValue } from '@/store/setting/hook'
import { useTheme } from '@/store/theme/hook'

import SubTitle from '../../components/SubTitle'
import { BG_IMAGES, USER_THEME_ID_PREFIX, createImageTheme, getAllThemes, getThemeImageUri, removeTheme, type LocalTheme } from '@/theme/themes'
import { mkdir, moveFile, selectFile, unlink } from '@/utils/fs'
import { confirmDialog, createStyle, showThemedDialog, toast } from '@/utils/tools'
import settingState from '@/store/setting/state'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { Icon } from '@/components/common/Icon'
import ImageBackground from '@/components/common/ImageBackground'

const useActive = (id: string) => {
  const activeThemeId = useSettingValue('theme.id')
  const isActive = useMemo(() => activeThemeId == id, [activeThemeId, id])
  return isActive
}

const ThemeItem = ({ id, name, color, image, setTheme, showAll, onLongPress }: {
  id: string
  name: string
  color: string
  showAll: boolean
  image?: ImageSourcePropType
  setTheme: (id: string) => void
  onLongPress?: (id: string) => void
}) => {
  const theme = useTheme()
  const isActive = useActive(id)

  return (
    showAll || isActive ? (
      <TouchableOpacity style={{ ...styles.item, width: scaleSizeH(ITEM_HEIGHT) }} activeOpacity={0.5} onPress={() => { setTheme(id) }} onLongPress={onLongPress ? () => { onLongPress(id) } : undefined}>
        <View style={{ ...styles.colorContent, width: scaleSizeH(COLOR_ITEM_HEIGHT), borderColor: isActive ? color : 'transparent' }}>
          {
            image
              ? <ImageBackground style={{ ...styles.imageContent, width: scaleSizeH(IMAGE_HEIGHT), backgroundColor: color }}
                  imageStyle={{ borderRadius: 4 }}
                  source={image} />
              : <View style={{ ...styles.imageContent, width: scaleSizeH(IMAGE_HEIGHT), backgroundColor: color }}></View>
            }
        </View>
        <Text style={styles.name} size={12} color={isActive ? color : theme['c-font']} numberOfLines={1}>{name}</Text>
      </TouchableOpacity>
    ) : null
  )
}

const MoreBtn = ({ showAll, setShowAll }: {
  showAll: boolean
  setShowAll: (showAll: boolean) => void
}) => {
  const theme = useTheme()
  const t = useI18n()

  return (
    showAll ? null
      : (
          <TouchableOpacity style={styles.moreBtn} activeOpacity={0.5} onPress={() => { setShowAll(!showAll) }}>
            <Text size={14} color={theme['c-primary-font']} numberOfLines={1}>{t('setting_basic_theme_more_btn_show')}</Text>
            <Icon name="chevron-right" size={12} color={theme['c-primary-font']} />
          </TouchableOpacity>
        )

  )
}

// Someone who picks a theme wants that theme: following the light / dark mode of the system
// (which shows the black theme in dark mode) is turned off with it
const selectTheme = (id: string) => {
  if (settingState.setting['common.isAutoTheme']) updateSetting({ 'common.isAutoTheme': false })
  setTheme(id)
}

interface ThemeInfo {
  themes: Readonly<LocalTheme[]>
  userThemes: LX.Theme[]
  dataPath: string
}
const initInfo: ThemeInfo = { themes: [], userThemes: [], dataPath: '' }
export default memo(() => {
  const [showAll, setShowAll] = useState(false)
  const t = useI18n()
  const [themeInfo, setThemeInfo] = useState(initInfo)
  const setThemeId = useCallback((id: string) => {
    requestAnimationFrame(() => {
      selectTheme(id)
    })
  }, [])

  const theme = useTheme()
  const loadThemes = useCallback(() => {
    void getAllThemes().then(info => {
      setThemeInfo({ ...info, userThemes: [...info.userThemes] })
    })
  }, [])
  useEffect(loadThemes, [loadThemes])

  // a picture picked by the user becomes a theme
  const handleAddTheme = useCallback(() => {
    void (async() => {
      const { dataPath, userThemes } = await getAllThemes()
      await mkdir(dataPath).catch(() => {})
      const file = await selectFile({ extTypes: ['jpg', 'jpeg', 'png', 'webp'], toPath: dataPath })
      if (!file?.data) return
      const isDark = await showThemedDialog<boolean>({
        title: t('theme_add_style_title'),
        buttons: [
          { text: t('theme_add_style_light'), value: false },
          { text: t('theme_add_style_dark'), value: true },
        ],
      })
      if (isDark == null) {
        void unlink(file.data).catch(() => {})
        return
      }
      const id = `${USER_THEME_ID_PREFIX}${Date.now()}`
      const ext = /\.(\w+)$/.exec(file.data)?.[1] ?? 'jpg'
      const image = `${id}.${ext}`
      await moveFile(file.data, `${dataPath}/${image}`)
      let num = userThemes.length + 1
      const names = new Set(userThemes.map(theme => theme.name))
      while (names.has(`${t('theme_custom')} ${num}`)) num++
      await createImageTheme(id, `${t('theme_custom')} ${num}`, image, isDark)
      loadThemes()
      selectTheme(id)
    })().catch((err: Error) => {
      toast(err.message)
    })
  }, [loadThemes, t])

  const handleRemoveTheme = useCallback((id: string) => {
    void (async() => {
      const { dataPath, userThemes } = await getAllThemes()
      const target = userThemes.find(theme => theme.id == id)
      if (!target) return
      if (!await confirmDialog({ message: t('theme_remove_tip', { name: target.name }) })) return
      if (settingState.setting['theme.id'] == id) setTheme('china_ink')
      const image = target.config.extInfo['bg-image']
      await removeTheme(id)
      if (image && !image.includes('/')) void unlink(`${dataPath}/${image}`).catch(() => {})
      loadThemes()
    })()
  }, [loadThemes, t])

  return (
    <SubTitle title={t('setting_basic_theme')}>
      <View style={styles.list}>
        {
          themeInfo.themes.map(({ id, config }) => {
            return <ThemeItem
              key={id}
              color={config.themeColors['c-theme']}
              image={config.extInfo['bg-image'] ? BG_IMAGES[config.extInfo['bg-image']] : undefined}
              showAll={showAll}
              id={id}
              name={t(`theme_${id}`)}
              setTheme={setThemeId} />
          })
        }
        {
          themeInfo.userThemes.map(({ id, name, config }) => {
            return <ThemeItem
              key={id}
              color={config.themeColors['c-theme']}
              image={config.extInfo['bg-image'] ? { uri: getThemeImageUri(config.extInfo['bg-image']) } : undefined}
              showAll={showAll}
              id={id}
              name={name}
              setTheme={setThemeId}
              onLongPress={handleRemoveTheme} />
          })
        }
        {
          showAll
            ? <TouchableOpacity style={{ ...styles.item, width: scaleSizeH(ITEM_HEIGHT) }} activeOpacity={0.5} onPress={handleAddTheme}>
                <View style={{ ...styles.colorContent, width: scaleSizeH(COLOR_ITEM_HEIGHT), borderColor: 'transparent' }}>
                  <View style={{ ...styles.imageContent, ...styles.addContent, width: scaleSizeH(IMAGE_HEIGHT), backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
                    <Text size={18} color={theme['c-font-label']}>+</Text>
                  </View>
                </View>
                <Text style={styles.name} size={12} numberOfLines={1}>{t('theme_add')}</Text>
              </TouchableOpacity>
            : null
        }
        <MoreBtn showAll={showAll} setShowAll={setShowAll} />
      </View>
    </SubTitle>
  )
})

const ITEM_HEIGHT = 62
const COLOR_ITEM_HEIGHT = 36
const IMAGE_HEIGHT = 29
const styles = createStyle({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 5,
  },
  item: {
    // marginRight: 15,
    alignItems: 'center',
    // marginTop: 5,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  colorContent: {
    height: COLOR_ITEM_HEIGHT,
    borderRadius: 4,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  addContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContent: {
    height: IMAGE_HEIGHT,
    borderRadius: 4,
    // elevation: 1,
  },
  name: {
    marginTop: 2,
  },
  moreBtn: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'center',
    gap: 8,
  },
})
