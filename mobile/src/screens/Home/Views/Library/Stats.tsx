import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Svg, { G, Path, Text as SvgText } from 'react-native-svg'

import {
  STATS_RANGE_IDS, formatClockHour, formatListened, getCalendarWeeks, getClockPieces, getListenStats, getRangeFrom,
  type ListenStats, type StatsRangeId, type StatsTopEntry,
} from '@/utils/listenStats'
import { normalizeArtistName } from '@/utils/artistName'
import { createStyle } from '@/utils/tools'
import { openAlbum } from '@/core/musicLinks'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { TranslatedText } from '@/components/common/TranslatedText'

// Listening stats (utils/listenStats.ts), like the stats of the history of Nuclear

type TopListId = 'artists' | 'albums' | 'tracks'

const TopList = memo(({ id, title, entries, onPress }: {
  id: TopListId
  title: string
  entries: StatsTopEntry[]
  onPress: (id: TopListId, entry: StatsTopEntry) => void
}) => {
  const theme = useTheme()
  if (!entries.length) return null
  return (
    <View style={{ ...styles.box, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
      <Text size={16} style={styles.boxTitle}>{title}</Text>
      {
        entries.map((entry, index) => (
          <TouchableOpacity key={entry.key} activeOpacity={0.7} style={styles.topItem} onPress={() => { onPress(id, entry) }}>
            <Text size={12} color={theme['c-font-label']} style={styles.rank}>{index + 1}</Text>
            <Image url={entry.img} style={{ ...styles.topImg, borderRadius: id == 'artists' ? 20 : 6 }} />
            <View style={styles.topText}>
              <Text size={14} numberOfLines={1}><TranslatedText text={entry.name} /></Text>
              {entry.subtitle ? <Text size={12} numberOfLines={1} color={theme['c-font-label']}>{entry.subtitle}</Text> : null}
            </View>
            <Text size={12} color={theme['c-font-label']}>{formatListened(entry.seconds)}</Text>
          </TouchableOpacity>
        ))
      }
    </View>
  )
})

// the hour of the day: a ring of 24 pieces, each one filled as much as it is listened; a piece pressed shows
// its time in the middle
const CLOCK_SIZE = 240
const ListeningClock = memo(({ hours }: { hours: number[] }) => {
  const theme = useTheme()
  const [selected, setSelected] = useState<number | null>(null)
  const pieces = useMemo(() => getClockPieces(hours, 38, 94), [hours])
  return (
    <View style={{ width: CLOCK_SIZE, height: CLOCK_SIZE, alignSelf: 'center' }}>
      <Svg width={CLOCK_SIZE} height={CLOCK_SIZE} viewBox="-115 -115 230 230">
        {
          pieces.map(piece => (
            <G key={piece.hour} onPress={() => { setSelected(selected == piece.hour ? null : piece.hour) }}>
              {piece.fill ? <Path d={piece.fill} fill={theme['c-primary']} /> : null}
              <Path
                d={piece.outline} fill="transparent"
                stroke={piece.hour == selected ? theme['c-primary'] : theme['c-font']}
                strokeOpacity={piece.hour == selected ? 1 : 0.6} strokeWidth={piece.hour == selected ? 1.8 : 1}
              />
            </G>
          ))
        }
        {
          [0, 6, 12, 18].map(hour => (
            <SvgText key={hour} x={Math.sin(hour * Math.PI / 12) * 106} y={-Math.cos(hour * Math.PI / 12) * 106 + 4} fontSize={11} fontWeight="bold" fill={theme['c-font']} textAnchor="middle">
              {String(hour).padStart(2, '0')}
            </SvgText>
          ))
        }
      </Svg>
      {
        // the hour pressed and its time (nothing when no hour is pressed)
        selected == null
          ? null
          : (
              <View pointerEvents="none" style={styles.clockCenter}>
                <Text size={10} numberOfLines={1}>{formatClockHour(selected)}</Text>
                <Text size={13} style={styles.bold}>{formatListened(hours[selected])}</Text>
              </View>
            )
      }
    </View>
  )
})

const WeekChart = memo(({ weekdays, names }: { weekdays: number[], names: string[] }) => {
  const theme = useTheme()
  const max = Math.max(1, ...weekdays)
  return (
    <View style={styles.week}>
      {
        weekdays.map((value, index) => (
          <View key={index} style={styles.weekCol}>
            <Text size={9} color={theme['c-font-label']} numberOfLines={1}>{value ? formatListened(value) : ''}</Text>
            <View style={styles.weekTrack}>
              <View style={{ ...styles.weekBar, height: `${Math.max(1.5, value / max * 100)}%`, backgroundColor: theme['c-primary'] }} />
            </View>
            <Text size={11} color={theme['c-font-label']}>{names[index]}</Text>
          </View>
        ))
      }
    </View>
  )
})

// the calendar of the last year: a column a week, a cell a day, darker the more it is listened
const CELL = 11
const CELL_GAP = 3
const LEVEL_OPACITY = [0.1, 0.3, 0.5, 0.75, 1]
const Calendar = memo(({ days, less, more }: { days: Record<string, number>, less: string, more: string }) => {
  const theme = useTheme()
  const weeks = useMemo(() => getCalendarWeeks(), [])
  const maxDay = Math.max(1, ...Object.values(days))
  const level = (seconds: number) => seconds ? Math.min(4, Math.ceil(seconds / maxDay * 4)) : 0
  const scrollRef = useRef<ScrollView>(null)
  const months: Array<{ index: number, name: string }> = []
  let lastMonth = -1
  weeks.forEach((week, index) => {
    const first = week.find(day => day)
    if (!first || first.date.getMonth() == lastMonth) return
    lastMonth = first.date.getMonth()
    if (index == 0 && first.date.getDate() > 7) return
    months.push({ index, name: first.date.toLocaleDateString(undefined, { month: 'short' }) })
  })
  return (
    <>
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
        <View>
          <View style={{ height: 14 }}>
            {
              months.map(month => (
                <Text key={month.index} size={9} color={theme['c-font-label']} style={{ position: 'absolute', left: month.index * (CELL + CELL_GAP) }}>{month.name}</Text>
              ))
            }
          </View>
          <View style={styles.calendarWeeks}>
            {
              weeks.map((week, w) => (
                <View key={w} style={styles.calendarWeek}>
                  {
                    week.map((day, d) => (
                      <View key={d} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: day ? theme['c-primary'] : 'transparent', opacity: day ? LEVEL_OPACITY[level(days[day.key] ?? 0)] : 0 }} />
                    ))
                  }
                </View>
              ))
            }
          </View>
        </View>
      </ScrollView>
      <View style={styles.legend}>
        <Text size={11} color={theme['c-font-label']}>{less}</Text>
        {LEVEL_OPACITY.map(opacity => <View key={opacity} style={{ width: CELL, height: CELL, borderRadius: 2, backgroundColor: theme['c-primary'], opacity }} />)}
        <Text size={11} color={theme['c-font-label']}>{more}</Text>
      </View>
    </>
  )
})

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [rangeId, setRangeId] = useState<StatsRangeId>('last30Days')
  const [stats, setStats] = useState<ListenStats | null>(null)

  useEffect(() => {
    let isActive = true
    void getListenStats(getRangeFrom(rangeId)).then(result => {
      if (isActive) setStats(result)
    })
    return () => {
      isActive = false
    }
  }, [rangeId])

  // Monday first
  const weekdayNames = useMemo(() => Array.from({ length: 7 }, (_, index) => new Date(2024, 0, 1 + index).toLocaleDateString(undefined, { weekday: 'short' })), [])

  const handleEntryPress = useCallback((id: TopListId, entry: StatsTopEntry) => {
    switch (id) {
      case 'artists':
        navigations.pushCollectionScreen(commonState.componentIds.home!, { type: 'artist', name: normalizeArtistName(entry.name), fromSource: entry.musicInfo.source })
        break
      case 'albums':
        void openAlbum(entry.musicInfo)
        break
      case 'tracks':
        void setTempList('stats_track', [entry.musicInfo as LX.Music.MusicInfoOnline]).then(() => { void playList(LIST_IDS.TEMP, 0) })
        break
    }
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ranges}>
        {
          STATS_RANGE_IDS.map(id => (
            <TouchableOpacity key={id} activeOpacity={0.7} onPress={() => { setRangeId(id) }}>
              <Text
                size={13} color={id == rangeId ? theme['c-font'] : theme['c-font-label']}
                style={{ ...styles.rangeBtn, fontWeight: id == rangeId ? 'bold' : 'normal', backgroundColor: id == rangeId ? theme['c-primary-light-400-alpha-700'] : 'transparent' }}
              >{t(`stats__range_${id}`)}</Text>
            </TouchableOpacity>
          ))
        }
      </ScrollView>
      {
        !stats
          ? null
          : stats.firstPlay == null
            ? <Text color={theme['c-font-label']} style={styles.empty}>{t('stats__empty')}</Text>
            : (
                <>
                  <View style={styles.summary}>
                    <View>
                      <Text size={22} style={styles.bold} color={theme['c-primary-font']}>{formatListened(stats.seconds)}</Text>
                      <Text size={12} color={theme['c-font-label']}>{t('stats__listening_time')}</Text>
                    </View>
                    <View>
                      <Text size={22} style={styles.bold} color={theme['c-primary-font']}>{stats.plays}</Text>
                      <Text size={12} color={theme['c-font-label']}>{t('stats__plays')}</Text>
                    </View>
                  </View>
                  <TopList id="artists" title={t('stats__top_artists')} entries={stats.topArtists} onPress={handleEntryPress} />
                  <TopList id="albums" title={t('stats__top_albums')} entries={stats.topAlbums} onPress={handleEntryPress} />
                  <TopList id="tracks" title={t('stats__top_tracks')} entries={stats.topTracks} onPress={handleEntryPress} />
                  {
                    stats.plays
                      ? (
                          <>
                            <View style={{ ...styles.box, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
                              <Text size={16} style={styles.boxTitle}>{t('stats__hour_of_day')}</Text>
                              <ListeningClock hours={stats.hours} />
                            </View>
                            <View style={{ ...styles.box, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
                              <Text size={16} style={styles.boxTitle}>{t('stats__day_of_week')}</Text>
                              <WeekChart weekdays={stats.weekdays} names={weekdayNames} />
                            </View>
                          </>
                        )
                      : null
                  }
                  <View style={{ ...styles.box, backgroundColor: theme['c-primary-light-900-alpha-200'] }}>
                    <Text size={16} style={styles.boxTitle}>{t('stats__calendar')}</Text>
                    <Calendar days={stats.days} less={t('stats__less')} more={t('stats__more')} />
                  </View>
                </>
              )
      }
    </ScrollView>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 14,
  },
  ranges: {
    gap: 6,
    paddingVertical: 4,
  },
  rangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 15,
    overflow: 'hidden',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  summary: {
    flexDirection: 'row',
    gap: 30,
  },
  bold: {
    fontWeight: 'bold',
  },
  box: {
    borderRadius: 12,
    padding: 12,
  },
  boxTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  rank: {
    width: 18,
    textAlign: 'right',
  },
  topImg: {
    width: 40,
    height: 40,
  },
  topText: {
    flex: 1,
    minWidth: 0,
  },
  clockCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: {
    height: 170,
    flexDirection: 'row',
    gap: 8,
  },
  weekCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  weekBar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  calendarWeeks: {
    flexDirection: 'row',
    gap: CELL_GAP,
  },
  calendarWeek: {
    gap: CELL_GAP,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 8,
  },
})
