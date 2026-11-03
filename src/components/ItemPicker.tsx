import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Item } from '../types'
import { useStore } from '../lib/store'
import { CATEGORY_ORDER } from '../lib/seed'
import { matchesItem } from '../lib/search'
import { Swatch } from './ui'

export function sortItems(items: Item[]) {
  const rank = (c: string) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? 99 : i }
  return [...items].sort((a, b) => rank(a.category) - rank(b.category) || a.category.localeCompare(b.category) || a.sort - b.sort)
}

export function stockLabel(item: Item) {
  if (!item.track_stock) return 'not counted'
  return item.in_store === 0 ? 'none left' : `${item.in_store} in store`
}

/** Category chips + filter + tile grid. Tap a tile to pick the item. */
export function ItemPicker({ onPick }: { onPick: (item: Item) => void }) {
  const { data } = useStore()
  const [q, setQ] = useState('')
  const items = useMemo(() => sortItems(data.items.filter((i) => i.active)), [data.items])
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items])
  const [cat, setCat] = useState<string | null>(null)
  const shown = items.filter((i) => (q ? matchesItem(i, q) : !cat || i.category === cat))

  return (
    <div className="stack">
      <div className="search-box">
        <Search aria-hidden />
        <input className="search-input compact" placeholder="Find an item…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find an item" />
      </div>
      {!q && (
        <div className="chips" role="group" aria-label="Categories">
          <button className="chip" aria-pressed={cat === null} onClick={() => setCat(null)}>All</button>
          {categories.map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      )}
      <div className="item-grid">
        {shown.map((i) => (
          <button key={i.id} className={`item-btn ${i.track_stock && i.in_store === 0 ? 'empty' : ''}`} onClick={() => onPick(i)}>
            <span className="subtle" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{i.category}</span>
            <span className="item-name row"><Swatch category={i.category} name={i.name} />{i.name}</span>
            <span className="item-stock">{stockLabel(i)}{!i.returnable && ' · consumable'}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="subtle">No items match. Add new items under More → Stock.</p>}
    </div>
  )
}
