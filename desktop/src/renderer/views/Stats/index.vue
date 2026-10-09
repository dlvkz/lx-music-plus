<template>
  <div :class="[$style.container, 'scroll']">
    <div :class="$style.header">
      <h2 :class="$style.title">{{ $t('stats__title') }}</h2>
      <span :class="$style.rangeDates">{{ rangeDates }}</span>
      <div :class="$style.ranges">
        <button
          v-for="id in STATS_RANGE_IDS" :key="id" type="button"
          :class="[$style.rangeBtn, { [$style.active]: id == rangeId }]" @click="rangeId = id"
        >
          {{ $t(`stats__range_${id}`) }}
        </button>
      </div>
    </div>

    <material-empty v-if="loaded && view.firstPlay == null" :label="$t('stats__empty')" />
    <template v-else-if="loaded">
      <div :class="$style.summary">
        <div><strong>{{ formatListened(view.seconds) }}</strong><span>{{ $t('stats__listening_time') }}</span></div>
        <div><strong>{{ view.plays }}</strong><span>{{ $t('stats__plays') }}</span></div>
      </div>

      <div v-if="view.plays" :class="$style.tops">
        <section v-for="list in topLists" :key="list.id" :class="$style.box">
          <h3>{{ list.title }}</h3>
          <ol :class="$style.topList">
            <li v-for="(entry, index) in list.entries" :key="entry.key" :class="$style.topItem" @click="openEntry(list.id, entry)">
              <span :class="$style.rank">{{ index + 1 }}</span>
              <div :class="[$style.topImg, { [$style.round]: list.id == 'artists' }]"><base-image :src="entry.img" :icon="list.id == 'artists' ? 'dj' : 'albums'" /></div>
              <div :class="$style.topText">
                <p :class="$style.topName"><common-translatable-text :text="entry.name" /></p>
                <p v-if="entry.subtitle" :class="$style.topSub">{{ entry.subtitle }}</p>
              </div>
              <span :class="$style.topValue">{{ formatListened(entry.seconds) }}</span>
            </li>
            <!-- the lists are as long as the longest one: empty slots -->
            <li v-for="index in topSlots - list.entries.length" :key="`empty_${index}`" :class="[$style.topItem, $style.topEmpty]" aria-hidden="true" />
          </ol>
        </section>
      </div>

      <div v-if="view.plays" :class="$style.charts">
        <section :class="[$style.box, $style.clockBox]">
          <h3>{{ $t('stats__hour_of_day') }}</h3>
          <svg :class="$style.clock" viewBox="-112 -112 224 224" @mouseleave="hoveredHour = null">
            <g v-for="piece in clockPieces" :key="piece.hour" :class="$style.clockPiece" @mouseenter="hoveredHour = piece.hour">
              <path v-if="piece.fill" :d="piece.fill" :class="$style.clockFill" />
              <path :d="piece.outline" :class="[$style.clockOutline, { [$style.clockHover]: piece.hour == hoveredHour }]" />
            </g>
            <text v-for="hour in [0, 6, 12, 18]" :key="hour" :class="$style.clockLabel" :x="Math.sin(hour * Math.PI / 12) * 104" :y="-Math.cos(hour * Math.PI / 12) * 104 + 4">{{ String(hour).padStart(2, '0') }}</text>
            <text :class="$style.clockCenterLabel" y="-5">{{ clockCenter.label }}</text>
            <text :class="$style.clockCenterValue" y="11">{{ clockCenter.value }}</text>
          </svg>
        </section>
        <section :class="[$style.box, $style.weekBox]">
          <h3>{{ $t('stats__day_of_week') }}</h3>
          <div :class="$style.week">
            <div v-for="(value, index) in weekdays" :key="index" :class="$style.weekCol" :title="formatListened(value)">
              <span :class="$style.weekValue">{{ value ? formatListened(value) : '' }}</span>
              <div :class="$style.weekTrack"><div :class="$style.weekBar" :style="{ height: `${maxWeekday ? value / maxWeekday * 100 : 0}%` }" /></div>
              <span :class="$style.weekLabel">{{ weekdayNames[index] }}</span>
            </div>
          </div>
        </section>
      </div>

      <section :class="[$style.box, $style.calendarBox]">
        <h3>{{ $t('stats__calendar') }}</h3>
        <svg :class="$style.calendar" :viewBox="`0 0 ${calendar.width} ${calendar.height}`">
          <text v-for="month in calendar.months" :key="month.x" :class="$style.calendarLabel" :x="month.x" y="9">{{ month.name }}</text>
          <text v-for="(name, index) in weekdayNames" v-show="index % 2 == 0" :key="name" :class="$style.calendarLabel" x="0" :y="CAL_TOP + index * CAL_STEP + 9">{{ name }}</text>
          <template v-for="(week, w) in calendar.weeks" :key="w">
            <rect
              v-for="(day, d) in week" v-show="day" :key="d"
              :x="CAL_LEFT + w * CAL_STEP" :y="CAL_TOP + d * CAL_STEP" :width="CAL_CELL" :height="CAL_CELL" rx="2"
              :class="$style.calendarCell" :fill-opacity="day ? levelOpacity(days[day.key] ?? 0) : 0"
            >
              <title v-if="day">{{ day.date.toLocaleDateString() }} · {{ formatListened(days[day.key] ?? 0) }}</title>
            </rect>
          </template>
        </svg>
        <div :class="$style.legend">
          <span>{{ $t('stats__less') }}</span>
          <svg v-for="level in [0, 1, 2, 3, 4]" :key="level" viewBox="0 0 10 10" width="11" height="11"><rect width="10" height="10" rx="2" :class="$style.calendarCell" :fill-opacity="LEVEL_OPACITY[level]" /></svg>
          <span>{{ $t('stats__more') }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch, onMounted } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { useI18n } from '@renderer/plugins/i18n'
