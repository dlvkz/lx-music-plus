import { SkeletonGrid } from '@/components/common/Skeleton'
import { getCache, setCache } from '@/utils/dataCache'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useNavReselect } from '@/store/navReselect'
import { FlatList, View, TouchableOpacity, Pressable } from 'react-native'
import { createStyle } from '@/utils/tools'
import { useWindowSize } from '@/utils/hooks'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import commonState from '@/store/common/state'
import leaderboardState, { type BoardItem } from '@/store/leaderboard/state'
import { getBoardsList } from '@/core/leaderboard'
import { getBoardCovers, getBoardSongCover } from '@/core/leaderboardCovers'
import { CHART_SOURCES, CHART_SOURCE_NAMES, isChartSource, isChartSourceReachable } from '@/utils/chartSources'
import { navigations } from '@/navigation'
import { TranslatedText } from '@/components/common/TranslatedText'

// The charts of every platform in one grid, mixed (the charts of each platform in turns, their first ones
// first); the platforms shown are chosen in the menu at the top (all of them by default but the ones that can't
// be reached on the first run, kept). A chart opens
// as a song list page.

const COLUMNS = 3
const CACHE_KEY = 'charts_all'
const SELECTED_KEY = 'charts_platforms'
const PADDING = 12
const GAP = 12
const MAIN_SOURCES = ['wy', 'kw', 'tx', 'kg', 'mg']

interface ChartItem extends BoardItem {
  pic?: string | null
}
// the charts of each platform
type Lists = Record<string, ChartItem[]>

