import { removeDownloads, type DownloadState } from '@/core/download'
import { showThemedDialog } from '@/utils/tools'

/**
 * A second tap on the download button of a (partly) downloaded album / playlist:
 * its downloads can be cancelled or removed (files included), and when only some of its songs
 * are downloaded the others can be downloaded (`downloadRest`)
 * @returns whether they were removed
 */
export const confirmRemoveDownloads = async(name: string, state: Pick<DownloadState, 'taskIds' | 'downloading' | 'done' | 'completed' | 'total'>, downloadRest?: () => void) => {
  // i18n.t uses `this`
  const t: typeof global.i18n.t = (key, val) => global.i18n.t(key, val)
  const partial = !!downloadRest && !state.downloading && !state.done
  const keep = { text: t('download__keep'), value: 'keep' as const }
  const remove = { text: t(state.downloading ? 'download__cancel' : 'download__remove_group'), value: 'remove' as const }
  const action = await showThemedDialog<'keep' | 'rest' | 'remove'>({
    message: t(state.downloading ? 'download__cancel_tip' : partial ? 'download__partial_tip' : 'download__remove_group_tip', { name, completed: state.completed, total: state.total }),
    vertical: partial,
    buttons: partial
      ? [{ text: t('download__rest'), value: 'rest', primary: true }, remove, keep]
      : [keep, { ...remove, primary: true }],
  })
  if (action == 'rest') {
    downloadRest!()
    return false
  }
  if (action != 'remove') return false
  await removeDownloads(state.taskIds)
  return true
}
