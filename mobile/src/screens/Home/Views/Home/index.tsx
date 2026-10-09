import { SkeletonChips, SkeletonRail, SkeletonSongRows, SkeletonTitle } from '@/components/common/Skeleton'
import { useSettingValue } from '@/store/setting/hook'
import { getSortList } from '@/core/songlist'
import { saveSongListSetting } from '@/utils/data'
import { TranslatedText } from '@/components/common/TranslatedText'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavReselect } from '@/store/navReselect'
import { ScrollView, View, TouchableOpacity, RefreshControl } from 'react-native'
import { createStyle } from '@/utils/tools'
import { localizeCount } from '@/utils'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { type HomeAlbum, type HomeArtist } from '@/utils/homeCurated'
import { useWindowSize } from '@/utils/hooks'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { Icon } from '@/components/common/Icon'
import { LIST_IDS } from '@/config/constant'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { setNavActiveId } from '@/core/common'
import { getListMusics, setActiveList } from '@/core/list'
import { playList } from '@/core/player/player'
import { setSearchText } from '@/core/search/search'
import { handlePlay as playChartList } from '../Leaderboard/listAction'
import { getListMusicPic } from '@/utils/listMusicPic'
import { getDailyMix, playDailyMix, startFm, fmState, onFmStateChanged } from '@/core/recommend'
import { type CollectionInfo } from '@/screens/Collection/data'
import {
  getCharts, getCached, setCached, getPlaylists, getArtists, getAlbums, getArtistsForYou, type MixedPlaylist, getChartSongs, getHotSearch, getHotTags, getPic, shuffle,
  type TagItem,
} from './data'

// Home page, same content as the desktop app (views/Home): quick play cards, hot searches,
// recommended playlists, hot / new songs, hot artists, new albums. Laid out for a phone:
// horizontal rails for the cards, plain rows for the songs.

type Music = LX.Music.MusicInfoOnline

const SONG_COUNT = 6
const CHIP_COUNT = 30
const CHIP_ROWS = 2
const PADDING = 16
const HERO_COLOR = 'rgba(255, 255, 255, 0.92)'

const getGreetingKey = () => {
  const hour = new Date().getHours()
  if (hour < 5) return 'home__greeting_night'
  if (hour < 12) return 'home__greeting_morning'
  if (hour < 18) return 'home__greeting_afternoon'
  return 'home__greeting_evening'
}

const SectionHeader = memo(({ title, onMore }: { title: string, onMore?: () => void }) => {
  const theme = useTheme()
  const t = useI18n()
  return (
    <View style={styles.sectionHeader}>
      <Text size={20} style={styles.sectionTitle}>{title}</Text>
      {
        onMore
          ? <TouchableOpacity onPress={onMore} hitSlop={styles.hitSlop}>
              <Text size={12} color={theme['c-font-label']}>{t('home__more')}</Text>
            </TouchableOpacity>
          : null
      }
    </View>
  )
})

const HeroCard = memo(({ title, count, songs, cover, width, onPress, onPlay }: {
  title: string
  count: number
  songs: Array<{ id: string, name: string }>
  cover: string | null
  width: number
  onPress: () => void
  onPlay: () => void
}) => {
  const theme = useTheme()
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={{ ...styles.heroCard, width, backgroundColor: theme['c-primary-dark-300'] }}>
      { cover ? <Image url={cover} style={styles.heroBg} /> : null }
      <View style={styles.heroMask} />
      <View style={styles.heroBody}>
        <View>
          <Text size={17} color="#fff" style={styles.heroTitle} numberOfLines={1}><TranslatedText text={title} replace /></Text>
          { count ? <Text size={11} color={HERO_COLOR}>{count}</Text> : null }
        </View>
        <View style={styles.heroFooter}>
          <View style={styles.heroSongs}>
            {songs.slice(0, 3).map((song, index) => (
              <Text key={song.id} size={12} color={HERO_COLOR} numberOfLines={1}>{songs.length > 1 ? `${index + 1}  ` : ''}{song.name}</Text>
            ))}
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={onPlay} style={styles.heroPlay} hitSlop={styles.hitSlop}>
            <Icon name="play" color="#222" size={14} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  )
})

