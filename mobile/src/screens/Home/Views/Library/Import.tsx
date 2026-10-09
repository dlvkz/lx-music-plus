import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, ScrollView, TouchableOpacity, View } from 'react-native'

import '@/core/libraryImport'
import {
  clearImport, countImportGroup, finishImport, getImportFromAccount, getImportFromLink, getImportJob, onImportJobChange,
  parseImportFiles, resumeImport, retryImportTrack, setImportAlbumIncluded, setImportArtistIncluded, setImportGroupIncluded,
  setImportTrackIncluded, startImport,
  type ImportAccountPlatform, type ImportFile, type ImportJob, type ImportJobTrack, type ImportSource,
} from '@/utils/libraryImport'
import { SECONDARY_SOURCE_NAMES, isSecondarySource } from '@/utils/secondarySources'
import { selectFile } from '@/utils/fs'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Input from '@/components/common/Input'
import CheckBox from '@/components/common/CheckBox'
import Button from '@/components/common/ButtonPrimary'

// The import of the library of another platform (utils/libraryImport.ts): where from (files, a link, an account),
// what (liked songs, playlists, artists, albums), the songs looked for (in the background), the results checked.

type Tab = 'file' | 'link' | 'account'
const TABS: Tab[] = ['file', 'link', 'account']
const ACCOUNT_PLATFORMS: ImportAccountPlatform[] = ['soundcloud', 'lastfm', 'deezer', 'netease']
const TRACKS_SHOWN = 200

