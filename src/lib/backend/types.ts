import type { IssueArgs, TableName } from '../../types'

type Row = Record<string, unknown>

/** Everything the app needs from storage. Implemented by Supabase (live) and localStorage (demo). */
export interface Backend {
  mode: 'live' | 'demo'
  hasSession(): Promise<boolean>
  signIn(password: string): Promise<void>
  signOut(): Promise<void>

  load<T>(table: TableName): Promise<T[]>
  /** Calls back with the table name whenever another device (or tab) changes it. */
  subscribe(onChange: (table: TableName) => void): () => void

  insert(table: TableName, rows: Row[]): Promise<void>
  upsert(table: TableName, rows: Row[], onConflict: string): Promise<void>
  update(table: TableName, match: Row, patch: Row): Promise<void>
  remove(table: TableName, match: Row): Promise<void>

  /** Returns the new issue's id (used for Undo). */
  issueItem(args: IssueArgs): Promise<string>
  returnIssue(issueId: string, qty: number, by: string): Promise<void>
  voidIssue(issueId: string, by: string): Promise<void>
  setStockCount(itemId: string, count: number, by: string, reason?: string): Promise<void>
}

/** Thrown when an issue would take stock below zero; the desk can choose to override. */
export class InsufficientStockError extends Error {
  constructor(public available: number) {
    super(`Only ${available} left in store`)
  }
}
