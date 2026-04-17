export const DASHBOARD_USERS = [
  { id: 1725698, name: 'Meg', email: 'margherita@quatt.io' },
  { id: 1728051, name: 'Wies', email: 'wies@quatt.io' },
  { id: 1788663, name: 'Valentina', email: 'valentina@quatt.io' },
  { id: 1843372, name: 'Bassel', email: 'bassel@quatt.io' },
  { id: null, name: 'Jessey', email: 'jessey@quatt.io' }, // not in Aircall yet
]

const DASHBOARD_USER_IDS = new Set(DASHBOARD_USERS.map(u => u.id).filter(Boolean))
const ISM_NUMBER_ID = 1179637 // +31 20 532 6088 — IVR ISM

// Base filter: only calls involving a dashboard user OR via the ISM number
function isRelevantCall(c) {
  return DASHBOARD_USER_IDS.has(c.user_id) || c.number_id === ISM_NUMBER_ID
}

export function getPeriodBounds(period) {
  const now = Math.floor(Date.now() / 1000)
  const yearStart = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000)
  return { day: now - 86400, week: now - 7 * 86400, month: now - 30 * 86400, year: yearStart }[period]
}

export function filterCalls(calls, period, selectedUserIds) {
  const from = getPeriodBounds(period)
  return calls.filter(c => {
    if (!isRelevantCall(c)) return false
    if (c.started_at < from) return false
    if (selectedUserIds.length > 0 && !selectedUserIds.includes(c.user_id)) return false
    return true
  })
}

export function computeKPIs(calls) {
  const inbound = calls.filter(c => c.direction === 'inbound').length
  const outbound = calls.filter(c => c.direction === 'outbound').length
  const missed = calls.filter(c => c.direction === 'inbound' && !c.answered_at).length
  const answered = calls.filter(c => c.answered_at)
  const avgDuration = answered.length
    ? Math.round(answered.reduce((s, c) => s + c.duration, 0) / answered.length)
    : 0
  const answeredWithWait = answered.filter(c => c.wait_time != null && c.wait_time >= 0)
  const avgWait = answeredWithWait.length
    ? Math.round(answeredWithWait.reduce((s, c) => s + c.wait_time, 0) / answeredWithWait.length)
    : 0
  return { inbound, outbound, missed, avgDuration, avgWait, total: calls.length }
}

export function formatDuration(seconds) {
  if (!seconds) return '0s'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function computeVolumeData(calls, period) {
  if (period === 'day') {
    const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, count: 0 }))
    calls.forEach(c => { hours[new Date(c.started_at * 1000).getHours()].count++ })
    return hours
  }
  if (period === 'week') {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return { label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }), count: 0, key: d.toDateString() }
    })
    calls.forEach(c => {
      const key = new Date(c.started_at * 1000).toDateString()
      const idx = days.findIndex(d => d.key === key)
      if (idx >= 0) days[idx].count++
    })
    return days
  }
  if (period === 'month') {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - i))
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0, key: d.toDateString() }
    })
    calls.forEach(c => {
      const key = new Date(c.started_at * 1000).toDateString()
      const idx = days.findIndex(d => d.key === key)
      if (idx >= 0) days[idx].count++
    })
    return days
  }
  if (period === 'year') {
    const now = new Date()
    const months = Array.from({ length: now.getMonth() + 1 }, (_, m) => ({
      label: new Date(now.getFullYear(), m, 1).toLocaleDateString('en', { month: 'short' }),
      count: 0, month: m
    }))
    calls.forEach(c => {
      const d = new Date(c.started_at * 1000)
      if (d.getFullYear() === now.getFullYear()) months[d.getMonth()].count++
    })
    return months
  }
  return []
}

export function computeHeatmapData(calls) {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0))
  calls.forEach(c => {
    const d = new Date(c.started_at * 1000)
    grid[d.getDay()][d.getHours()]++
  })
  return grid
}

export function computeUserStats(calls, users) {
  const stats = Object.fromEntries(users.map(u => [u.id, { name: u.name, handled: 0, answered: 0, totalDuration: 0 }]))
  calls.forEach(c => {
    if (c.user_id && stats[c.user_id]) {
      stats[c.user_id].handled++
      if (c.answered_at) {
        stats[c.user_id].answered++
        stats[c.user_id].totalDuration += c.duration
      }
    }
  })
  return users.map(u => ({
    name: u.name,
    handled: stats[u.id].handled,
    answered: stats[u.id].answered,
    avgDuration: stats[u.id].answered ? Math.round(stats[u.id].totalDuration / stats[u.id].answered) : 0,
    answerRate: stats[u.id].handled ? Math.round((stats[u.id].answered / stats[u.id].handled) * 100) : 0,
  })).sort((a, b) => b.handled - a.handled)
}
