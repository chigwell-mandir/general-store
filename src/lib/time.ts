import { useEffect, useState } from 'react'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const clock = (iso: string) => timeFmt.format(new Date(iso))

export function when(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  return d.toDateString() === today.toDateString() ? clock(iso) : `${dayFmt.format(d)}, ${clock(iso)}`
}

/** Overdue once the event's cut-off time (e.g. 21:00) on the day of issue has passed. */
export function deadlineFor(issuedAt: string, overdueTime: string) {
  const [h, m] = overdueTime.split(':').map(Number)
  const d = new Date(issuedAt)
  const deadline = new Date(d)
  deadline.setHours(h || 0, m || 0, 0, 0)
  if (deadline <= d) deadline.setDate(deadline.getDate() + 1) // issued after cut-off → next day's cut-off
  return deadline.getTime()
}

/** Re-renders every `ms` so "out for 2h 14m" labels stay current. */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}
