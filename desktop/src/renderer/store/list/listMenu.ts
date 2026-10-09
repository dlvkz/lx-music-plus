// The menu of the lists lives in the sidebar (components/layout/Aside/MyList): other places showing
// the lists (the library page) open that same menu for a list.

type ShowListMenu = (event: MouseEvent, listId: string) => void

let handler: ShowListMenu | null = null

export const setListMenuHandler = (fn: ShowListMenu | null) => {
  handler = fn
}

export const showListMenu = (event: MouseEvent, listId: string) => {
  handler?.(event, listId)
}
