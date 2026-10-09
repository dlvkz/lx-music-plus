import Image from '@/components/common/Image'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useNavReselect } from '@/store/navReselect'
import { getTabPages } from '@/store/tabPages'
import { FlatList, View, TouchableOpacity } from 'react-native'
import { createStyle, toast, showThemedDialog, confirmDialog } from '@/utils/tools'
import { navigations } from '@/navigation'
import { useCollections, removeCollection, getCollectionKey, type Collection } from '@/core/collect'
import { useWindowSize } from '@/utils/hooks'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useActiveListId, useMyList } from '@/store/list/hook'
import { setLibraryListOpened, setLibraryListScrolled, useLibraryListScrolled } from '@/store/libraryView'
import { playList } from '@/core/player/player'
import { ActionRow, BackButton, DownloadButton, IconButton, PlayButton } from '@/components/common/ActionIcons'
import { hasListCover, setListCover } from '@/utils/listCover'
import { getListMusicPic } from '@/utils/listMusicPic'
import { useSettingValue } from '@/store/setting/hook'
import { useNavActiveId } from '@/store/common/hook'
import Text from '@/components/common/Text'
import ListCover from '@/components/common/ListCover'
import { Icon } from '@/components/common/Icon'
import { TranslatedText } from '@/components/common/TranslatedText'
import { LIST_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'
import { updateSetting } from '@/core/common'
import { getListMusics, setActiveList } from '@/core/list'
import { useDownloadTasks, isSyncList, setListSync, useListDownloadState, downloadRest } from '@/core/download'
import { confirmRemoveDownloads } from '@/core/downloadPrompt'
import { selectFile, privateStorageDirectoryPath } from '@/utils/fs'
import { isBuiltInListId, DEFAULT_LIST_SETTING_KEYS } from '@/utils/listName'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { Navigation } from 'react-native-navigation'
import Mylist from '../Mylist'
import Download from '../Download'
import Stats from './Stats'
import ImportSync from './ImportSync'
import ListNameEdit, { type ListNameEditType } from '../Mylist/MyList/ListNameEdit'
import { handleRemove } from '../Mylist/MyList/listAction'

// Library: the lists (play history, loved, the user's playlists) and the downloads as a grid of squares,
// like the charts. An item opens its song list, the back button returns to the grid.

const COLUMNS = 3
const PADDING = 12
const GAP = 12
const DOWNLOAD_ID = '@download'
// the listening stats (like the stats of Nuclear)
const STATS_ID = '@stats'
// the import of the library of another platform (utils/libraryImport.ts)
const IMPORT_ID = '@import'
const COLLECTION_PREFIX = '@collection:'
const NEW_ID = '@new'

type View_ = 'grid' | 'list' | 'download' | 'stats' | 'import'
interface Item {
  id: string
  name: string
  /** a collected album / artist: the item is a link to its page */
  collection?: Collection
}

const CollectionSquare = memo(({ collection, size, onPress, onLongPress }: {
  collection: Collection
  size: number
  onPress: (collection: Collection) => void
  onLongPress: (collection: Collection) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const isArtist = collection.type == 'artist'
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => { onPress(collection) }} onLongPress={() => { onLongPress(collection) }} style={{ width: size }}>
      <Image url={collection.img} style={{ width: size, height: size, borderRadius: isArtist ? size / 2 : 12 }} />
      <Text size={12} numberOfLines={2} style={styles.name}><TranslatedText text={collection.name} replace /></Text>
      <Text size={11} color={theme['c-font-label']} style={styles.count}>{t(isArtist ? 'collection__type_artist' : 'collection__type_album')}</Text>
    </TouchableOpacity>
  )
})

// Number of songs of a list and the art shown for it: the song added last for the loved list
// (looked up when that song has none yet), the first song with an art for the other lists
const useListSongsInfo = (listId: string) => {
  const [info, setInfo] = useState<{ count: number, cover: string | null }>({ count: 0, cover: null })
  // re-render when a custom cover is set
  useSettingValue('list.loveListCover')
  useSettingValue('list.defaultListCover')

  useEffect(() => {
    let isUnmounted = false
    let cancelPicRequest = () => {}
    const load = () => {
      void getListMusics(listId).then(list => {
        if (isUnmounted) return
        cancelPicRequest()
        if (listId != LIST_IDS.LOVE) {
          setInfo({ count: list.length, cover: list.find(m => m.meta.picUrl)?.meta.picUrl ?? null })
          return
        }
        const songs = settingState.setting['list.addMusicLocationType'] == 'top' ? list : [...list].reverse()
        const latest = songs[0]
        setInfo({ count: list.length, cover: latest?.meta.picUrl ?? songs.find(m => m.meta.picUrl)?.meta.picUrl ?? null })
        if (!latest || latest.meta.picUrl) return
        cancelPicRequest = getListMusicPic(latest, cover => {
          if (!isUnmounted) setInfo({ count: list.length, cover })
        })
      })
    }
    const handleUpdate = (ids: string[]) => {
      if (ids.includes(listId)) load()
    }
    load()
    global.app_event.on('myListMusicUpdate', handleUpdate)
    return () => {
      isUnmounted = true
      cancelPicRequest()
      global.app_event.off('myListMusicUpdate', handleUpdate)
    }
  }, [listId])

  return info
}