import { setTempList } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player/action'
import { LIST_IDS } from '@common/constants'
import { isSecondarySource } from '@renderer/utils/secondarySources'
import { openSecondarySongAlbum } from '@renderer/utils/songLinks'
import { normalizeArtistName } from '@renderer/utils/artistName'
import {
  STATS_RANGE_IDS, formatClockHour, formatListened, getCalendarWeeks, getClockPieces, getListenStats, getRangeFrom,
  type ListenStats, type StatsRangeId, type StatsTopEntry,
} from '@renderer/utils/listenStats'

// Listening stats (utils/listenStats.ts), like the stats of the history of Nuclear

const t = useI18n()
const router = useRouter()
const rangeId = ref<StatsRangeId>('last30Days')
const stats = shallowRef<ListenStats | null>(null)
const loaded = computed(() => !!stats.value)
// the stats shown (empty ones until they are loaded)
const EMPTY_STATS: ListenStats = { from: 0, to: 0, seconds: 0, plays: 0, topArtists: [], topAlbums: [], topTracks: [], hours: Array<number>(24).fill(0), weekdays: Array<number>(7).fill(0), days: {}, firstPlay: null }
const view = computed(() => stats.value ?? EMPTY_STATS)

const load = async() => {
  const result = await getListenStats(getRangeFrom(rangeId.value))
  stats.value = result
}
watch(rangeId, () => { void load() })
onMounted(() => { void load() })

const rangeDates = computed(() => {
  if (!stats.value) return ''
  const from = stats.value.from ? stats.value.from : stats.value.firstPlay ?? stats.value.to
  return `${new Date(from * 1000).toLocaleDateString()} – ${new Date(stats.value.to * 1000).toLocaleDateString()}`
})

