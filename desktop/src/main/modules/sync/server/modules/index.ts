import { sync as listSync } from './list'
import { sync as dislikeSync } from './dislike'
import { sync as statsSync } from './stats'
import { sync as collectionsSync } from './collections'

export const callObj = Object.assign({},
  listSync.handler,
  dislikeSync.handler,
  statsSync.handler,
  collectionsSync.handler,
)

export const modules = {
  list: listSync,
  dislike: dislikeSync,
  stats: statsSync,
  collections: collectionsSync,
}


export { ListManage } from './list'

export { DislikeManage } from './dislike'

export const featureVersion = {
  list: 1,
  dislike: 1,
  stats: 1,
  collections: 1,
} as const
