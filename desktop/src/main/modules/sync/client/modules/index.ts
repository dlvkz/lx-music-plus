import * as list from './list'
import * as dislike from './dislike'
import * as stats from './stats'
// export * as theme from './theme'


export const callObj = Object.assign({},
  list.handler,
  dislike.handler,
  stats.handler,
)


export const modules = {
  list,
  dislike,
  stats,
}

export const featureVersion = {
  list: 1,
  dislike: 1,
  stats: 1,
} as const
