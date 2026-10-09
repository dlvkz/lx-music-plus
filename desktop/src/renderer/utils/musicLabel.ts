// Ported from Any Listen: packages/shared/common/tools.ts (buildSourceLabel)
const labelMap: Record<string, string> = {
  master: 'MASTER',
  dolby: 'ATMOS',
  flac24bit: 'HR',
  flac: 'SQ',
  wav: 'WAV',
  '320k': '320K',
  '192k': '192K',
  '128k': '128K',
}
const QUALITYS_REV = ['master', 'dolby', 'flac24bit', 'wav', 'flac', '320k', '192k', '128k']

export const badgeTypes = ['primary', 'secondary', 'tertiary'] as const

/**
 * Labels shown next to a song name: source + best quality, e.g. ['kw', 'SQ']
 */
export const buildSourceLabel = (musicInfo: LX.Music.MusicInfo): string[] => {
  if (musicInfo.source == 'local') {
    const ext = musicInfo.meta.ext?.toLowerCase()
    return ['local', ext && labelMap[ext] ? labelMap[ext] : (ext ?? '').toUpperCase()].filter(s => s)
  }
  const qualitys = (musicInfo.meta as LX.Music.MusicInfoMeta_online)._qualitys ?? {}
  const quality = QUALITYS_REV.find(q => !!qualitys[q as keyof typeof qualitys])
  return [musicInfo.source.toLowerCase(), quality ? labelMap[quality] : ''].filter(s => s)
}
