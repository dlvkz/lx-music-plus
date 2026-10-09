import { normalizeArtistName } from '@/utils/artistName'
import { setPlayingFrom } from '@/core/playingFrom'
import { getCachedTranslation } from '@/utils/translate'
import { showThemedDialog, createStyle, toast } from '@/utils/tools'
import { confirmRemoveDownloads } from '@/core/downloadPrompt'
import { useDownloadState, downloadMusics, downloadRest } from '@/core/download'
import { SkeletonSongRows } from '@/components/common/Skeleton'
import { loadCache, setCache } from '@/utils/dataCache'
import { type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { STICKY_OFFSET } from '@/components/common/StickyBanner'
import { getListMusicPic } from '@/utils/listMusicPic'
import SongPic from '@/components/common/SongPic'
import { ActionRow, BackButton, CollectButton, DownloadButton, PlayButton } from '@/components/common/ActionIcons'
import { useCollections, getCollectionKey, toggleCollection, updateCollection } from '@/core/collect'
import { TranslatedText } from '@/components/common/TranslatedText'
import { memo, useCallback, useEffect, useState } from 'react'
import { FlatList, ScrollView, View, TouchableOpacity } from 'react-native'
import PageContent from '@/components/PageContent'
import PlayerBar from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTabPageInfo } from '@/store/tabPages'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { HEADER_HEIGHT as _HEADER_HEIGHT, LIST_IDS } from '@/config/constant'
import { pop, navigations } from '@/navigation'
import { setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { loadCollection, type CollectionInfo, type CollectionData, type AlbumItem } from './data'
import { getArtistPicture, getSimilarArtists } from '@/utils/discovery'

// One screen for the pages that are "a cover, a title and a list of songs":
// artist page, album page and the daily mix (desktop: views/Artist, views/Album, views/DailyMix)

type Music = LX.Music.MusicInfoOnline

const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)
const ROW_HEIGHT = scaleSizeH(56)
const COVER_SIZE = scaleSizeW(110)
const ALBUM_SIZE = scaleSizeW(96)

const SongRow = memo(({ song, index, onPress }: { song: Music, index: number, onPress: (index: number) => void }) => {
  const theme = useTheme()
  return (
    <TouchableOpacity activeOpacity={0.6} onPress={() => { onPress(index) }} style={{ ...styles.songRow, height: ROW_HEIGHT }}>
      <SongPic musicInfo={song} size={44} />
      <View style={styles.songInfo}>
        <Text size={14} numberOfLines={1}><TranslatedText text={song.name} /></Text>
        <Text size={12} color={theme['c-font-label']} numberOfLines={1}><TranslatedText text={`${song.singer}${song.meta.albumName ? ` · ${song.meta.albumName}` : ''}`} /></Text>
      </View>
      <Text size={12} color={theme['c-font-label']}>{song.interval}</Text>
    </TouchableOpacity>
  )
})