const topLists = computed(() => stats.value
  ? [
      { id: 'artists', title: t('stats__top_artists'), entries: stats.value.topArtists },
      { id: 'albums', title: t('stats__top_albums'), entries: stats.value.topAlbums },
      { id: 'tracks', title: t('stats__top_tracks'), entries: stats.value.topTracks },
    ]
  : [])

const topSlots = computed(() => Math.max(0, ...topLists.value.map(list => list.entries.length)))

const ONLINE_SOURCES = ['kw', 'wy', 'tx', 'kg', 'mg']
const openEntry = (listId: string, entry: StatsTopEntry) => {
  const musicInfo = entry.musicInfo
  switch (listId) {
    case 'artists':
      void router.push({ path: '/artist', query: { name: normalizeArtistName(entry.name), source: musicInfo.source } })
      break
    case 'albums': {
      if (isSecondarySource(musicInfo.source)) {
        void openSecondarySongAlbum(router, musicInfo)
        break
      }
      const albumId = (musicInfo.meta as { albumId?: string | number }).albumId
      if (ONLINE_SOURCES.includes(musicInfo.source) && albumId) void router.push({ path: '/album', query: { source: musicInfo.source, id: String(albumId), name: entry.name } })
      break
    }
    case 'tracks':
      void setTempList('stats_track', [musicInfo as LX.Music.MusicInfoOnline]).then(() => { playList(LIST_IDS.TEMP, 0) })
      break
  }
}

// the hour of the day: a ring of 24 pieces, each one filled as much as it is listened (its time shown on hover)
const hoveredHour = ref<number | null>(null)
const clockPieces = computed(() => getClockPieces(view.value.hours, 36, 92))
// the text in the middle: the hour hovered and its time (nothing when no hour is hovered)
const clockCenter = computed(() => {
  const hour = hoveredHour.value
  return hour == null
    ? { label: '', value: '' }
    : { label: formatClockHour(hour), value: formatListened(view.value.hours[hour]) }
})

// Monday first
const weekdayNames = computed(() => Array.from({ length: 7 }, (_, index) => new Date(2024, 0, 1 + index).toLocaleDateString(undefined, { weekday: 'short' })))
const weekdays = computed(() => stats.value?.weekdays ?? [])
const maxWeekday = computed(() => Math.max(0, ...weekdays.value))
const days = computed(() => stats.value?.days ?? {})

// the calendar of the last year: a column a week, a cell a day, darker the more it is listened
const CAL_CELL = 11
const CAL_STEP = 14
const CAL_LEFT = 30
const CAL_TOP = 16
const LEVEL_OPACITY = [0.08, 0.3, 0.5, 0.75, 1]
const calendar = computed(() => {
  const weeks = getCalendarWeeks()
  const months: Array<{ x: number, name: string }> = []
  let lastMonth = -1
  weeks.forEach((week, index) => {
    const first = week.find(day => day)
    if (!first || first.date.getMonth() == lastMonth) return
    lastMonth = first.date.getMonth()
    // no label on the first column when the month starts at its end (the labels would overlap)
    if (index == 0 && first.date.getDate() > 7) return
    months.push({ x: CAL_LEFT + index * CAL_STEP, name: first.date.toLocaleDateString(undefined, { month: 'short' }) })
  })
  return { weeks, months, width: CAL_LEFT + weeks.length * CAL_STEP, height: CAL_TOP + 7 * CAL_STEP }
})
// the levels of the days: by quarters of the most listened day of the year
const maxDay = computed(() => Math.max(1, ...Object.values(days.value)))
const levelOpacity = (seconds: number) => {
  if (!seconds) return LEVEL_OPACITY[0]
  return LEVEL_OPACITY[Math.min(4, Math.ceil(seconds / maxDay.value * 4))]
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  height: 100%;
  padding: 15px 18px 25px;
  display: flex;
  flex-flow: column nowrap;
  gap: 16px;
}
// (the sections keep their size: the page scrolls)
.container > * {
  flex: none;
}

