import { useHorizontalMode } from '@/utils/hooks'
import Horizontal from './Horizontal'
import Grid from './Grid'

export default () => {
  const isHorizontalMode = useHorizontalMode()

  if (isHorizontalMode) return <Horizontal />
  // the charts of every platform, mixed (the platforms are chosen in its menu)
  return <Grid />
}
