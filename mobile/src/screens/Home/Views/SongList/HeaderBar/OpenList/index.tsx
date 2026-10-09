import { useRef, forwardRef, useImperativeHandle } from 'react'
// import { Icon } from '@/components/common/Icon'
import Button from '@/components/common/Button'
// import { navigations } from '@/navigation'
import Modal, { type ModalType } from './Modal'
import { type Source } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { navigations } from '@/navigation'
import commonState from '@/store/common/state'
import { detectPlaylistLink } from '@/utils/libraryImport'

// export interface OpenListProps {
//   onTagChange: (name: string, id: string) => void
// }

export interface OpenListType {
  setInfo: (source: Source) => void
}

export default forwardRef<OpenListType, {}>((props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const modalRef = useRef<ModalType>(null)
  const songlistInfoRef = useRef<{ source: Source }>({ source: 'kw' })

  useImperativeHandle(ref, () => ({
    setInfo(source) {
      songlistInfoRef.current.source = source
    },
  }))

  const handleOpenSonglist = (id: string) => {
    // console.log(id, songlistInfoRef.current.source)
    // a link of another platform: a playlist / album of Spotify, Deezer (their songs found on the main sources, like
    // the charts), YouTube, SoundCloud, or of a main source (whatever source is chosen)
    const link = detectPlaylistLink(id)
    if (link?.kind == 'chart') {
      navigations.pushCollectionScreen(commonState.componentIds.home!, { type: 'chart', id: `${link.source}__${link.id}`, name: link.source == 'sp' ? 'Spotify' : 'Deezer', source: link.source as LX.OnlineSource })
      return
    }
    navigations.pushSonglistDetailScreen(commonState.componentIds.home!, {
      play_count: undefined,
      id: link?.id ?? id,
      author: '',
      name: '',
      img: undefined,
      desc: undefined,
      source: (link?.source ?? songlistInfoRef.current.source) as Source,
    })
  }

  // const handleSourceChange: ModalProps['onSourceChange'] = (source) => {
  //   songlistInfoRef.current.source = source
  // }


  return (
    <>
      <Button style={{ ...styles.button, backgroundColor: theme['c-button-background'] }} onPress={() => modalRef.current?.show(songlistInfoRef.current.source)}>
        <Text size={13} color={theme['c-button-font']}>{t('songlist_open')}</Text>
      </Button>
      <Modal ref={modalRef} onOpenId={handleOpenSonglist} />
    </>
  )
})

const styles = createStyle({
  button: {
    // backgroundColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    paddingLeft: 14,
    paddingRight: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
})