.header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.title {
  font-size: 18px;
  color: var(--color-font);
  flex: auto;
}
.rangeDates {
  font-size: 12px;
  color: var(--color-font-label);
}
.ranges {
  display: flex;
  gap: 4px;
}
.rangeBtn {
  border: none;
  background: transparent;
  padding: 4px 9px;
  border-radius: 12px;
  font-size: 12px;
  color: var(--color-font-label);
  cursor: pointer;
  &:hover {
    color: var(--color-font);
  }
  &.active {
    color: var(--color-primary-font);
    background-color: var(--color-primary-background-hover);
  }
}

.summary {
  display: flex;
  gap: 30px;
  > div {
    display: flex;
    flex-flow: column nowrap;
    gap: 2px;
  }
  strong {
    font-size: 22px;
    color: var(--color-primary-font);
  }
  span {
    font-size: 12px;
    color: var(--color-font-label);
  }
}

.box {
  border-radius: 8px;
  padding: 12px 14px;
  background-color: var(--color-primary-light-100-alpha-700);
  min-width: 0;
  h3 {
    font-size: 14px;
    color: var(--color-font);
    margin-bottom: 10px;
  }
}

.tops {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  align-items: start;
}
.topList {
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
}
.topItem {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color @transition-normal;
  &:hover {
    background-color: var(--color-primary-background-hover);
  }
}
.rank {
  width: 16px;
  flex: none;
  text-align: right;
  font-size: 12px;
  color: var(--color-font-label);
}
.topImg {
  width: 34px;
  height: 34px;
  flex: none;
  overflow: hidden;
  border-radius: 4px;
  :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.round {
  border-radius: 50%;
}
.topText {
  flex: auto;
  min-width: 0;
}
.topName {
  font-size: 13px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.topSub {
  font-size: 11px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}
.topEmpty {
  // as high as an entry (its picture and padding)
  height: 40px;
  cursor: default;
  &:hover {
    background-color: transparent;
  }
}
.topValue {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
}

.charts {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.clockBox {
  flex: none;
}
.clock {
  width: 240px;
  height: 240px;
  display: block;
}
.clockPiece {
  cursor: default;
}
.clockOutline {
  fill: transparent;
  stroke: var(--color-font);
  stroke-opacity: 0.6;
  stroke-width: 1;
  transition: stroke-opacity @transition-normal;
}
.clockHover {
  stroke: var(--color-primary);
  stroke-opacity: 1;
  stroke-width: 1.4;
}
.clockFill {
  fill: var(--color-primary);
}
.clockLabel {
  font-size: 11px;
  font-weight: bold;
  fill: var(--color-font);
  text-anchor: middle;
}
.clockCenterLabel {
  font-size: 8px;
  fill: var(--color-font);
  text-anchor: middle;
}
.clockCenterValue {
  font-size: 11px;
  font-weight: bold;
  fill: var(--color-font);
  text-anchor: middle;
}
.weekBox {
  flex: 1 1 300px;
  display: flex;
  flex-flow: column nowrap;
}
.week {
  flex: auto;
  min-height: 200px;
  display: flex;
  gap: 10px;
}
.weekCol {
  flex: 1;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 4px;
}
.weekValue {
  font-size: 10px;
  color: var(--color-font-label);
  white-space: nowrap;
}
.weekTrack {
  flex: auto;
  width: 100%;
  max-width: 34px;
  display: flex;
  align-items: flex-end;
}
.weekBar {
  width: 100%;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  background-color: var(--color-primary);
}
.weekLabel {
  font-size: 11px;
  color: var(--color-font-label);
}

.calendarBox {
  overflow-x: auto;
}
.calendar {
  display: block;
  width: 100%;
  min-width: 700px;
  height: auto;
}
.calendarLabel {
  font-size: 9px;
  fill: var(--color-font-label);
}
.calendarCell {
  fill: var(--color-primary);
}
.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-font-label);
}
</style>
