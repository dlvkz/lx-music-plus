import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import SongPic from '@/components/common/SongPic'
import { TranslatedText } from '@/components/common/TranslatedText'
import { getListMusics } from '@/core/list'
import { getArtistNames, openArtistName, openPlayingFrom } from '@/core/musicLinks'
import { playList } from '@/core/player/player'
import { usePlayingFrom } from '@/core/playingFrom'
import { getPlayMethod } from '@/core/player/playMethod'
import { getShuffleUpcoming } from '@/core/player/shuffleOrder'
import { useI18n } from '@/lang'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import playerState from '@/store/player/state'
import { useTheme } from '@/store/theme/hook'
import { useSettingValue } from '@/store/setting/hook'
import { createStyle } from '@/utils/tools'

// The queue of the player: what it plays from, the songs to play next ("play later"), the songs of the list
// played (the one playing marked); a song plays when it is tapped, an artist opens its page

const ITEM_HEIGHT = 58

interface Row {
  key: string
  musicInfo: LX.Music.MusicInfo
  /** its index in the list played, -1: a song to play later */
  index: number
}

const QueueRow = memo(({ row, playing, onPlay, onArtist }: {
  row: Row
  playing: boolean
  onPlay: (row: Row) => void
  onArtist: (name: string, musicInfo: LX.Music.MusicInfo) => void
}) => {
  const theme = useTheme()
  const names = getArtistNames(row.musicInfo)
  return (
    <TouchableOpacity activeOpacity={0.6} style={{ ...styles.row, backgroundColor: playing ? theme['c-button-background'] : 'transparent' }} onPress={() => { onPlay(row) }}>
      <SongPic musicInfo={row.musicInfo} size={42} />
      <View style={styles.rowText}>
        <Text size={14} numberOfLines={1} color={playing ? theme['c-primary-font'] : theme['c-font']} style={playing ? styles.playingName : undefined}>{playing ? '▶ ' : ''}<TranslatedText text={row.musicInfo.name} /></Text>
        {/* each artist opens its page */}
        <Text size={12} numberOfLines={1} color={theme['c-font-label']}>
          {names.map((name, index) => (
            <Text key={index} size={12} color={theme['c-font-label']}>
              {index ? '、' : ''}
              <Text size={12} color={theme['c-font-label']} onPress={() => { onArtist(name, row.musicInfo) }}>{name}</Text>
            </Text>
          ))}
        </Text>
      </View>
      {row.index < 0 ? <Text size={11} color={theme['c-font-label']}>↳</Text> : null}
    </TouchableOpacity>
  )
})