export default memo(({ componentId, info }: { componentId: string, info: CollectionInfo }) => {
  const t = useI18n()
  const theme = useTheme()
  // shown in a tab (store/tabPages): the home screen has the status bar room and the player bar
  const { embedded } = useTabPageInfo()
  const realStatusBarHeight = useStatusbarHeight()
  const statusBarHeight = embedded ? 0 : realStatusBarHeight
  const [data, setData] = useState<CollectionData | null>(null)
  // artist: the artists similar to it (Last.fm, else Deezer), with their pictures (Deezer)
  const [similar, setSimilar] = useState<Array<{ name: string, img: string | null }>>([])
  useEffect(() => {
    if (info.type != 'artist' || !info.name) return
    let isActive = true
    setSimilar([])
    void getSimilarArtists(info.name, 20).then(async list => {
      if (!isActive) return
      const items = list.map(item => ({ name: item.name, img: item.img }))
      setSimilar(items)
      const withPictures = await Promise.all(items.map(async item => item.img ? item : { ...item, img: await getArtistPicture(item.name) }))
      if (isActive) setSimilar(withPictures)
    }).catch(err => {
      console.log(err)
    })
    return () => {
      isActive = false
    }
  }, [info.type, info.name])
  const [status, setStatus] = useState<'loading' | 'failed' | 'done'>('loading')

  useEffect(() => {
    let isUnmounted = false
    let isLoaded = false
    // what the page showed last time is shown until the new data is loaded
    const cacheKey = `detail:collection:${info.type}:${info.source ?? ''}:${info.id ?? info.name ?? ''}`
    void loadCache<CollectionData>(cacheKey).then(cached => {
      if (isUnmounted || isLoaded || !cached) return
      setData(cached)
      setStatus('done')
    })
    void loadCollection(info).then(result => {
      isLoaded = true
      if (result.list.length) setCache(cacheKey, result)
      if (isUnmounted) return
      // an empty answer, or the same data, does not replace what is shown (no reload of the rows / pictures)
      setData(data => {
        if (!result.list.length && data?.list.length) return data
        if (data && JSON.stringify(data) == JSON.stringify(result)) return data
        return result
      })
      setStatus('done')
    }).catch(err => {
      console.log(err)
      isLoaded = true
      if (!isUnmounted) setStatus(status => status == 'done' ? status : 'failed')
    })
    return () => {
      isUnmounted = true
    }
  }, [info])

  const [isSticky, setSticky] = useState(false)
  const handleScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    setSticky(nativeEvent.contentOffset.y > STICKY_OFFSET)
  }, [])

  const back = useCallback(() => {
    void pop(componentId)
  }, [componentId])

  const list = data?.list ?? []
  const handlePlay = useCallback((index: number) => {
    if (!data?.list.length) return
    const tempId = `collection_${info.type}_${info.source ?? ''}_${info.id ?? info.name ?? ''}`
    // (the player shows what is playing)
    setPlayingFrom(tempId, info.type == 'dailyMix' ? 'mix' : info.type, (data.title ? data.title : info.name) ?? '', { kind: 'collection', info })
    void setTempList(tempId, [...data.list]).then(() => {
      void playList(LIST_IDS.TEMP, index)
    })
  }, [data, info])
  // a ring around the download button shows how far the downloads of the album have gone
  const downloadState = useDownloadState(data?.list)
  const handleDownload = useCallback(() => {
    if (!data?.list.length) return
    if (downloadState.taskIds.length) {
      void confirmRemoveDownloads(data.title ? data.title : info.name ?? '', downloadState, () => { void downloadRest(data.list) })
      return
    }
    void downloadMusics(data.list).then(count => {
      toast(t(count ? 'download__added' : 'download__exists'))
    })
  }, [data, t, downloadState, info.name])
  // the description is capped, a tap shows the whole text
  const showDesc = useCallback(() => {
    if (!data?.subtitle || info.type == 'album') return
    void showThemedDialog({ message: getCachedTranslation(data.subtitle) ?? data.subtitle, buttons: [{ text: t('close'), value: true }] })
  }, [data, info.type, t])
  // the artist of an album opens its page
  const openAlbumArtist = useCallback(() => {
    const artist = data?.subtitle
    if (info.type != 'album' || !artist) return
    navigations.pushCollectionScreen(componentId, { type: 'artist', name: normalizeArtistName(artist.split(/[、&/,，]/)[0]) })
  }, [data, info.type, componentId])
  const openAlbum = useCallback((album: AlbumItem) => {
    navigations.pushCollectionScreen(componentId, { type: 'album', source: album.source, id: album.id, name: album.name, img: album.img })
  }, [componentId])

  const defaultTitle = info.type == 'dailyMix' ? t('home__daily_mix') : ''
  const title = data?.title ? data.title : info.name ? info.name : defaultTitle
  // lists made of songs without a cover (daily mix) take the cover of their first song
  const [songCover, setSongCover] = useState<string | null>(null)
  const firstSong = data?.list[0]
  const hasCover = !!(data?.img ?? info.img)
  useEffect(() => {
    setSongCover(null)
    if (hasCover || !firstSong) return
    return getListMusicPic(firstSong, setSongCover)
  }, [hasCover, firstSong])
  const cover = data?.img ?? info.img ?? songCover
  const isArtist = info.type == 'artist'
  // albums and artists can be collected: the library keeps a link to this page
  const collectionId = info.type == 'album' ? info.id ?? null : isArtist ? info.name ?? null : null
  const collections = useCollections()
  const collectedId = collectionId
  const isCollected = !!collectionId && collections.some(c => getCollectionKey(c.type, c.source, c.id) == getCollectionKey(info.type as 'album' | 'artist', info.source, collectionId))
  const handleCollect = () => {
    if (!collectionId) return
    toggleCollection({ type: info.type as 'album' | 'artist', source: info.source, id: collectionId, name: title, img: cover })
  }
  useEffect(() => {
    if (collectionId && data) updateCollection(info.type as 'album' | 'artist', info.source, collectionId, data.img, data.title)
  }, [collectionId, data, info.source, info.type])

  const header = (
    <View>
      <View style={styles.info}>
        <Image url={cover} style={{ width: COVER_SIZE, height: COVER_SIZE, borderRadius: isArtist ? COVER_SIZE / 2 : 14 }} />
        <View style={styles.infoRight}>
          <Text size={22} numberOfLines={2} style={styles.title}><TranslatedText text={title} translationFirst /></Text>
          {
            data?.subtitle
              ? <Text size={12} color={info.type == 'album' ? theme['c-primary-font-active'] : theme['c-font-label']} numberOfLines={3} onPress={info.type == 'album' ? openAlbumArtist : showDesc}>
                  <TranslatedText text={data.subtitle} replace />
                </Text>
              : null
          }
          <Text size={12} color={theme['c-font-label']}>
            {list.length ? t('collection__songs', { num: list.length }) : ''}
            {isArtist && data?.albums?.length ? `  ·  ${t('collection__albums_count', { num: data.albums.length })}` : ''}
          </Text>
          <ActionRow
            left={isArtist ? null : <DownloadButton disabled={!list.length} done={downloadState.done} downloading={downloadState.downloading} progress={downloadState.progress} partial={downloadState.partial} onPress={handleDownload} />}
            right={<>
              { collectedId ? <CollectButton collected={isCollected} disabled={status != 'done'} onPress={handleCollect} /> : null }
              <PlayButton disabled={!list.length} onPress={() => { handlePlay(0) }} />
            </>}
          />
        </View>
      </View>
      {
        data?.albums?.length || similar.length
          ? <View style={styles.albums}>
              {
                data?.albums?.length
                  ? <>
                      <Text size={15} style={styles.sectionTitle}>{t('collection__albums')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                        {data.albums.map(album => (
                          <TouchableOpacity key={`${album.source}_${album.id}`} activeOpacity={0.7} onPress={() => { openAlbum(album) }} style={{ width: ALBUM_SIZE }}>
                            <Image url={album.img} style={{ width: ALBUM_SIZE, height: ALBUM_SIZE, borderRadius: 12 }} />
                            <Text size={12} numberOfLines={2} style={styles.albumName}><TranslatedText text={album.name} replace /></Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  : null
              }
              {
                // the artists similar to this one (Last.fm, else Deezer)
                similar.length
                  ? <>
                      <Text size={15} style={styles.sectionTitle}>{t('artist__similar')}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                        {similar.map(artist => (
                          <TouchableOpacity key={artist.name} activeOpacity={0.7} onPress={() => { navigations.pushCollectionScreen(componentId, { type: 'artist', name: artist.name, img: artist.img }) }} style={{ width: ALBUM_SIZE }}>
                            <Image url={artist.img} style={{ width: ALBUM_SIZE, height: ALBUM_SIZE, borderRadius: ALBUM_SIZE / 2 }} />
                            <Text size={12} numberOfLines={2} style={styles.albumName}><TranslatedText text={artist.name} replace /></Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  : null
              }
              <Text size={15} style={styles.sectionTitle}>{t('collection__songs_title')}</Text>
            </View>
          : null
      }
      { status == 'loading' ? <SkeletonSongRows rowHeight={ROW_HEIGHT} /> : null }
      { status == 'failed' ? <Text size={13} color={theme['c-font-label']} style={styles.status}>{t('list_error')}</Text> : null }
      { status == 'done' && !list.length ? <Text size={13} color={theme['c-font-label']} style={styles.status}>{t('no_item')}</Text> : null }
    </View>
  )

  const Container = embedded ? EmbeddedContainer : PageContent
  return (
    <Container>
      { embedded ? null : <StatusBar /> }
      <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}>
        <View style={styles.topBar}>
          <BackButton onPress={back} size={HEADER_HEIGHT} />
          {
            isSticky
              ? <>
                  <Text numberOfLines={1} size={17} style={styles.topTitle}><TranslatedText text={title} replace /></Text>
                  <PlayButton size={34} disabled={!list.length} onPress={() => { handlePlay(0) }} />
                </>
              : null
          }
        </View>
      </View>
      <FlatList
        style={styles.list}
        data={list}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => <SongRow song={item} index={index} onPress={handlePlay} />}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        ListHeaderComponent={header}
        onScroll={handleScroll}
        scrollEventThrottle={48}
        initialNumToRender={12}
        windowSize={9}
      />
      { embedded ? null : <PlayerBar /> }
    </Container>
  )
})

const EmbeddedContainer = ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1 }}>{children}</View>

const styles = createStyle({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingRight: 14,
  },
  topTitle: {
    flex: 1,
    fontWeight: 'bold',
  },
  list: {
    flex: 1,
  },
  info: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  infoRight: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 6,
  },
  title: {
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  albums: {
    paddingBottom: 4,
  },
  sectionTitle: {
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 8,
  },
  rail: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 10,
  },
  albumName: {
    marginTop: 5,
  },
  status: {
    textAlign: 'center',
    paddingVertical: 30,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  songPic: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  songInfo: {
    flex: 1,
  },
})
