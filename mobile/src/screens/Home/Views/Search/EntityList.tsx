import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import { searchAlbums, searchArtists, type AlbumSearchResult, type ArtistSearchResult } from '@/utils/entitySearch'
import { SECONDARY_SOURCE_NAMES } from '@/utils/secondarySources'
import { createStyle } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import Image from '@/components/common/Image'
import Badge from '@/components/common/Badge'
import { TranslatedText } from '@/components/common/TranslatedText'
import { type CollectionInfo } from '@/screens/Collection/data'

// Artist / album search: the artists and albums of every source at once (utils/entitySearch.ts); an artist
// opens the artist page of the name (all the sources), an album the album page of its source

export type EntityType = 'artist' | 'album'

export interface EntityListType {
  loadList: (text: string, type: EntityType) => void
}

// the sources searched, the first ones first (the ones with artist / album pages in the app)
const ARTIST_SOURCES = ['wy', 'kw', 'sc', 'bc']
const ALBUM_SOURCES = ['wy', 'kw', 'sc', 'bc', 'kh']

const IMAGE_SIZE = scaleSizeW(56)

// the results of the last searches: coming back to a search shows them at once
const cache = new Map<string, ArtistSearchResult[] | AlbumSearchResult[]>()

const secondaryName = (source: string) => (SECONDARY_SOURCE_NAMES as Record<string, string>)[source] ?? ''

type Item = { kind: 'artist', item: ArtistSearchResult } | { kind: 'album', item: AlbumSearchResult }

export default forwardRef<EntityListType, {}>((props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const [items, setItems] = useState<Item[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle')
  const tokenRef = useRef(0)

  const show = (type: EntityType, list: ArtistSearchResult[] | AlbumSearchResult[]) => {
    setItems(type == 'artist'
      ? (list as ArtistSearchResult[]).map(item => ({ kind: 'artist', item }))
      : (list as AlbumSearchResult[]).map(item => ({ kind: 'album', item })))
    setStatus(list.length ? 'idle' : 'empty')
  }

  useImperativeHandle(ref, () => ({
    loadList(text, type) {
      const current = ++tokenRef.current
      const key = `${type}__${text}`
      const cached = cache.get(key)
      if (cached) {
        show(type, cached)
        return
      }
      setItems([])
      setStatus('loading')
      const task = type == 'artist' ? searchArtists(text, ARTIST_SOURCES) : searchAlbums(text, ALBUM_SOURCES)
      void task.then(list => {
        if (current != tokenRef.current) return
        if (cache.size > 30) cache.clear()
        cache.set(key, list)
        show(type, list)
      }).catch(() => {
        if (current == tokenRef.current) setStatus('error')
      })
    },
  }), [])

  const handlePress = useCallback((entry: Item) => {
    const info: CollectionInfo = entry.kind == 'artist'
      ? { type: 'artist', name: entry.item.name, img: entry.item.img }
      : { type: 'album', source: entry.item.source as LX.OnlineSource, id: entry.item.id, name: entry.item.name, img: entry.item.img }
    navigations.pushCollectionScreen(commonState.componentIds.home!, info)
  }, [])

  const renderItem = ({ item: entry }: { item: Item }) => {
    const isArtist = entry.kind == 'artist'
    const img = entry.item.img
    // the artists only on a secondary source / the albums of a secondary source say where they are from
    const label = isArtist
      ? (entry.item.sources.every(source => secondaryName(source)) ? entry.item.sources.map(secondaryName).join(' · ') : '')
      : secondaryName(entry.item.source)
    const subtitle = isArtist ? '' : [entry.item.artist, entry.item.time].filter(Boolean).join('  ·  ')
    return (
      <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => { handlePress(entry) }}>
        <Image url={img} style={{ width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: isArtist ? IMAGE_SIZE / 2 : 8 }} />
        <View style={styles.info}>
          <Text size={15} numberOfLines={1}><TranslatedText text={entry.item.name} /></Text>
          {
            label || subtitle
              ? <View style={styles.subtitle}>
                  {label ? <Badge type="tertiary">{label}</Badge> : null}
                  {subtitle ? <Text size={12} color={theme['c-font-label']} numberOfLines={1} style={styles.subtitleText}>{subtitle}</Text> : null}
                </View>
              : null
          }
        </View>
      </TouchableOpacity>
    )
  }

  const statusText = status == 'loading'
    ? t('list_loading')
    : status == 'empty' ? t('no_item') : status == 'error' ? t('list_error') : ''

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={(entry) => entry.kind == 'artist' ? `artist_${entry.item.name}` : `album_${entry.item.source}_${entry.item.id}`}
      keyboardShouldPersistTaps="always"
      ListEmptyComponent={statusText ? <Text style={styles.status} color={theme['c-font-label']}>{statusText}</Text> : null}
    />
  )
})

const styles = createStyle({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    gap: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitleText: {
    flexShrink: 1,
  },
  status: {
    textAlign: 'center',
    paddingVertical: 30,
  },
})
