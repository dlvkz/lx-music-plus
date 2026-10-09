import { dialog } from '@renderer/plugins/Dialog'
import { removeDownloadTasks } from './action'
import type { DownloadState } from './sync'

/**
 * A second click on the download button of a (partly) downloaded album / playlist / list:
 * its downloads can be cancelled or removed (files included), and when only some of its songs
 * are downloaded the others can be downloaded (`downloadRest`)
 * @returns whether they were removed
 */
export const confirmRemoveDownloads = async(name: string, state: DownloadState, downloadRest?: () => void | Promise<void>) => {
  // i18n.t uses `this`
  const t: typeof window.i18n.t = (key, val) => window.i18n.t(key, val)
  const partial = !!downloadRest && !state.downloading && !state.done
  const result: boolean | 'extra' = await dialog.confirm({
    message: state.downloading
      ? t('download__cancel_tip', { name })
      : partial
        ? t('download__partial_tip', { name, completed: state.completed, total: state.total })
        : t('download__remove_tip', { name }),
    cancelButtonText: t('download__keep'),
    // partly downloaded: keep / remove / download the rest
    extraButtonText: partial ? t('download__remove') : '',
    confirmButtonText: t(state.downloading ? 'download__cancel' : partial ? 'download__rest' : 'download__remove'),
  })
  if (partial && result === true) {
    await downloadRest()
    return false
  }
  if (result !== (partial ? 'extra' : true)) return false
  await removeDownloadTasks(state.taskIds, true)
  return true
}
