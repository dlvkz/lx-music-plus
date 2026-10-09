// Sources write the same artist in different ways ("NewJeans", "NewJeans (뉴진스)", "周杰伦（Jay Chou）"):
// the alias in brackets at the end is left out when an artist is looked up or compared,
// so every spelling leads to the same artist page.
const ALIAS_RXP = /\s*[（([【][^（）()[\]【】]*[）)\]】]\s*$/

export const normalizeArtistName = (name: string): string => {
  let result = name.trim()
  // "A (B) (C)": every trailing group
  while (ALIAS_RXP.test(result)) {
    const next = result.replace(ALIAS_RXP, '').trim()
    if (!next) break
    result = next
  }
  return result
}

export const isSameArtist = (a: string | null | undefined, b: string | null | undefined): boolean => {
  if (!a || !b) return false
  return normalizeArtistName(a).toLowerCase() == normalizeArtistName(b).toLowerCase()
}
