import Fuse from 'fuse.js'
import type { Item, Volunteer } from '../types'

export const normalise = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * myBAPS-style search: Satsang ID matches exactly (then by prefix), names match fuzzily,
 * so "vish", "vishal", "vishalbhai" and small typos all find the right person.
 */
export function createPeopleSearch(people: Volunteer[]) {
  const fuse = new Fuse(people, {
    keys: [{ name: 'full_name', weight: 1 }],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: true,
  })
  const bySid = new Map(people.filter((p) => p.satsang_id).map((p) => [p.satsang_id!, p]))

  return (raw: string, limit = 8): Volunteer[] => {
    const q = raw.trim()
    if (!q) return []
    if (/^\d+$/.test(q)) {
      const exact = bySid.get(q.replace(/^0+/, '')) ?? bySid.get(q)
      const prefix = people.filter((p) => p.satsang_id?.startsWith(q) && p !== exact)
      // Long digit strings may be a phone number
      const phone = q.length >= 5 ? people.filter((p) => p.phone?.replace(/\D/g, '').includes(q) && p !== exact && !prefix.includes(p)) : []
      return [...(exact ? [exact] : []), ...prefix, ...phone].slice(0, limit)
    }
    const nq = normalise(q)
    // Starts-with matches on any word rank above fuzzy matches
    const starts = people.filter((p) => normalise(p.full_name).split(' ').some((w) => w.startsWith(nq)) || normalise(p.full_name).startsWith(nq))
    const fuzzy = fuse.search(q, { limit: limit * 2 }).map((r) => r.item).filter((p) => !starts.includes(p))
    starts.sort((a, b) => a.full_name.localeCompare(b.full_name))
    return [...starts, ...fuzzy].slice(0, limit)
  }
}

export function itemLabel(item: Pick<Item, 'category' | 'name'>) {
  if (item.category === 'Hi-Vis') return `${item.name} hi-vis`
  if (item.category === 'Lanyards') return `${item.name} lanyard`
  return item.name
}

export function matchesItem(item: Item, q: string) {
  const n = normalise(q)
  if (!n) return true
  const hay = normalise(`${item.category} ${item.name} ${itemLabel(item)}`)
  return n.split(' ').every((w) => hay.includes(w))
}