const ListSquare = memo(({ item, size, onPress, onLongPress }: {
  item: Item
  size: number
  onPress: (item: Item) => void
  onLongPress: (item: Item) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListSongsInfo(item.id)

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => { onPress(item) }} onLongPress={() => { onLongPress(item) }} style={{ width: size }}>
      <ListCover listId={item.id} cover={info.cover} size={size} />
      <Text size={12} numberOfLines={2} style={styles.name}><TranslatedText text={item.name} replace /></Text>
      <Text size={11} color={theme['c-font-label']} style={styles.count}>{t('collection__songs', { num: info.count })}</Text>
    </TouchableOpacity>
  )
})

const IconSquare = memo(({ icon, name, desc, size, onPress }: {
  icon: string
  name: string
  desc?: string
  size: number
  onPress: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={{ width: size }}>
      <View style={{ ...styles.iconSquare, width: size, height: size, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
        <Icon name={icon} size={size * 0.34} color={theme['c-primary-light-400-alpha-200']} />
      </View>
      <Text size={12} numberOfLines={2} style={styles.name}>{name}</Text>
      { desc ? <Text size={11} color={theme['c-font-label']} style={styles.count}>{desc}</Text> : null }
    </TouchableOpacity>
  )
})

// Header of an opened list, laid out like the playlist pages
const ListHeader = memo(({ onBack, onMenu }: { onBack: () => void, onMenu: (item: Item) => void }) => {
  const theme = useTheme()
  const t = useI18n()
  const lists = useMyList()
  const listId = useActiveListId()
  const info = useListSongsInfo(listId)

  const name = lists.find(l => l.id == listId)?.name ?? ''
  const isScrolled = useLibraryListScrolled()
  useEffect(() => {
    setLibraryListScrolled(false)
  }, [listId])
  const handlePlay = () => {
    if (info.count) void playList(listId, 0)
  }
  // the list is kept downloaded (songs added later included) while the button is on
  useSettingValue('download.syncListIds')
  const isSync = isSyncList(listId)
  const downloadState = useListDownloadState(listId)
  // on: its songs download; a second tap asks to cancel / remove the downloads
  const toggleSync = () => {
    if (!isSync && !downloadState.taskIds.length) {
      void setListSync(listId, true)
      return
    }
    if (!downloadState.taskIds.length) {
      void setListSync(listId, false)
      return
    }
    void confirmRemoveDownloads(name, downloadState, () => {
      void setListSync(listId, true)
      void getListMusics(listId).then(async list => downloadRest(list, listId))
    }).then(removed => {
      if (removed) void setListSync(listId, false)
    })
  }

  if (isScrolled) {
    return (
      <View style={styles.titleBar}>
        <BackButton onPress={onBack} />
        <Text size={17} numberOfLines={1} style={styles.barTitle}><TranslatedText text={name} replace /></Text>
        <PlayButton onPress={handlePlay} disabled={!info.count} size={34} />
      </View>
    )
  }
  return (
    <View>
      <View style={styles.listTop}>
        <BackButton onPress={onBack} />
        <IconButton icon="dots-vertical" size={26} onPress={() => { onMenu({ id: listId, name }) }} />
      </View>
      <View style={styles.listInfo}>
        <ListCover listId={listId} cover={info.cover} size={110} />
        <View style={styles.listInfoText}>
          <Text size={20} numberOfLines={2} style={styles.backTitle}><TranslatedText text={name} replace /></Text>
          <Text size={13} color={theme['c-font-label']}>{t('collection__songs', { num: info.count })}</Text>
          <ActionRow
            left={<DownloadButton active={isSync} done={downloadState.done} downloading={downloadState.downloading} progress={downloadState.progress} partial={downloadState.partial} onPress={toggleSync} />}
            right={<PlayButton onPress={handlePlay} disabled={!info.count} />}
          />
        </View>
      </View>
    </View>
  )
})

const TitleBar = memo(({ title, onBack }: { title: string, onBack: () => void }) => {
  return (
    <View style={styles.titleBar}>
      <BackButton onPress={onBack} />
      <Text size={20} numberOfLines={1} style={styles.backTitle}>{title}</Text>
    </View>
  )
})

export default () => {
  const t = useI18n()
  const { width } = useWindowSize()
  const lists = useMyList()
  const tasks = useDownloadTasks()
  const navActiveId = useNavActiveId()
  const [view, setView] = useState<View_>('grid')
  const listNameEditRef = useRef<ListNameEditType>(null)
  // re-render when a list starts / stops being kept downloaded
  useSettingValue('download.syncListIds')

  useEffect(() => {
    setLibraryListOpened(view != 'grid')
  }, [view])

  const backToGrid = useCallback(() => {
    setView('grid')
  }, [])
  // the library tab pressed again: the opened list / downloads close, the grid goes to its top
  const gridRef = useRef<FlatList>(null)
  useNavReselect('nav_love', () => {
    if (view != 'grid') setView('grid')
    else gridRef.current?.scrollToOffset({ offset: 0, animated: true })
  })
  // pages opened above the home screen (player, album...) handle the back button themselves
  const isHomeVisibleRef = useRef(true)
  const [homeId, setHomeId] = useState(commonState.componentIds.home)
  useEffect(() => {
    const handleIdsUpdated = (ids: CommonState['componentIds']) => {
      setHomeId(ids.home)
    }
    global.state_event.on('componentIdsUpdated', handleIdsUpdated)
    return () => {
      global.state_event.off('componentIdsUpdated', handleIdsUpdated)
    }
  }, [])
  useEffect(() => {
    if (!homeId) return
    const subscription = Navigation.events().registerComponentListener({
      componentDidAppear() {
        isHomeVisibleRef.current = true
      },
      componentDidDisappear() {
        isHomeVisibleRef.current = false
      },
    }, homeId)
    return () => {
      subscription.remove()
    }
  }, [homeId])
  useBackHandler(useCallback(() => {
    if (view == 'grid' || navActiveId != 'nav_love' || !isHomeVisibleRef.current || getTabPages('nav_love').length) return false
    setView('grid')
    return true
  }, [view, navActiveId]))

  // the home page opens the loved list directly
  useEffect(() => {
    const handleOpenList = () => {
      setView('list')
    }
    // the settings open the import of another platform
    const handleOpenImport = () => {
      setView('import')
    }
    // the player opens the downloads / stats (what it plays from)
    const handleOpenView = (view: 'download' | 'stats') => {
      setView(view)
    }
    global.app_event.on('libraryListRequested', handleOpenList)
    global.app_event.on('libraryImportRequested', handleOpenImport)
    global.app_event.on('libraryViewRequested', handleOpenView)
    return () => {
      global.app_event.off('libraryListRequested', handleOpenList)
      global.app_event.off('libraryImportRequested', handleOpenImport)
      global.app_event.off('libraryViewRequested', handleOpenView)
    }
  }, [])

  const openCollection = useCallback((collection: Collection) => {
    navigations.pushCollectionScreen(commonState.componentIds.home!, collection.type == 'artist'
      ? { type: 'artist', name: collection.id, img: collection.img }
      : { type: 'album', source: collection.source, id: collection.id, name: collection.name, img: collection.img })
  }, [])
  const showCollectionMenu = useCallback((collection: Collection) => {
    void confirmDialog({ message: t('collection__remove_tip', { name: collection.name }) }).then(confirmed => {
      if (confirmed) removeCollection(collection)
    })
  }, [t])

  const openList = useCallback((item: Item) => {
    setActiveList(item.id)
    setView('list')
  }, [])

  const showMenu = useCallback((item: Item) => {
    const listInfo = lists.find(l => l.id == item.id)
    if (!listInfo) return
    const isBuiltIn = isBuiltInListId(item.id)
    const isSync = isSyncList(item.id)
    type Action = 'rename' | 'cover' | 'reset' | 'sync' | 'remove'
    const buttons: Array<{ text: string, value: Action }> = [
      { text: t('list_rename'), value: 'rename' },
    ]
    buttons.push({ text: t('list_change_cover'), value: 'cover' })
    if (isBuiltIn) {
      const keys = DEFAULT_LIST_SETTING_KEYS[item.id as keyof typeof DEFAULT_LIST_SETTING_KEYS]
      if (settingState.setting[keys.name] || settingState.setting[keys.cover]) buttons.push({ text: t('list_reset_custom'), value: 'reset' })
    } else if (hasListCover(item.id)) buttons.push({ text: t('list_reset_cover'), value: 'reset' })
    buttons.push({ text: t(isSync ? 'download__sync_off' : 'download__sync_on'), value: 'sync' })
    if (!isBuiltIn) buttons.push({ text: t('list_remove'), value: 'remove' })

    void showThemedDialog<Action>({ title: item.name, vertical: true, buttons }).then(async action => {
      switch (action) {
        case 'rename':
          listNameEditRef.current?.show(listInfo as LX.List.UserListInfo)
          break
        case 'cover': {
          const file = await selectFile({ extTypes: ['jpg', 'jpeg', 'png', 'webp'], toPath: privateStorageDirectoryPath })
          if (!file?.data) break
          if (isBuiltInListId(item.id)) updateSetting({ [DEFAULT_LIST_SETTING_KEYS[item.id].cover]: file.data })
          else void setListCover(item.id, file.data)
          break
        }
        case 'reset':
          if (isBuiltInListId(item.id)) {
            const keys = DEFAULT_LIST_SETTING_KEYS[item.id]
            updateSetting({ [keys.name]: '', [keys.cover]: '' })
          } else void setListCover(item.id, null)
          break
        case 'sync':
          await setListSync(item.id, !isSync)
          toast(t(isSync ? 'download__sync_off_tip' : 'download__sync_on_tip'))
          break
        case 'remove':
          handleRemove(listInfo as LX.List.UserListInfo)
          break
      }
    })
  }, [lists, t])

  const size = Math.floor((width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS)
  const collections = useCollections()
  // the tiles that are always there first (downloads, stats, import, create, the built-in lists), then what was
  // saved (the lists made / collected, the albums and artists)
  const userLists = lists.filter(l => l.id != LIST_IDS.TEMP)
  const isBuiltIn = (id: string) => id == LIST_IDS.DEFAULT || id == LIST_IDS.LOVE
  const items: Item[] = [
    { id: DOWNLOAD_ID, name: t('nav_download') },
    { id: STATS_ID, name: t('stats__title') },
    { id: IMPORT_ID, name: t('import__nav') },
    { id: NEW_ID, name: t('list_create') },
    ...userLists.filter(l => isBuiltIn(l.id)).map(l => ({ id: l.id, name: l.name })),
    ...userLists.filter(l => !isBuiltIn(l.id)).map(l => ({ id: l.id, name: l.name })),
    ...collections.map(c => ({ id: COLLECTION_PREFIX + getCollectionKey(c.type, c.source, c.id), name: c.name, collection: c })),
  ]

  return (
    <View style={styles.container}>
      {
        view == 'grid'
          ? <FlatList
              ref={gridRef}
              style={styles.container}
              contentContainerStyle={styles.content}
              columnWrapperStyle={styles.row}
              data={items}
              numColumns={COLUMNS}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                switch (item.id) {
                  case DOWNLOAD_ID:
                    return <IconSquare icon="download-2" name={item.name} desc={t('collection__songs', { num: tasks.filter(task => task.status == 'completed').length })} size={size} onPress={() => { setView('download') }} />
                  case STATS_ID:
                    return <IconSquare icon="music_time" name={item.name} size={size} onPress={() => { setView('stats') }} />
                  case IMPORT_ID:
                    return <IconSquare icon="add_folder" name={item.name} size={size} onPress={() => { setView('import') }} />
                  case NEW_ID:
                    return <IconSquare icon="add-music" name={item.name} size={size} onPress={() => { listNameEditRef.current?.showCreate(lists.length) }} />
                  default:
                    if (item.collection) return <CollectionSquare collection={item.collection} size={size} onPress={openCollection} onLongPress={showCollectionMenu} />
                    return <ListSquare item={item} size={size} onPress={openList} onLongPress={showMenu} />
                }
              }}
            />
          : (
              <>
                {
                  view == 'download'
                    ? <TitleBar title={t('nav_download')} onBack={backToGrid} />
                    : view == 'stats'
                      ? <TitleBar title={t('stats__title')} onBack={backToGrid} />
                      : view == 'import'
                        ? <TitleBar title={t('import__nav')} onBack={backToGrid} />
                        : <ListHeader onBack={backToGrid} onMenu={showMenu} />
                }
                { view == 'download' ? <Download /> : view == 'stats' ? <Stats /> : view == 'import' ? <ImportSync /> : <Mylist /> }
              </>
            )
      }
      <ListNameEdit ref={listNameEditRef} />
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PADDING,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 14,
  },
  row: {
    gap: GAP,
  },
  name: {
    marginTop: 5,
    textAlign: 'center',
  },
  count: {
    textAlign: 'center',
  },
  iconSquare: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTitle: {
    fontWeight: 'bold',
  },
  barTitle: {
    flex: 1,
    fontWeight: 'bold',
    marginHorizontal: 6,
  },
  listTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
    paddingRight: 14,
    paddingTop: 4,
  },
  listInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 10,
  },
  listCover: {
    width: 76,
    height: 76,
    borderRadius: 12,
  },
  listActions: {
    flexDirection: 'row',
    marginTop: 6,
  },
  listInfoText: {
    flex: 1,
    gap: 4,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
})
