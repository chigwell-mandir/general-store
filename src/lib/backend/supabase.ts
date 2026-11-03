import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { IssueArgs, TableName } from '../../types'
import { InsufficientStockError, type Backend } from './types'

const PAGE = 1000 // Supabase returns at most 1000 rows per request

const ORDER: Partial<Record<TableName, string>> = {
  activity: 'at',
  issues: 'issued_at',
  volunteers: 'full_name',
  items: 'sort',
}

function fail(error: { message: string } | null) {
  if (!error) return
  const m = /INSUFFICIENT_STOCK:(\d+)/.exec(error.message)
  if (m) throw new InsufficientStockError(Number(m[1]))
  throw new Error(error.message)
}

export function createSupabaseBackend(url: string, key: string, deskEmail: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

  return {
    mode: 'live',

    async hasSession() {
      const { data } = await sb.auth.getSession()
      return !!data.session
    },
    async signIn(password) {
      const { error } = await sb.auth.signInWithPassword({ email: deskEmail, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong password' : error.message)
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async load<T>(table: TableName) {
      const rows: T[] = []
      for (let from = 0; ; from += PAGE) {
        let q = sb.from(table).select('*').range(from, from + PAGE - 1)
        const order = ORDER[table]
        if (order) q = q.order(order, { ascending: table !== 'activity' })
        const { data, error } = await q
        // desk_users only exists once supabase/2-desk-permissions.sql has been run
        if (error && table === 'desk_users' && /desk_users|42P01|PGRST205/.test(`${error.message} ${(error as { code?: string }).code}`)) return rows
        fail(error)
        rows.push(...((data ?? []) as T[]))
        if (!data || data.length < PAGE) return rows
      }
    },

    subscribe(onChange) {
      const channel = sb
        .channel('store-changes')
        .on('postgres_changes', { event: '*', schema: 'public' }, (p) => onChange(p.table as TableName))
        .subscribe()
      return () => {
        sb.removeChannel(channel)
      }
    },

    async insert(table, rows) {
      fail((await sb.from(table).insert(rows)).error)
    },
    async upsert(table, rows, onConflict) {
      fail((await sb.from(table).upsert(rows, { onConflict })).error)
    },
    async update(table, match, patch) {
      fail((await sb.from(table).update(patch).match(match)).error)
    },
    async updateMany(table, ids, patch) {
      for (let i = 0; i < ids.length; i += 200) fail((await sb.from(table).update(patch).in('id', ids.slice(i, i + 200))).error)
    },
    async remove(table, match) {
      fail((await sb.from(table).delete().match(match)).error)
    },
    async clear(table) {
      const key = table === 'department_leads' ? 'department' : 'id'
      fail((await sb.from(table).delete().not(key, 'is', null)).error)
    },

    async issueItem(args: IssueArgs) {
      const { data, error } = await sb.rpc('issue_item', args)
      fail(error)
      return (data as { id: string }).id
    },
    async returnIssue(issueId, qty, by) {
      fail((await sb.rpc('return_issue', { p_issue_id: issueId, p_qty: qty, p_by: by })).error)
    },
    async voidIssue(issueId, by) {
      fail((await sb.rpc('void_issue', { p_issue_id: issueId, p_by: by })).error)
    },
    async setStockCount(itemId, count, by, reason) {
      fail((await sb.rpc('set_stock_count', { p_item_id: itemId, p_count: count, p_by: by, p_reason: reason ?? null })).error)
    },
  }
}
