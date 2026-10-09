import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { getListMusicPic } from '@/utils/listMusicPic'
import { memo, useEffect, useMemo, useState } from 'react'
import { ScrollView, View, TouchableOpacity } from 'react-native'
import { createStyle, confirmDialog } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { useMyList } from '@/store/list/hook'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { TranslatedText } from '@/components/common/TranslatedText'
import { LIST_IDS } from '@/config/constant'
import { getListMusics, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { useDownloadTasks, removeDownloads, retryDownloads, type DownloadTask } from '@/core/download'
import { loadDownloadPics, useDownloadPics } from '@/core/downloadPics'

// Downloads page, laid out like the desktop one (views/Download/Library.vue):
// the playlists that are kept downloaded, the albums and the songs.

const PADDING = 16
const PAGE_SIZE = 60

interface Filter {
  title: string
  ids: Set<string>
}

const ListCard = memo(({ listId, name, tasks, size, onPress }: {
  listId: string
  name: string
  tasks: DownloadTask[]
  size: number
  onPress: (filter: Filter) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const [ids, setIds] = useState<Set<string>>(new Set())
  const [cover, setCover] = useState<string | null>(null)

  useEffect(() => {
    const load = () => {
      void getListMusics(listId).then(list => {
        setIds(new Set(list.map(m => m.id)))
        setCover(list.find(m => m.meta.picUrl)?.meta.picUrl ?? null)
      })
    }
    const handleUpdate = (updatedIds: string[]) => {
      if (updatedIds.includes(listId)) load()
    }
    load()
    global.app_event.on('myListMusicUpdate', handleUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleUpdate)
    }
  }, [listId])

  const done = useMemo(() => tasks.filter(task => task.status == 'completed' && ids.has(task.id)).length, [tasks, ids])

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => { onPress({ title: name, ids }) }} style={{ width: size }}>
      <Image url={cover} style={{ width: size, height: size, borderRadius: 12 }} />
      <Text size={12} numberOfLines={2} style={styles.cardTitle}><TranslatedText text={name} replace /></Text>
      <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{t('download__progress', { done, total: ids.size })}</Text>
    </TouchableOpacity>
  )
})

