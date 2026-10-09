import { ref } from '@common/utils/vueTools'

// Playlist grid layout: detailed rows (cover + description) or compact cover cards
const KEY = 'lx_songlist_compact_view'

// compact unless the user switched to the detailed rows
let saved = true
try {
  saved = localStorage.getItem(KEY) != '0'
} catch {}

export const isCompactView = ref(saved)

export const toggleCompactView = () => {
  isCompactView.value = !isCompactView.value
  try {
    localStorage.setItem(KEY, isCompactView.value ? '1' : '0')
  } catch {}
}