const Item = memo(({ item, size, platform, onPress }: { item: ChartItem, size: number, platform: string, onPress: (item: ChartItem) => void }) => {
  const theme = useTheme()
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => { onPress(item) }} style={{ width: size }}>
      <Image url={item.pic} style={{ width: size, height: size, borderRadius: 12 }} />
      <Text size={12} numberOfLines={2} style={styles.name}><TranslatedText text={item.name} replace /></Text>
      <Text size={10} numberOfLines={1} color={theme['c-font-label']} style={styles.platform}>{platform}</Text>
    </TouchableOpacity>
  )
})

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const { width } = useWindowSize()
  const platforms = useMemo(() => [
    ...MAIN_SOURCES.filter(source => leaderboardState.sources.includes(source as LX.OnlineSource)),
    ...CHART_SOURCES,
  ], [])
  const platformName = (source: string) => isChartSource(source) ? CHART_SOURCE_NAMES[source] : t(`source_real_${source as LX.OnlineSource}`)

  // the platforms shown (all of them by default)
  // saved: the platforms shown and the ones known then (a platform added since is shown)
  const [selected, setSelected] = useState<string[]>(() => {
    const saved = getCache<{ selected: string[], known: string[] }>(SELECTED_KEY)
    if (!Array.isArray(saved?.selected)) return platforms
    return platforms.filter(id => saved.selected.includes(id) || !saved.known?.includes(id))
  })
  // first run (nothing saved): the platforms of the West that can't be reached (blocked: mainland China) are
  // unchecked once the charts are loaded
  const isFirstRunRef = useRef(!Array.isArray(getCache<{ selected: string[] }>(SELECTED_KEY)?.selected))
  const [isShowMenu, setShowMenu] = useState(false)
  const updateSelected = (list: string[]) => {
    isFirstRunRef.current = false
    setSelected(list)
    setCache(SELECTED_KEY, { selected: list, known: platforms })
  }
  const togglePlatform = (id: string) => {
    if (selected.includes(id)) updateSelected(selected.filter(p => p != id))
    else updateSelected(platforms.filter(p => p == id || selected.includes(p)))
  }
  // unchecking "all" unchecks every platform (to pick a few of them)
  const toggleAll = () => {
    updateSelected(selected.length == platforms.length ? [] : platforms)
  }
  const selectedLabel = selected.length == platforms.length
    ? t('charts__all_platforms')
    : selected.length ? selected.map(platformName).join(', ') : t('charts__choose_platforms')

  // the charts shown last time are shown at once, the loaded ones replace them
  const cached = useRef(getCache<Lists>(CACHE_KEY)).current
  const [lists, setLists] = useState<Lists>(cached ?? {})
  const [status, setStatus] = useState<'loading' | 'failed' | 'done'>(cached && Object.keys(cached).length ? 'done' : 'loading')
  // the charts tab pressed again: to the top
  const listRef = useRef<FlatList>(null)
  useNavReselect('nav_top', () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true })
  })
  const isLoadedRef = useRef(false)
  useEffect(() => {
    if (isLoadedRef.current && Object.keys(lists).length) setCache(CACHE_KEY, lists)
  }, [lists])

  useEffect(() => {
    let isUnmounted = false
    let failed = 0
    const setSourceItems = (source: string, update: (items: ChartItem[]) => ChartItem[]) => {
      setLists(lists => ({ ...lists, [source]: update(lists[source] ?? []) }))
    }
    // each platform is shown as soon as its charts are loaded
    const loads = platforms.map(async source => {
      return (async() => {
        const boards = await getBoardsList(source as LX.OnlineSource)
        if (isUnmounted) return false
        const noCovers: Record<string, string> = {}
        const covers = await getBoardCovers(source as LX.OnlineSource).catch(() => noCovers)
        if (isUnmounted) return false
        // covers found earlier are kept until the new ones are known
        const prevPics = new Map((cached?.[source] ?? []).map(item => [item.id, item.pic]))
        const items: ChartItem[] = boards.map(item => ({ ...item, pic: covers[item.bangid] ?? prevPics.get(item.id) ?? null }))
        isLoadedRef.current = true
        setSourceItems(source, () => items)
        setStatus('done')
        // the charts of Spotify / SoundCloud come with their pictures, the others: the cover of their first song
        if (isChartSource(source)) return true
        for (const item of items) {
          if (item.pic) continue
          void getBoardSongCover(item.id).then(pic => {
            if (!pic || isUnmounted) return
            setSourceItems(source, list => list.map(i => i.id == item.id ? { ...i, pic } : i))
          })
        }
        return true
      })().catch(err => {
        console.log(err)
        if (++failed == platforms.length && !isUnmounted) setStatus(status => status == 'done' ? status : 'failed')
        return false
      })
    })
    // first run: the platforms of the West that can't be reached are unchecked (not when no Chinese platform is
    // loaded either: offline, tried again next time)
    if (isFirstRunRef.current) {
      void Promise.all([Promise.all(loads), Promise.all(CHART_SOURCES.map(isChartSourceReachable))]).then(([loaded, reachable]) => {
        if (isUnmounted || !isFirstRunRef.current) return
        if (!platforms.some((source, index) => !isChartSource(source) && loaded[index])) return
        isFirstRunRef.current = false
        const blocked: string[] = CHART_SOURCES.filter((_, index) => !reachable[index])
        setSelected(list => {
          const next = list.filter(id => !blocked.includes(id))
          setCache(SELECTED_KEY, { selected: next, known: platforms })
          return next
        })
      })
    }
    return () => {
      isUnmounted = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // the charts of the platforms chosen, in turns, by rows
  const rows = useMemo(() => {
    const chosen = platforms.filter(p => selected.includes(p)).map(p => lists[p] ?? [])
    const mixed: ChartItem[] = []
    const longest = Math.max(0, ...chosen.map(list => list.length))
    for (let i = 0; i < longest; i++) for (const list of chosen) if (i < list.length) mixed.push(list[i])
    const rows: ChartItem[][] = []
    for (let i = 0; i < mixed.length; i += COLUMNS) rows.push(mixed.slice(i, i + COLUMNS))
    return rows
  }, [lists, platforms, selected])

  const size = Math.floor((width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS)
  const openChart = (item: ChartItem) => {
    const source = item.id.split('__')[0] as LX.OnlineSource
    navigations.pushCollectionScreen(commonState.componentIds.home!, { type: 'chart', id: item.id, name: item.name, source, img: item.pic })
  }

  const header = (
    <TouchableOpacity activeOpacity={0.7} style={styles.dropdownBtn} onPress={() => { setShowMenu(!isShowMenu) }}>
      <Text size={16} numberOfLines={1} style={styles.dropdownText}>{selectedLabel}</Text>
      <View style={{ transform: [{ rotate: isShowMenu ? '-90deg' : '90deg' }] }}>
        <Icon name="chevron-right" size={13} color={theme['c-font']} />
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {
        status == 'loading'
          ? (
              <View style={styles.skeleton}>
                <View style={styles.skeletonHeader}>{header}</View>
                <SkeletonGrid size={size} columns={COLUMNS} gap={GAP} padding={PADDING} />
              </View>
            )
          : status != 'done'
            ? (
                <View style={styles.status}>
                  <Text size={13} color={theme['c-font-label']}>{t('list_error')}</Text>
                </View>
              )
            : (
                <FlatList
                  ref={listRef}
                  style={styles.container}
                  contentContainerStyle={styles.content}
                  data={rows}
                  keyExtractor={row => row[0].id}
                  ListHeaderComponent={header}
                  ListEmptyComponent={selected.length ? null : <Text size={13} color={theme['c-font-label']} style={styles.empty}>{t('charts__choose_platforms_tip')}</Text>}
                  renderItem={({ item: row }) => (
                    <View style={styles.row}>
                      {row.map((item: ChartItem) => <Item key={item.id} item={item} size={size} platform={platformName(item.id.split('__')[0])} onPress={openChart} />)}
                    </View>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              )
      }
      {
        isShowMenu
          ? (
              <>
                {/* a press outside the menu closes it */}
                <Pressable style={styles.menuMask} onPress={() => { setShowMenu(false) }} />
                <View style={{ ...styles.menu, backgroundColor: theme['c-content-background'], borderColor: theme['c-border-background'] }}>
                  <TouchableOpacity activeOpacity={0.7} style={styles.menuItem} onPress={toggleAll}>
                    <Icon name={selected.length == platforms.length ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={theme['c-primary-font']} />
                    <Text size={15}>{t('charts__all_platforms')}</Text>
                  </TouchableOpacity>
                  <View style={{ ...styles.separator, backgroundColor: theme['c-border-background'] }} />
                  {
                    platforms.map(id => (
                      <TouchableOpacity key={id} activeOpacity={0.7} style={styles.menuItem} onPress={() => { togglePlatform(id) }}>
                        <Icon name={selected.includes(id) ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={theme['c-primary-font']} />
                        <Text size={15}>{platformName(id)}</Text>
                      </TouchableOpacity>
                    ))
                  }
                </View>
              </>
            )
          : null
      }
    </View>
  )
}

const styles = createStyle({
  skeleton: {
    flex: 1,
    paddingTop: 4,
    overflow: 'hidden',
  },
  skeletonHeader: {
    paddingHorizontal: PADDING,
    paddingBottom: 14,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PADDING,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 14,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
    maxWidth: '100%',
  },
  dropdownText: {
    fontWeight: 'bold',
    flexShrink: 1,
  },
  menuMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  menu: {
    position: 'absolute',
    left: PADDING,
    top: 40,
    minWidth: 200,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 6,
    gap: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  separator: {
    height: 1,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  name: {
    marginTop: 5,
    textAlign: 'center',
  },
  platform: {
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
  },
  status: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