const SongRow = memo(({ task, index, pic, onPress, onLongPress }: {
  task: DownloadTask
  index: number
  pic: string | null
  onPress: (task: DownloadTask) => void
  onLongPress: (task: DownloadTask) => void
}) => {
  const theme = useTheme()
  const t = useI18n()
  const { musicInfo } = task
  let status = ''
  switch (task.status) {
    case 'running': status = `${task.progress}%`; break
    case 'waiting': status = t('download__waiting'); break
    case 'error': status = t('download__failed'); break
  }
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => { onPress(task) }} onLongPress={() => { onLongPress(task) }} style={styles.songRow}>
      <Text size={12} color={theme['c-font-label']} style={styles.songIndex}>{index + 1}</Text>
      <Image url={musicInfo.meta.picUrl ?? pic} style={styles.songPic} />
      <View style={styles.songInfo}>
        <Text size={14} numberOfLines={1}><TranslatedText text={musicInfo.name} /></Text>
        <Text size={12} color={theme['c-font-label']} numberOfLines={1}><TranslatedText text={`${musicInfo.singer}${musicInfo.meta.albumName ? ` · ${musicInfo.meta.albumName}` : ''}`} /></Text>
      </View>
      <Text size={12} color={task.status == 'error' ? theme['c-primary-font'] : theme['c-font-label']}>{status || musicInfo.interval}</Text>
    </TouchableOpacity>
  )
})

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const tasks = useDownloadTasks()
  const lists = useMyList()
  const syncListIds = useSettingValue('download.syncListIds')
  const [filter, setFilter] = useState<Filter | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const syncLists = useMemo(() => {
    const ids = syncListIds ? syncListIds.split(',') : []
    return ids.map(id => lists.find(l => l.id == id)).filter((l): l is typeof lists[number] => !!l)
  }, [syncListIds, lists])

  const [albumPics, setAlbumPics] = useState<Record<string, string>>({})
  // songs downloaded without a cover link: the cover in their file, or the one found online
  const songPics = useDownloadPics()
  const albums = useMemo(() => {
    const map = new Map<string, { key: string, name: string, img: string | null, ids: Set<string> }>()
    for (const task of tasks) {
      const { id, singer, source, meta } = task.musicInfo
      if (!meta.albumName) continue
      const key = meta.albumId ? `${source}_${meta.albumId}` : `${meta.albumName}_${singer}`
      let album = map.get(key)
      if (!album) map.set(key, album = { key, name: meta.albumName, img: null, ids: new Set() })
      album.ids.add(id)
      album.img ??= meta.picUrl ?? (songPics[task.id] || null)
    }
    // songs downloaded without a cover: the one of their album is looked up
    for (const album of map.values()) {
      if (album.img) continue
      album.img = albumPics[album.key] ?? null
    }
    return Array.from(map.values())
  }, [tasks, albumPics, songPics])
  useEffect(() => {
    const cancels: Array<() => void> = []
    for (const task of tasks) {
      const { source, singer, meta } = task.musicInfo
      if (!meta.albumName || meta.picUrl) continue
      const key = meta.albumId ? `${source}_${meta.albumId}` : `${meta.albumName}_${singer}`
      if (albumPics[key] || requestedPics.has(key)) continue
      requestedPics.add(key)
      cancels.push(getListMusicPic(task.musicInfo, url => {
        setAlbumPics(pics => ({ ...pics, [key]: url }))
      }))
    }
    return () => { for (const cancel of cancels) cancel() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const songs = useMemo(() => filter ? tasks.filter(task => filter.ids.has(task.id)) : tasks, [tasks, filter])
  const visibleSongs = useMemo(() => songs.slice(0, visibleCount), [songs, visibleCount])
  useEffect(() => {
    loadDownloadPics(visibleSongs)
  }, [visibleSongs])
  // a song without a cover shows the one of its album meanwhile
  const albumImgs = useMemo(() => {
    const imgs = new Map<string, string>()
    for (const album of albums) if (album.img) for (const id of album.ids) imgs.set(id, album.img)
    return imgs
  }, [albums])
  const cardSize = scaleSizeW(112)

  const handlePlay = (task: DownloadTask) => {
    if (task.status == 'error') {
      retryDownloads([task.id])
      return
    }
    if (task.status != 'completed') return
    const list = songs.filter(t => t.status == 'completed').map(t => t.musicInfo)
    void setTempList(`download_${filter?.title ?? 'all'}`, list).then(() => {
      void playList(LIST_IDS.TEMP, list.findIndex(m => m.id == task.id))
    })
  }
  // play all / shuffle: the downloaded songs
  const completedSongs = useMemo(() => tasks.filter(t => t.status == 'completed').map(t => t.musicInfo), [tasks])
  const playAll = (isRandom: boolean) => {
    if (!completedSongs.length) return
    if (isRandom && settingState.setting['player.togglePlayMethod'] != 'random') updateSetting({ 'player.togglePlayMethod': 'random' })
    void setTempList('download_all', [...completedSongs]).then(() => {
      void playList(LIST_IDS.TEMP, isRandom ? Math.floor(Math.random() * completedSongs.length) : 0)
    })
  }
  const handleRemove = (task: DownloadTask) => {
    void confirmDialog({
      message: t('download__remove_tip', { name: task.musicInfo.name }),
      confirmButtonText: t('download__remove'),
    }).then(confirmed => {
      if (confirmed) void removeDownloads([task.id])
    })
  }
  const showFilter = (filter: Filter) => {
    setVisibleCount(PAGE_SIZE)
    setFilter(filter)
  }

  const isEmpty = !tasks.length && !syncLists.length

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {
        filter
          ? <TouchableOpacity onPress={() => { setFilter(null) }} style={styles.filterHeader} activeOpacity={0.6}>
              <Icon name="chevron-left" size={16} />
              <Text size={17} numberOfLines={1} style={styles.filterTitle}><TranslatedText text={filter.title} replace /></Text>
            </TouchableOpacity>
          : <>
              {
                completedSongs.length
                  ? <View style={styles.playBtns}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => { playAll(false) }} style={{ ...styles.playBtn, backgroundColor: theme['c-button-background'] }}>
                        <Icon name="play" size={12} color={theme['c-button-font']} />
                        <Text size={13} color={theme['c-button-font']}>{t('play_all')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => { playAll(true) }} style={{ ...styles.playBtn, backgroundColor: theme['c-button-background'] }}>
                        <Icon name="list-random" size={12} color={theme['c-button-font']} />
                        <Text size={13} color={theme['c-button-font']}>{t('play_random')}</Text>
                      </TouchableOpacity>
                    </View>
                  : null
              }
              {
                syncLists.length
                  ? <View style={styles.section}>
                      <Text size={16} style={styles.sectionTitle}>{t('download__playlists')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                        {syncLists.map(list => <ListCard key={list.id} listId={list.id} name={list.name} tasks={tasks} size={cardSize} onPress={showFilter} />)}
                      </ScrollView>
                    </View>
                  : null
              }
              {
                albums.length
                  ? <View style={styles.section}>
                      <Text size={16} style={styles.sectionTitle}>{t('download__albums')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                        {albums.map(album => (
                          <TouchableOpacity key={album.key} activeOpacity={0.7} onPress={() => { showFilter({ title: album.name, ids: album.ids }) }} style={{ width: cardSize }}>
                            <Image url={album.img} style={{ width: cardSize, height: cardSize, borderRadius: 12 }} />
                            <Text size={12} numberOfLines={2} style={styles.cardTitle}><TranslatedText text={album.name} replace /></Text>
                            <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{t('collection__songs', { num: album.ids.size })}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  : null
              }
            </>
      }
      {
        songs.length
          ? <View style={styles.section}>
              { filter ? null : <Text size={16} style={styles.sectionTitle}>{t('download__songs')}</Text> }
              {visibleSongs.map((task, index) => <SongRow key={task.id} task={task} index={index} pic={songPics[task.id] ? songPics[task.id] : albumImgs.get(task.id) ?? null} onPress={handlePlay} onLongPress={handleRemove} />)}
              {
                songs.length > visibleCount
                  ? <TouchableOpacity onPress={() => { setVisibleCount(count => count + PAGE_SIZE) }} style={styles.moreBtn}>
                      <Text size={13} color={theme['c-font-label']}>{t('home__more')}</Text>
                    </TouchableOpacity>
                  : null
              }
            </View>
          : null
      }
      { isEmpty ? <Text size={13} color={theme['c-font-label']} style={styles.empty}>{t('download__empty')}</Text> : null }
    </ScrollView>
  )
}

const requestedPics = new Set<string>()

const styles = createStyle({
  playBtns: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: 'bold',
    paddingHorizontal: PADDING,
    marginBottom: 10,
  },
  rail: {
    paddingHorizontal: PADDING,
    gap: 12,
  },
  cardTitle: {
    marginTop: 6,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: PADDING,
    paddingVertical: 10,
  },
  filterTitle: {
    flex: 1,
    fontWeight: 'bold',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: PADDING,
    paddingVertical: 6,
  },
  songIndex: {
    width: 22,
    textAlign: 'center',
  },
  songPic: {
    width: 42,
    height: 42,
    borderRadius: 4,
  },
  songInfo: {
    flex: 1,
  },
  moreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  empty: {
    textAlign: 'center',
    paddingHorizontal: 30,
    paddingTop: 80,
    lineHeight: 20,
  },
})