const SongRow = memo(({ song, index, onPress }: { song: Music, index: number, onPress: (index: number) => void }) => {
  const theme = useTheme()
  const handlePress = () => {
    onPress(index)
  }
  // (the songs of Spotify / Deezer found on the main sources come without cover)
  const cover = useSongCover(song)
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={handlePress} style={styles.songRow}>
      <Text size={12} color={theme['c-font-label']} style={styles.songIndex}>{index + 1}</Text>
      <Image url={getPic(cover, 150)} style={styles.songPic} />
      <View style={styles.songInfo}>
        <Text size={14} numberOfLines={1}><TranslatedText text={song.name} /></Text>
        <Text size={12} color={theme['c-font-label']} numberOfLines={1}><TranslatedText text={song.singer} /></Text>
      </View>
      <Text size={12} color={theme['c-font-label']}>{song.interval}</Text>
    </TouchableOpacity>
  )
})

// Cover of a song, looked up when the song has none yet
const useSongCover = (song: Music | undefined) => {
  const [url, setUrl] = useState<string | null>(song?.meta.picUrl ?? null)
  useEffect(() => {
    setUrl(song?.meta.picUrl ?? null)
    if (!song || song.meta.picUrl) return
    return getListMusicPic(song, setUrl)
  }, [song])
  return url
}

// the card of a chart: the cover of its first song (looked for when it has none)
const ChartHero = memo(({ chart, list, width, onOpen, onPlay }: {
  chart: { id: string, name: string }
  list: Music[]
  width: number
  onOpen: (chart: { id: string, name: string }, img: string | null) => void
  onPlay: (list: Music[]) => void
}) => {
  const cover = getPic(useSongCover(list[0]), 300)
  return (
    <HeroCard
      title={chart.name} count={list.length} songs={list} width={width}
      cover={cover} onPress={() => { onOpen(chart, cover) }}
      onPlay={() => { onPlay(list) }}
    />
  )
})

const getText = (text: string) => text
const getTagKey = (tag: TagItem) => tag.id
const getTagName = (tag: TagItem) => tag.name

