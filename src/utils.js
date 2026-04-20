export const DASHBOARD_USERS = [
  { id: 1725698, name: 'Meg', email: 'margherita@quatt.io' },
  { id: 1728051, name: 'Wies', email: 'wies@quatt.io' },
  { id: 1788663, name: 'Valentina', email: 'valentina@quatt.io' },
  { id: 1843372, name: 'Bassel', email: 'bassel@quatt.io' },
  { id: 1904272, name: 'Jessey', email: 'jessey@quatt.io' },
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
  if (period === 'day') {
    const d = new Date()
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59)
    return { from: Math.floor(midnight.getTime() / 1000), to: Math.floor(endOfDay.getTime() / 1000) }
  }
  if (period === 'lastweek') {
    const d = new Date()
    const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay() // Mon=1 … Sun=7
    const lastMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek - 6, 0, 0, 0)
    const lastSunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek, 23, 59, 59)
    return { from: Math.floor(lastMonday.getTime() / 1000), to: Math.floor(lastSunday.getTime() / 1000) }
  }
  return {
    from: { week: now - 7 * 86400, month: now - 30 * 86400, year: yearStart }[period],
    to: now,
  }
}

export function filterCalls(calls, period, selectedUserIds) {
  const { from, to } = getPeriodBounds(period)
  return calls.filter(c => {
    if (!isRelevantCall(c)) return false
    if (c.started_at < from || c.started_at > to) return false
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
  const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0)
  return { inbound, outbound, missed, avgDuration, avgWait, total: calls.length, totalDuration }
}

export function formatDuration(seconds) {
  if (!seconds) return '0s'
  if (seconds < 60) return `${seconds}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function computeVolumeData(calls, period) {
  if (period === 'day') {
    const hours = Array.from({ length: 24 }, (_, i) => ({ label: `${i}h`, count: 0 }))
    calls.forEach(c => { hours[new Date(c.started_at * 1000).getHours()].count++ })
    return hours
  }
  if (period === 'week' || period === 'lastweek') {
    const anchor = new Date()
    if (period === 'lastweek') {
      const dow = anchor.getDay() === 0 ? 7 : anchor.getDay()
      anchor.setDate(anchor.getDate() - dow - 6)
    } else {
      anchor.setDate(anchor.getDate() - 6)
    }
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor); d.setDate(anchor.getDate() + i)
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
  const stats = Object.fromEntries(users.map(u => [u.id, {
    name: u.name,
    inbound: 0, inboundAnswered: 0,
    outbound: 0, outboundAnswered: 0,
    totalDuration: 0,
  }]))
  calls.forEach(c => {
    if (c.user_id && stats[c.user_id]) {
      const s = stats[c.user_id]
      if (c.direction === 'inbound') {
        s.inbound++
        if (c.answered_at) { s.inboundAnswered++; s.totalDuration += c.duration }
      } else {
        s.outbound++
        if (c.answered_at) { s.outboundAnswered++; s.totalDuration += c.duration }
      }
    }
  })
  return users.map(u => {
    const s = stats[u.id]
    return {
      name: u.name,
      inbound: s.inbound,
      outbound: s.outbound,
      inboundPickupRate: s.inbound ? Math.round((s.inboundAnswered / s.inbound) * 100) : 0,
      outboundPickupRate: s.outbound ? Math.round((s.outboundAnswered / s.outbound) * 100) : 0,
      totalDuration: s.totalDuration,
      handled: s.inbound + s.outbound,
    }
  }).sort((a, b) => b.handled - a.handled)
}
