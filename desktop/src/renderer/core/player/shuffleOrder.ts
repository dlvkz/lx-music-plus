// Shuffle (the "random" play mode) plays a shuffled order of the list (made when the list starts, songs added since
// placed at random in it, a new order once every song was played), so the queue can show what plays next

let order = { listId: '', rank: new Map<string, number>() }

const shuffled = (ids: string[]) => {
  const list = [...ids]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

const getRank = (listId: string, list: Array<{ id: string }>) => {
  // (a list not loaded yet: no order kept for it)
  if (!list.length) return new Map<string, number>()
  const added = order.listId == listId ? list.filter(musicInfo => !order.rank.has(musicInfo.id)) : list
  // a new list (or most of it new): a new order; a few songs added: each at a random place
  if (order.listId != listId || added.length > order.rank.size) order = { listId, rank: new Map(shuffled(list.map(m => m.id)).map((id, index) => [id, index])) }
  else {
    const size = order.rank.size
    for (const musicInfo of added) order.rank.set(musicInfo.id, Math.random() * size)
  }
  return order.rank
}

/**
 * A new order (every song of the list was played)
 */
export const resetShuffleOrder = () => {
  order = { listId: '', rank: new Map() }
}

/**
 * The song shuffle plays next: the first one of the order among the ones that can play (not played yet)
 */
export const pickShuffleNext = <T extends { id: string }>(listId: string, list: Array<{ id: string }>, candidates: T[], currentId?: string | null): T | null => {
  const rank = getRank(listId, list)
  let next: T | null = null
  let nextRank = Infinity
  for (const musicInfo of candidates) {
    if (musicInfo.id == currentId) continue
    const value = rank.get(musicInfo.id) ?? Infinity
    if (value < nextRank) {
      next = musicInfo
      nextRank = value
    }
  }
  return next ?? candidates[0] ?? null
}

/**
 * The songs shuffle plays next, in their order (the queue)
 */
export const getShuffleUpcoming = <T extends { id: string }>(listId: string, list: T[], playedIds: Set<string>, currentId?: string | null): T[] => {
  const rank = getRank(listId, list)
  return list
    .filter(musicInfo => musicInfo.id != currentId && !playedIds.has(musicInfo.id))
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity))
}