const Pills = <T extends string,>({ items, active, label, onPress }: { items: T[], active: T, label: (item: T) => string, onPress: (item: T) => void }) => {
  const theme = useTheme()
  return (
    <View style={styles.pills}>
      {items.map(item => (
        <TouchableOpacity key={item} activeOpacity={0.7} onPress={() => { onPress(item) }}
          style={{ ...styles.pill, backgroundColor: item == active ? theme['c-button-background'] : 'transparent' }}>
          <Text size={14} color={item == active ? theme['c-primary-font'] : theme['c-font-label']}>{label(item)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const Box = ({ children }: { children: React.ReactNode }) => {
  const theme = useTheme()
  return <View style={{ ...styles.box, borderColor: theme['c-border-background'] }}>{children}</View>
}

// where from: files, a link, an account
const SourcePicker = ({ onRead }: { onRead: (source: ImportSource) => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const [tab, setTab] = useState<Tab>('file')
  const [platform, setPlatform] = useState<ImportAccountPlatform>('soundcloud')
  const [linkText, setLinkText] = useState('')
  const [accountText, setAccountText] = useState('')
  const [files, setFiles] = useState<ImportFile[]>([])
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')

  const read = async(task: () => Promise<ImportSource> | ImportSource) => {
    setReading(true)
    setError('')
    try {
      onRead(await task())
    } catch (err) {
      setError(t('import__error', { msg: (err as Error).message }))
    } finally {
      setReading(false)
    }
  }
  // (one file at a time: more can be added)
  const addFile = async() => {
    try {
      const file = await selectFile({ mimeTypes: ['*/*'] })
      if (file?.data) setFiles(list => [...list.filter(f => f.name != file.name), { name: file.name, text: file.data }])
    } catch (err) {
      setError(t('import__error', { msg: (err as Error).message }))
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text size={13} color={theme['c-font-label']}>{t('import__desc')}</Text>
      <Pills items={TABS} active={tab} label={item => t(`import__tab_${item}`)} onPress={setTab} />
      {
        tab == 'file'
          ? <Box>
              {files.map(file => <Text key={file.name} size={14}>📄 {file.name}</Text>)}
              <View style={styles.row}>
                <Button onPress={() => { void addFile() }} disabled={reading}>{t(files.length ? 'import__file_add' : 'import__file_btn')}</Button>
                {files.length ? <Button onPress={() => { void read(() => parseImportFiles(files)) }} disabled={reading}>{reading ? t('import__reading') : t('import__read')}</Button> : null}
                {files.length ? <Button onPress={() => { setFiles([]) }} disabled={reading}>{t('import__file_clear')}</Button> : null}
              </View>
              <Text size={12} color={theme['c-font-label']}>{t('import__file_tip')}</Text>
            </Box>
          : tab == 'link'
            ? <Box>
                <View style={styles.inputWrap}><Input value={linkText} onChangeText={setLinkText} placeholder={t('import__link_placeholder')} clearBtn style={styles.input} /></View>
                <View style={styles.row}>
                  <Button onPress={() => { void read(async() => getImportFromLink(linkText)) }} disabled={reading || !linkText.trim()}>{reading ? t('import__reading') : t('import__read')}</Button>
                </View>
                <Text size={12} color={theme['c-font-label']}>{t('import__link_tip')}</Text>
              </Box>
            : <Box>
                <Pills items={ACCOUNT_PLATFORMS} active={platform} label={item => t(`import__platform_${item}`)} onPress={setPlatform} />
                <View style={styles.inputWrap}><Input value={accountText} onChangeText={setAccountText} placeholder={t(`import__account_placeholder_${platform}`)} clearBtn style={styles.input} /></View>
                <View style={styles.row}>
                  <Button onPress={() => { void read(async() => getImportFromAccount(platform, accountText)) }} disabled={reading || !accountText.trim()}>{reading ? t('import__reading') : t('import__read')}</Button>
                </View>
                <Text size={12} color={theme['c-font-label']}>{t(`import__account_tip_${platform}`)}</Text>
              </Box>
      }
      {error ? <Text size={13} color="#e5484d">{error}</Text> : null}
    </ScrollView>
  )
}

const countText = (t: ReturnType<typeof useI18n>, count: number | null) => count == null ? '' : ` (${t('import__songs', { num: count })})`

// what: the liked songs, the playlists, the artists, the albums
const Selection = ({ source, onStart, onBack }: { source: ImportSource, onStart: (selection: Parameters<typeof startImport>[1]) => void, onBack: () => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const [liked, setLiked] = useState(!!source.liked)
  const [playlists, setPlaylists] = useState(() => source.playlists.filter(p => !p.defaultOff).map(p => p.key))
  const [artists, setArtists] = useState(source.artists.length > 0)
  const [albums, setAlbums] = useState(source.albums.length > 0)
  const hasSelection = (liked && !!source.liked) || playlists.length > 0 || (artists && source.artists.length > 0) || (albums && source.albums.length > 0)
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Box>
        <Text size={15}>{source.title}</Text>
        {source.note ? <Text size={12} color={theme['c-font-label']}>{source.note == 'spotify_limit' ? t('import__spotify_limit') : source.note}</Text> : null}
        {source.liked ? <CheckBox check={liked} onChange={setLiked} label={`${t('import__liked')}${countText(t, source.liked.count)} → ${t('import__to_loved')}`} /> : null}
        {
          source.playlists.length
            ? <>
                <View style={styles.row}>
                  <Text size={14} color={theme['c-font-label']}>{t('import__playlists')} ({source.playlists.length})</Text>
                  <TouchableOpacity onPress={() => { setPlaylists(source.playlists.map(p => p.key)) }}><Text size={13} color={theme['c-primary-font']}>{t('import__select_all')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => { setPlaylists([]) }}><Text size={13} color={theme['c-primary-font']}>{t('import__select_none')}</Text></TouchableOpacity>
                </View>
                {source.playlists.map(p => (
                  <CheckBox key={p.key} check={playlists.includes(p.key)} label={`${p.name}${countText(t, p.count)}`}
                    onChange={check => { setPlaylists(list => check ? [...list, p.key] : list.filter(k => k != p.key)) }} />
                ))}
              </>
            : null
        }
        {source.artists.length ? <CheckBox check={artists} onChange={setArtists} label={`${t('import__artists')} (${source.artists.length})`} /> : null}
        {source.albums.length ? <CheckBox check={albums} onChange={setAlbums} label={`${t('import__albums')} (${source.albums.length})`} /> : null}
      </Box>
      <View style={styles.row}>
        <Button disabled={!hasSelection} onPress={() => { onStart({ liked, playlists, artists, albums }) }}>{t('import__start')}</Button>
        <Button onPress={onBack}>{t('import__back')}</Button>
      </View>
    </ScrollView>
  )
}

const sourceName = (t: ReturnType<typeof useI18n>, source: string) => isSecondarySource(source) ? SECONDARY_SOURCE_NAMES[source] : t(`source_real_${source as LX.OnlineSource}`)

const TrackRow = memo(({ index, item, onRetry }: { index: number, item: ImportJobTrack, onRetry: (index: number) => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const status = item.status == 'notFound' ? t('import__not_found') : item.musicInfo ? sourceName(t, item.musicInfo.source) : '…'
  return (
    <View style={{ ...styles.track, borderTopColor: theme['c-border-background'] }}>
      <View style={styles.trackMain}>
        <CheckBox check={item.include} disabled={!item.musicInfo} onChange={check => { setImportTrackIncluded(index, check) }} marginRight={0}>
          <View style={styles.trackText}>
            <Text size={14} numberOfLines={1}>{item.track.name || item.track.ytId}<Text size={12} color={theme['c-font-label']}>{item.track.singer ? `  ${item.track.singer}` : ''}</Text></Text>
            {item.musicInfo && item.status != 'direct' ? <Text size={11} numberOfLines={1} color={theme['c-font-label']}>→ {item.musicInfo.name} · {item.musicInfo.singer}</Text> : null}
          </View>
        </CheckBox>
      </View>
      <View style={styles.trackSide}>
        <Text size={11} color={item.status == 'notFound' ? '#e5484d' : item.status == 'fallback' ? theme['c-font-label'] : theme['c-primary-font']}>{status}</Text>
        {item.status == 'notFound' || item.status == 'fallback'
          ? <TouchableOpacity onPress={() => { onRetry(index) }}><Text size={11} color={theme['c-primary-font']}>{t('import__retry')}</Text></TouchableOpacity>
          : null}
      </View>
    </View>
  )
})

// a song looked for again with another name / artist
const RetryRow = ({ index, item, onDone }: { index: number, item: ImportJobTrack, onDone: () => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const [name, setName] = useState(item.track.name)
  const [singer, setSinger] = useState(item.track.singer.replace(/、/g, ', '))
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')
  const search = async() => {
    setSearching(true)
    const status = await retryImportTrack(index, name, singer).catch(() => 'notFound')
    setSearching(false)
    if (status == 'notFound') setMessage(t('import__not_found'))
    else onDone()
  }
  return (
    <View style={{ ...styles.retry, borderColor: theme['c-border-background'] }}>
      <View style={styles.inputWrap}><Input value={name} onChangeText={setName} placeholder={t('import__retry_name')} style={styles.input} /></View>
      <View style={styles.inputWrap}><Input value={singer} onChangeText={setSinger} placeholder={t('import__retry_singer')} style={styles.input} /></View>
      <View style={styles.row}>
        <Button disabled={searching || !name.trim()} onPress={() => { void search() }}>{searching ? t('import__reading') : t('import__retry_go')}</Button>
        <Button onPress={onDone}>{t('import__back')}</Button>
        {message ? <Text size={12} color="#e5484d">{message}</Text> : null}
      </View>
    </View>
  )
}

type ReviewRow =
  | { type: 'group', key: string, groupIndex: number }
  | { type: 'track', key: string, index: number }
  | { type: 'retry', key: string, index: number }
  | { type: 'more', key: string, groupIndex: number, num: number }
  | { type: 'title', key: string, text: string }
  | { type: 'artist', key: string, index: number }
  | { type: 'album', key: string, index: number }

// the results: each list with its songs, the artists, the albums
const Review = ({ job }: { job: ImportJob }) => {
  const t = useI18n()
  const theme = useTheme()
  const [openGroups, setOpenGroups] = useState<number[]>([0])
  const [shownAll, setShownAll] = useState<number[]>([])
  const [onlyNotFound, setOnlyNotFound] = useState(false)
  const [retryIndex, setRetryIndex] = useState<number | null>(null)
  const counts = useMemo(() => job.groups.map(group => countImportGroup(job, group)), [job])
  const included = useMemo(() => {
    const songs = new Set<number>()
    for (const group of job.groups) for (const index of group.tracks) if (job.tracks[index].include && job.tracks[index].musicInfo) songs.add(index)
    return songs.size + job.artists.filter(a => a.include).length + job.albums.filter(a => a.include && a.result).length
  }, [job])

  const rows = useMemo(() => {
    const list: ReviewRow[] = []
    job.groups.forEach((group, groupIndex) => {
      list.push({ type: 'group', key: `g${groupIndex}`, groupIndex })
      if (!openGroups.includes(groupIndex)) return
      const indexes = onlyNotFound ? group.tracks.filter(index => job.tracks[index].status == 'notFound') : group.tracks
      const shown = shownAll.includes(groupIndex) ? indexes : indexes.slice(0, TRACKS_SHOWN)
      for (const index of shown) {
        list.push({ type: 'track', key: `t${groupIndex}_${index}`, index })
        if (retryIndex == index) list.push({ type: 'retry', key: `r${groupIndex}_${index}`, index })
      }
      if (shown.length < indexes.length) list.push({ type: 'more', key: `m${groupIndex}`, groupIndex, num: indexes.length - shown.length })
    })
    if (job.artists.length) {
      list.push({ type: 'title', key: 'artists', text: `${t('import__artists')} (${job.artists.length})` })
      job.artists.forEach((_, index) => list.push({ type: 'artist', key: `a${index}`, index }))
    }
    if (job.albums.length) {
      list.push({ type: 'title', key: 'albums', text: `${t('import__albums')} (${job.albums.length})` })
      job.albums.forEach((_, index) => list.push({ type: 'album', key: `al${index}`, index }))
    }
    return list
  }, [job, openGroups, shownAll, onlyNotFound, retryIndex, t])

  const toggleGroup = useCallback((groupIndex: number) => {
    setOpenGroups(list => list.includes(groupIndex) ? list.filter(i => i != groupIndex) : [...list, groupIndex])
  }, [])
  const closeRetry = useCallback(() => { setRetryIndex(null) }, [])

  const renderItem = ({ item: row }: { item: ReviewRow }) => {
    switch (row.type) {
      case 'group': {
        const group = job.groups[row.groupIndex]
        const count = counts[row.groupIndex]
        return (
          <View style={styles.groupHead}>
            <CheckBox check={count.included > 0} onChange={check => { setImportGroupIncluded(row.groupIndex, check) }} marginRight={0} />
            <TouchableOpacity style={styles.groupName} onPress={() => { toggleGroup(row.groupIndex) }}>
              <Text size={15} numberOfLines={1}>{openGroups.includes(row.groupIndex) ? '▾ ' : '▸ '}{group.kind == 'liked' ? `${t('import__liked')} → ${t('import__to_loved')}` : group.name}</Text>
              <Text size={12} color={theme['c-font-label']}>{t('import__counts', { found: count.found, fallback: count.fallback, notFound: count.notFound })}</Text>
            </TouchableOpacity>
          </View>
        )
      }
      case 'track': return <TrackRow index={row.index} item={job.tracks[row.index]} onRetry={setRetryIndex} />
      case 'retry': return <RetryRow index={row.index} item={job.tracks[row.index]} onDone={closeRetry} />
      case 'more':
        return (
          <TouchableOpacity style={styles.more} onPress={() => { setShownAll(list => [...list, row.groupIndex]) }}>
            <Text size={13} color={theme['c-primary-font']}>{t('import__show_more', { num: row.num })}</Text>
          </TouchableOpacity>
        )
      case 'title': return <Text size={15} style={styles.title}>{row.text}</Text>
      case 'artist': {
        const item = job.artists[row.index]
        return <CheckBox check={item.include} label={item.artist.name} onChange={check => { setImportArtistIncluded(row.index, check) }} />
      }
      case 'album': {
        const item = job.albums[row.index]
        return (
          <View style={{ ...styles.track, borderTopColor: theme['c-border-background'] }}>
            <View style={styles.trackMain}>
              <CheckBox check={item.include} disabled={!item.result} onChange={check => { setImportAlbumIncluded(row.index, check) }} marginRight={0}>
                <View style={styles.trackText}>
                  <Text size={14} numberOfLines={1}>{item.album.name}<Text size={12} color={theme['c-font-label']}>{item.album.artist ? `  ${item.album.artist}` : ''}</Text></Text>
                </View>
              </CheckBox>
            </View>
            <Text size={11} color={item.result ? theme['c-primary-font'] : '#e5484d'}>{item.result ? sourceName(t, item.result.source) : t('import__not_found')}</Text>
          </View>
        )
      }
    }
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={row => row.key}
      renderItem={renderItem}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.reviewHead}>
          <Text size={15}>{t('import__review')} · {job.title}</Text>
          <CheckBox check={onlyNotFound} label={t('import__only_not_found')} onChange={setOnlyNotFound} />
          {job.error ? <Text size={13} color="#e5484d">{job.error}</Text> : null}
        </View>
      }
      ListFooterComponent={
        <View style={{ ...styles.row, ...styles.footer }}>
          <Button disabled={job.stage == 'importing' || !included} onPress={() => { void finishImport() }}>
            {job.stage == 'importing' ? t('import__importing') : t('import__finish', { num: included })}
          </Button>
          <Button disabled={job.stage == 'importing'} onPress={clearImport}>{t('import__cancel')}</Button>
        </View>
      }
    />
  )
}

export default () => {
  const t = useI18n()
  const theme = useTheme()
  const [preview, setPreview] = useState<ImportSource | null>(null)
  const [job, setJob] = useState<ImportJob | null>(() => getImportJob())
  useEffect(() => {
    const off = onImportJobChange(setJob)
    void resumeImport()
    return off
  }, [])

  if (!job) {
    if (!preview) return <SourcePicker onRead={setPreview} />
    return (
      <Selection
        source={preview}
        onBack={() => { setPreview(null) }}
        onStart={selection => {
          void startImport(preview, selection)
          setPreview(null)
        }}
      />
    )
  }
  if (job.stage == 'loading' || job.stage == 'matching') {
    const progress = job.total ? Math.min(100, Math.round(job.done / job.total * 100)) : 0
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Box>
          <Text size={15}>{job.title}</Text>
          <Text size={14}>{job.stage == 'loading' ? t('import__loading') : t('import__matching', { done: Math.min(job.done, job.total), total: job.total })}</Text>
          <View style={{ ...styles.bar, backgroundColor: theme['c-border-background'] }}>
            <View style={{ ...styles.barFill, width: `${progress}%`, backgroundColor: theme['c-primary'] }} />
          </View>
          <Text size={12} color={theme['c-font-label']}>{t('import__background_tip')}</Text>
        </Box>
        <View style={styles.row}>
          <Button onPress={clearImport}>{t('import__cancel')}</Button>
        </View>
      </ScrollView>
    )
  }
  if (job.stage == 'review' || job.stage == 'importing') return <Review job={job} />
  if (job.stage == 'done' && job.result) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Box>
          <Text size={15}>{t('import__done')}</Text>
          <Text size={14}>{t('import__result', job.result)}</Text>
          {job.result.skipped ? <Text size={12} color={theme['c-font-label']}>{t('import__skipped', { num: job.result.skipped })}</Text> : null}
        </Box>
        <View style={styles.row}>
          <Button onPress={clearImport}>{t('import__again')}</Button>
        </View>
      </ScrollView>
    )
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text size={14} color="#e5484d">{t('import__failed', { msg: job.error ?? '' })}</Text>
      <View style={styles.row}>
        <Button onPress={clearImport}>{t('import__back')}</Button>
      </View>
    </ScrollView>
  )
}

const styles = createStyle({
  content: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 30,
    gap: 12,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  box: {
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  // (the input grows to the space it is given)
  inputWrap: {
    height: 42,
    flexDirection: 'row',
  },
  input: {
    height: 42,
    borderRadius: 6,
    paddingHorizontal: 10,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  reviewHead: {
    gap: 6,
    marginBottom: 6,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  groupName: {
    flex: 1,
    gap: 2,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    gap: 6,
  },
  trackMain: {
    flex: 1,
    minWidth: 0,
  },
  trackText: {
    flexShrink: 1,
  },
  trackSide: {
    alignItems: 'flex-end',
    gap: 2,
  },
  retry: {
    gap: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  more: {
    paddingVertical: 10,
  },
  title: {
    marginTop: 14,
    marginBottom: 4,
  },
  footer: {
    marginTop: 16,
  },
})
