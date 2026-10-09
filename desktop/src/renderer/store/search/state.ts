import { ref, shallowReactive } from '@common/utils/vueTools'


export const searchText = ref('')

// increased when the same text is submitted again, e.g. after switching the search translation
export const searchRepeatCount = ref(0)

export type onlineSource = LX.OnlineSource


export const historyList = shallowReactive<string[]>([])