// Chips laid out on two rows, more of them are reached by scrolling sideways
const ChipRows = <T,>({ items, getKey, getText, onPress }: {
  items: T[]
  getKey: (item: T) => string
  getText: (item: T) => string
  onPress: (item: T) => void
}) => {
  const theme = useTheme()
  const rows = useMemo(() => {
    const rows: T[][] = Array.from({ length: CHIP_ROWS }, () => [])
    items.forEach((item, index) => rows[index % CHIP_ROWS].push(item))
    return rows
  }, [items])

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      <View style={styles.chips0}>
        {rows.map((row, index) => (
          <View key={index} style={styles.chipRow}>
            {row.map(item => (
              <TouchableOpacity key={getKey(item)} activeOpacity={0.6} onPress={() => { onPress(item) }} style={{ ...styles.chip, backgroundColor: theme['c-button-background'] }}>
                <Text size={12} color={theme['c-button-font']} numberOfLines={1}><TranslatedText text={getText(item)} replace /></Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

export default () => {
  const theme = useTheme()
  const t = useI18n()
  const { width: windowWidth } = useWindowSize()
  const charts = useMemo(getCharts, [])
  const [playlists, setPlaylists] = useState<MixedPlaylist[]>(() => getCached('playlists_mixed') ?? [])
  const [artists, setArtists] = useState<HomeArtist[]>(() => getCached('artists_mixed') ?? [])
  const [albums, setAlbums] = useState<HomeAlbum[]>(() => getCached('albums_mixed') ?? [])
  const [forYou, setForYou] = useState<{ seeds: string[], list: HomeArtist[] }>(() => getCached('for_you') ?? { seeds: [], list: [] })
  const [hotSearch, setHotSearch] = useState<string[]>(() => shuffle(getCached<string[]>('hotSearch') ?? []).slice(0, CHIP_COUNT))
  const [chartSongs, setChartSongs] = useState<Record<string, Music[]>>(() => Object.fromEntries(charts.map(c => [c.id, getCached<Music[]>('chart_' + c.id) ?? []])))
  const [loveSongs, setLoveSongs] = useState<LX.Music.MusicInfo[]>([])
  const [refreshing, setRefreshing] = useState(false)
  // the sections that have nothing to show yet get a placeholder while they load for the first time
  const [isLoading, setLoading] = useState(true)
  const customLoveName = useSettingValue('list.loveListName')
  const loveCover = useSettingValue('list.loveListCover')
  const loveName = customLoveName || t('list_name_love')
  const [tags, setTags] = useState<TagItem[]>(() => shuffle(getCached<TagItem[]>('tags') ?? []).slice(0, CHIP_COUNT))
  const [dailyMix, setDailyMix] = useState<Music[]>(() => getCached<Music[]>('dailyMix') ?? [])
  const [fm, setFm] = useState({ ...fmState })
  const mixCover = useSongCover(dailyMix[0])
  const radioCover = useSongCover(dailyMix[1] ?? dailyMix[0])

  const loadAll = useCallback(async(isRefresh = false) => {
    // every section loads on its own, a failed one is just left out
    const run = async<T,>(loader: (isRefresh: boolean) => Promise<T>, apply: (data: T) => void) => loader(isRefresh).then(apply).catch(err => {
      console.log(err)
    })
    await Promise.all([
      run(getPlaylists, setPlaylists),
      run(getArtists, setArtists),
      run(getAlbums, setAlbums),
      run(getArtistsForYou, setForYou),
      // the chips already shown stay as they are, a new pick is made when the page is refreshed
      run(getHotSearch, list => { setHotSearch(prev => prev.length && !isRefresh ? prev : shuffle(list).slice(0, CHIP_COUNT)) }),
      run(getHotTags, list => { setTags(prev => prev.length && !isRefresh ? prev : shuffle(list).slice(0, CHIP_COUNT)) }),
      ...charts.map(async chart => run(async refresh => getChartSongs(chart.id, refresh), list => {
        setChartSongs(songs => ({ ...songs, [chart.id]: list }))
      })),
    ])
  }, [charts])

  useEffect(() => {
    const loadLove = () => {
      void getListMusics(LIST_IDS.LOVE).then(list => { setLoveSongs([...list]) })
    }
    const handleListUpdate = (ids: string[]) => {
      if (ids.includes(LIST_IDS.LOVE)) loadLove()
    }
    loadLove()
    void loadAll().finally(() => { setLoading(false) })
    void getDailyMix().then(list => {
      // an empty mix does not replace the one that is shown
      if (!list.length) return
      setDailyMix(list)
      setCached('dailyMix', list)
    }).catch(err => { console.log(err) })
    const offFmState = onFmStateChanged(setFm)
    global.app_event.on('myListMusicUpdate', handleListUpdate)
    return () => {
      offFmState()
      global.app_event.off('myListMusicUpdate', handleListUpdate)
    }
  }, [loadAll])

  const handleRefresh = useCallback(() => {
    setRefreshing(true)
    void loadAll(true).finally(() => { setRefreshing(false) })
  }, [loadAll])

  const openLoved = useCallback(() => {
    setActiveList(LIST_IDS.LOVE)
    setNavActiveId('nav_love')
    // the library page may not be created yet
    setTimeout(() => {
      global.app_event.libraryListRequested()
    }, 100)
  }, [])
  const playLoved = useCallback(() => {
    if (loveSongs.length) void playList(LIST_IDS.LOVE, 0)
  }, [loveSongs])
  const playMix = useCallback(() => {
    void playDailyMix(dailyMix, 0)
  }, [dailyMix])
  const playRadio = useCallback(() => {
    if (fmState.active || fmState.loading) return
    void startFm()
  }, [])
  const openSetting = useCallback(() => {
    setNavActiveId('nav_setting')
  }, [])
  // a chart card / "more" opens the page of that chart (like the charts tab does)
  const openChart = useCallback((chart: { id: string, name: string }, img?: string | null) => {
    navigations.pushCollectionScreen(commonState.componentIds.home!, { type: 'chart', id: chart.id, name: chart.name, source: chart.id.split('__')[0] as LX.OnlineSource, img: img ?? null })
  }, [])
  const openPlaylists = useCallback(() => {
    setNavActiveId('nav_songlist')
  }, [])
  const openCollection = useCallback((info: CollectionInfo) => {
    navigations.pushCollectionScreen(commonState.componentIds.home!, info)
  }, [])
  // a playlist / album of Spotify / Deezer is a chart (its songs found on the main sources)
  const openHomePlaylist = useCallback((item: MixedPlaylist) => {
    if (item.open == 'chart') openCollection({ type: 'chart', id: item.id, name: item.name, source: item.source as LX.OnlineSource, img: item.img })
    else navigations.pushSonglistDetailScreen(commonState.componentIds.home!, { id: item.id, name: item.name, img: item.img ?? undefined, source: item.source as LX.OnlineSource, author: '', play_count: item.play_count })
  }, [openCollection])
  const openHomeAlbum = useCallback((item: HomeAlbum) => {
    if (item.open == 'chart') openCollection({ type: 'chart', id: item.id, name: item.name, source: item.source as LX.OnlineSource, img: item.img })
    else openCollection({ type: 'album', source: item.source as LX.OnlineSource, id: item.id, name: item.name, img: item.img })
  }, [openCollection])
  const openMix = useCallback(() => {
    openCollection({ type: 'dailyMix' })
  }, [openCollection])
  const openTag = useCallback((tag: TagItem) => {
    // the playlists page reads the saved selection when it is created, the event covers the case where it already exists
    void saveSongListSetting({ source: tag.source, tagId: tag.id, tagName: tag.name, sortId: getSortList(tag.source)[0]?.id ?? '' }).then(() => {
      setNavActiveId('nav_songlist')
      global.app_event.songlistTagRequested(tag.source, tag.name, tag.id)
    })
  }, [])
  const search = useCallback((text: string) => {
    // the search page reads the stored text when it is created, the event covers the case where it already exists
    setSearchText(text)
    setNavActiveId('nav_search')
    global.app_event.searchRequested(text)
  }, [])

  const heroWidth = Math.min(scaleSizeW(250), windowWidth * 0.7)
  const cardWidth = scaleSizeW(118)
  const artistSize = scaleSizeW(72)
  const hotChart = charts[0]
  const newChart = charts[1]

  const songSections = [
    { chart: hotChart, title: t('home__hot_songs') },
    { chart: newChart, title: t('home__new_songs') },
  ]

  // the home tab pressed again: to the top, refreshed when it is there already
  const scrollRef = useRef<ScrollView>(null)
  const scrollYRef = useRef(0)
  useNavReselect('nav_home', () => {
    if (scrollYRef.current > 10) scrollRef.current?.scrollTo({ y: 0, animated: true })
    else handleRefresh()
  })

  return (
    <ScrollView
      ref={scrollRef}
      onScroll={({ nativeEvent }) => { scrollYRef.current = nativeEvent.contentOffset.y }}
      scrollEventThrottle={64}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[theme['c-primary']]} />}
    >
      <View style={styles.top}>
        <Text size={28} style={styles.greeting}>{t(getGreetingKey())}</Text>
        <TouchableOpacity onPress={openSetting} hitSlop={styles.hitSlop} style={styles.settingBtn}>
          <Icon name="setting" size={20} color={theme['c-font-label']} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {
          loveSongs.length
            ? <HeroCard
                title={loveName} count={loveSongs.length} songs={loveSongs} width={heroWidth}
                cover={loveCover || getPic(loveSongs.find(s => s.meta.picUrl)?.meta.picUrl, 300)} onPress={openLoved} onPlay={playLoved}
              />
            : null
        }
        {
          dailyMix.length
            ? <>
                <HeroCard
                  title={t('home__daily_mix')} count={dailyMix.length} songs={dailyMix} width={heroWidth}
                  cover={getPic(mixCover, 300)} onPress={openMix} onPlay={playMix}
                />
                <HeroCard
                  title={t('home__fm')} count={0} songs={[{ id: 'fm', name: t(fm.loading ? 'list_loading' : fm.active ? 'home__fm_playing' : 'home__fm_desc') }]} width={heroWidth}
                  cover={getPic(radioCover, 300)} onPress={playRadio} onPlay={playRadio}
                />
              </>
            : null
        }
        {charts.map(chart => (
          <ChartHero
            key={chart.id} chart={chart} list={chartSongs[chart.id] ?? []} width={heroWidth}
            onOpen={openChart} onPlay={(list) => { void playChartList(chart.id, list, 0) }}
          />
        ))}
      </ScrollView>

      {
        hotSearch.length
          ? <View style={styles.section}>
              <SectionHeader title={t('home__hot_search')} />
              <ChipRows items={hotSearch} getKey={getText} getText={getText} onPress={search} />
            </View>
          : isLoading ? <View style={styles.section}><SkeletonTitle padding={PADDING} /><SkeletonChips padding={PADDING} /></View> : null
      }

      {
        tags.length
          ? <View style={styles.section}>
              <SectionHeader title={t('home__categories')} />
              <ChipRows items={tags} getKey={getTagKey} getText={getTagName} onPress={openTag} />
            </View>
          : isLoading ? <View style={styles.section}><SkeletonTitle padding={PADDING} /><SkeletonChips padding={PADDING} /></View> : null
      }

      {
        // artists for the user: similar to the ones they listen to (Last.fm / Deezer)
        forYou.list.length
          ? <View style={styles.section}>
              <SectionHeader title={t('home__for_you_artists')} />
              <Text size={12} color={theme['c-font-label']} numberOfLines={1} style={styles.sectionSubtitle}>{t('home__for_you_because', { names: forYou.seeds.slice(0, 3).join(', ') })}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {forYou.list.map(item => (
                  <TouchableOpacity key={item.name} activeOpacity={0.7} onPress={() => { openCollection({ type: 'artist', name: item.name, img: item.img }) }} style={{ ...styles.artist, width: artistSize + 8 }}>
                    <Image url={item.img} style={{ width: artistSize, height: artistSize, borderRadius: artistSize / 2 }} />
                    <Text size={12} numberOfLines={1} style={styles.cardTitle}><TranslatedText text={item.name} replace /></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          : null
      }

      {
        playlists.length
          ? <View style={styles.section}>
              <SectionHeader title={t('home__playlists')} onMore={openPlaylists} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {playlists.map(item => (
                  <TouchableOpacity key={`${item.source}_${item.id}`} activeOpacity={0.7} onPress={() => { openHomePlaylist(item) }} style={{ width: cardWidth }}>
                    <Image url={getPic(item.img, 300)} style={{ width: cardWidth, height: cardWidth, borderRadius: 12 }} />
                    <Text size={12} numberOfLines={2} style={styles.cardTitle}><TranslatedText text={item.name} replace /></Text>
                    <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{item.play_count ? `${item.sourceName} · ${localizeCount(item.play_count)}` : item.sourceName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          : isLoading ? <View style={styles.section}><SkeletonTitle padding={PADDING} /><SkeletonRail size={cardWidth} padding={PADDING} /></View> : null
      }

      {songSections.map(({ chart, title }) => {
        const list = (chartSongs[chart.id] ?? []).slice(0, SONG_COUNT)
        if (!list.length) {
          return isLoading
            ? <View key={chart.id} style={styles.section}><SkeletonTitle padding={PADDING} /><SkeletonSongRows count={SONG_COUNT} rowHeight={54} /></View>
            : null
        }
        return (
          <View key={chart.id} style={styles.section}>
            <SectionHeader title={title} onMore={() => { openChart(chart, getPic(list[0]?.meta.picUrl, 300)) }} />
            {list.map((song, index) => (
              <SongRow key={song.id} song={song} index={index} onPress={index => { void playChartList(chart.id, chartSongs[chart.id], index) }} />
            ))}
          </View>
        )
      })}

      {
        artists.length
          ? <View style={styles.section}>
              <SectionHeader title={t('home__artists')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {artists.map(item => (
                  <TouchableOpacity key={`${item.source}_${item.name}`} activeOpacity={0.7} onPress={() => { openCollection({ type: 'artist', name: item.name, img: item.img }) }} style={{ ...styles.artist, width: artistSize + 8 }}>
                    <Image url={getPic(item.img, 200)} style={{ width: artistSize, height: artistSize, borderRadius: artistSize / 2 }} />
                    <Text size={12} numberOfLines={1} style={styles.cardTitle}><TranslatedText text={item.name} replace /></Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          : isLoading ? <View style={styles.section}><SkeletonTitle padding={PADDING} /><SkeletonRail size={artistSize} round padding={PADDING} /></View> : null
      }

      {
        albums.length
          ? <View style={styles.section}>
              <SectionHeader title={t('home__albums')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {albums.map(item => (
                  <TouchableOpacity key={`${item.source}_${item.id}`} activeOpacity={0.7} onPress={() => { openHomeAlbum(item) }} style={{ width: cardWidth }}>
                    <Image url={getPic(item.img, 300)} style={{ width: cardWidth, height: cardWidth, borderRadius: 12 }} />
                    <Text size={12} numberOfLines={2} style={styles.cardTitle}><TranslatedText text={item.name} replace /></Text>
                    <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{`${item.artist} · ${item.sourceName}`}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          : isLoading ? <View style={styles.section}><SkeletonTitle padding={PADDING} /><SkeletonRail size={cardWidth} padding={PADDING} /></View> : null
      }
    </ScrollView>
  )
}

const styles = createStyle({
  sectionSubtitle: {
    paddingHorizontal: PADDING,
    marginTop: -6,
    marginBottom: 8,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 24,
  },
  hitSlop: {
    top: 8,
    bottom: 8,
    left: 8,
    right: 8,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingTop: 10,
    paddingBottom: 12,
  },
  greeting: {
    fontWeight: 'bold',
  },
  settingBtn: {
    padding: 4,
  },
  rail: {
    paddingHorizontal: PADDING,
    gap: 12,
  },
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: 'bold',
  },
  heroCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  heroMask: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  heroBody: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  heroTitle: {
    fontWeight: 'bold',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroSongs: {
    flex: 1,
  },
  heroPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  chips: {
    paddingHorizontal: PADDING,
  },
  chips0: {
    gap: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 17,
  },
  cardTitle: {
    textAlign: 'center',
    marginTop: 6,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: PADDING,
    paddingVertical: 6,
  },
  songIndex: {
    width: 18,
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
  artist: {
    alignItems: 'center',
  },
})