const QueueList = ({ onClose, onClosePlayer }: { onClose: () => void, onClosePlayer: () => void }) => {
  const t = useI18n()
  const theme = useTheme()
  const playInfo = usePlayInfo()
  const playMusicInfo = usePlayMusicInfo()
  const from = usePlayingFrom()
  // (shuffle shows its order: switched, the queue changes)
  const playMode = useSettingValue('player.togglePlayMethod')
  const listId = playInfo.playerListId
  const [list, setList] = useState<LX.Music.MusicInfo[]>([])
  // (the list can grow while it plays: the radio)
  useEffect(() => {
    if (!listId) {
      setList([])
      return
    }
    let isActive = true
    void getListMusics(listId).then(musics => { if (isActive) setList([...musics]) })
    return () => {
      isActive = false
    }
  }, [listId, playMusicInfo])

  const rows = useMemo(() => {
    const later: Row[] = playerState.tempPlayList.map((info, index) => {
      const musicInfo = 'progress' in info.musicInfo ? info.musicInfo.metadata.musicInfo : info.musicInfo
      return { key: `later_${index}_${musicInfo.id}`, musicInfo, index: -1 }
    })
    // shuffle: the song playing, then the ones it plays next in their order (core/player/shuffleOrder.ts)
    if (listId && getPlayMethod() == 'random') {
      const indexes = new Map(list.map((musicInfo, index) => [musicInfo.id, index]))
      const info = playMusicInfo.musicInfo
      const currentId = playMusicInfo.listId == listId && !playMusicInfo.isTempPlay && info ? 'progress' in info ? info.metadata.musicInfo.id : info.id : null
      const playedIds = new Set(playerState.playedList.filter(m => m.listId == listId).map(m => m.musicInfo.id))
      const current = currentId ? list.find(m => m.id == currentId) : null
      const upcoming = [...(current ? [current] : []), ...getShuffleUpcoming(listId, list, playedIds, currentId)]
      return [...later, ...upcoming.map(musicInfo => ({ key: musicInfo.id, musicInfo, index: indexes.get(musicInfo.id) ?? -1 }))]
    }
    return [...later, ...list.map((musicInfo, index) => ({ key: `${index}_${musicInfo.id}`, musicInfo, index }))]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, playMusicInfo, playMode])
  // the song playing (by its id: its index is not known yet after a restart)
  const playingId = (() => { const info = playMusicInfo.musicInfo; return info ? 'progress' in info ? info.metadata.musicInfo.id : info.id : null })()
  const playingRow = playMusicInfo.isTempPlay
    ? -1
    // (after a restart: the index restored)
    : playingId ? rows.findIndex(row => row.index >= 0 && row.musicInfo.id == playingId) : rows.findIndex(row => row.index >= 0 && row.index == playInfo.playIndex)

  const handlePlay = useCallback((row: Row) => {
    if (row.index < 0 || !listId) return
    void playList(listId, row.index)
  }, [listId])
  const handleArtist = useCallback((name: string, musicInfo: LX.Music.MusicInfo) => {
    onClose()
    openArtistName(name, musicInfo)
  }, [onClose])

  const openFrom = () => {
    if (!from?.target) return
    onClose()
    openPlayingFrom(from.target, onClosePlayer)
  }

  const listRef = useRef<FlatList<Row>>(null)
  const typeName = from ? t(`player__from_${from.type}`) : ''
  return (
    <View style={styles.container}>
      {
        from
          // (tapped: the page it comes from opens, the radio has none)
          ? <TouchableOpacity style={styles.from} disabled={!from.target} onPress={openFrom}>
              <Text size={11} color={theme['c-font-label']} style={styles.fromLabel}>{from.name ? `${t('player__playing_from')} · ${typeName}` : t('player__playing_from')}</Text>
              <Text size={15} numberOfLines={1} style={styles.fromName}>{from.name || typeName}{from.target ? '  ›' : ''}</Text>
            </TouchableOpacity>
          : null
      }
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={row => row.key}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        initialScrollIndex={playingRow > 2 ? playingRow - 2 : 0}
        renderItem={({ item, index }) => <QueueRow row={item} playing={index == playingRow} onPlay={handlePlay} onArtist={handleArtist} />}
        ListEmptyComponent={<Text size={13} color={theme['c-font-label']} style={styles.empty}>{t('no_item')}</Text>}
      />
    </View>
  )
}

export interface QueuePopupType {
  show: () => void
}

export default forwardRef<QueuePopupType, { onClosePlayer: () => void }>(({ onClosePlayer }, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const popupRef = useRef<PopupType>(null)

  useImperativeHandle(ref, () => ({
    show() {
      if (visible) popupRef.current?.setVisible(true)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          popupRef.current?.setVisible(true)
        })
      }
    },
  }))
  const close = useCallback(() => {
    popupRef.current?.setVisible(false)
  }, [])

  return (
    visible
      ? (
          <Popup ref={popupRef} title={t('player__queue')}>
            <QueueList onClose={close} onClosePlayer={onClosePlayer} />
          </Popup>
        )
      : null
  )
})

const styles = createStyle({
  container: {
    height: 520,
  },
  from: {
    paddingHorizontal: 15,
    paddingBottom: 8,
    gap: 2,
  },
  fromLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fromName: {
    fontWeight: 'bold',
  },
  row: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 10,
  },
  playingName: {
    fontWeight: 'bold',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 30,
  },
})
