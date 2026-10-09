import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import Content from './Content'
import TagListContent, { type ListType as TagListType } from './TagList/List'
import { useTheme } from '@/store/theme/hook'
import Modal, { type ModalType } from '@/components/common/Modal'
import { createStyle } from '@/utils/tools'
import { type Source } from '@/store/songlist/state'

// The playlist category picker opens as a popup in the middle of the screen, like the other dialogs
export default () => {
  const modalRef = useRef<ModalType>(null)
  const tagListRef = useRef<TagListType>(null)
  const theme = useTheme()

  useEffect(() => {
    const handleShow = (source: Source, id: string) => {
      modalRef.current?.setVisible(true)
      // the list is mounted with the popup
      const load = (retry = 5) => {
        requestAnimationFrame(() => {
          if (tagListRef.current) tagListRef.current.loadTag(source, id)
          else if (retry > 0) load(retry - 1)
        })
      }
      load()
    }
    const handleHide = () => {
      modalRef.current?.setVisible(false)
    }

    global.app_event.on('showSonglistTagList', handleShow)
    global.app_event.on('hideSonglistTagList', handleHide)

    return () => {
      global.app_event.off('showSonglistTagList', handleShow)
      global.app_event.off('hideSonglistTagList', handleHide)
    }
  }, [])

  const handleTagChange = (name: string, id: string) => {
    global.app_event.hideSonglistTagList()
    requestAnimationFrame(() => {
      global.app_event.songlistTagInfoChange(name, id)
    })
  }

  return (
    <>
      <Content />
      <Modal ref={modalRef} bgColor="rgba(50,50,50,.3)">
        <View style={styles.centeredView}>
          <View style={{ ...styles.popup, backgroundColor: theme['c-content-background'] }} onStartShouldSetResponder={() => true}>
            <TagListContent ref={tagListRef} onTagChange={handleTagChange} />
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    width: '86%',
    maxWidth: 460,
    maxHeight: '74%',
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 4,
  },
})
