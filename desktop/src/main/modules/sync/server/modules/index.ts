import { sync as listSync } from './list'
import { sync as dislikeSync } from './dislike'
import { sync as statsSync } from './stats'

export const callObj = Object.assign({},
  listSync.handler,
  dislikeSync.handler,
  statsSync.handler,
)

export const modules = {
  list: listSync,
  dislike: dislikeSync,
  stats: statsSync,
}


export { ListManage } from './list'

export { DislikeManage } from './dislike'

export const featureVersion = {
  list: 1,
  dislike: 1,
  stats: 1,
} as const
