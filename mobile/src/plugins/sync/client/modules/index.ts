import * as list from './list'
import * as dislike from './dislike'
import * as stats from './stats'
import * as collections from './collections'
// export * as theme from './theme'


export const callObj = Object.assign({},
  list.handler,
  dislike.handler,
  stats.handler,
  collections.handler,
)


export const modules = {
  list,
  dislike,
  stats,
  collections,
}

export const featureVersion = {
  list: 1,
  dislike: 1,
  stats: 1,
  collections: 1,
} as const
