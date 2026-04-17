#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const API_ID = process.env.AIRCALL_API_ID
const API_TOKEN = process.env.AIRCALL_API_TOKEN

if (!API_ID || !API_TOKEN) { console.error('Missing AIRCALL_API_ID or AIRCALL_API_TOKEN'); process.exit(1) }

const AUTH = Buffer.from(`${API_ID}:${API_TOKEN}`).toString('base64')
const PER_PAGE = 50

async function aircall(path, params = {}) {
  const url = new URL(`https://api.aircall.io${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: { Authorization: `Basic ${AUTH}` } })
  if (!res.ok) { const b = await res.text().catch(() => ''); throw new Error(`Aircall ${path}: ${res.status} ${b.slice(0, 200)}`) }
  return res.json()
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function fetchAllCalls(fromTs) {
  const calls = []
  let page = 1
  let totalPages = 1
  console.log(`Fetching calls from ${new Date(fromTs * 1000).toISOString().slice(0, 10)}...`)
  while (page <= totalPages) {
    process.stdout.write(`\r  Page ${page}/${totalPages}   `)
    const data = await aircall('/v1/calls', { page, per_page: PER_PAGE, from: fromTs, order: 'asc' })
    calls.push(...(data.calls || []))
    // Aircall uses meta.total (count), not meta.total_pages
    const total = data.meta?.total || calls.length
    totalPages = Math.ceil(total / PER_PAGE)
    page++
    if (page <= totalPages) await sleep(1100) // stay under 60 req/min rate limit
  }
  console.log(`\n  Fetched ${calls.length} calls`)
  return calls
}

async function fetchUsers() {
  const data = await aircall('/v1/users', { per_page: 100 })
  return data.users || []
}

async function fetchTranscription(callId) {
  try {
    const data = await aircall(`/v1/calls/${callId}/transcription`)
    return data.transcription?.content?.utterances || null
  } catch { return null }
}

// Dutch + English stop words for transcript topic extraction
const STOP = new Set([
  'de','het','een','is','dat','op','te','en','van','ik','je','we','ze','hij','zij','dit','die',
  'met','voor','niet','maar','ook','dan','meer','als','zo','er','bij','aan','zijn','was','hebben',
  'heeft','had','worden','wordt','werd','kan','wil','moet','mag','zal','zou','wel','nog','al','nu',
  'ja','nee','hoe','wat','wie','waar','wanneer','om','af','in','uit','over','door','naar','want',
  'of','heb','bent','ben','dus','uw','ons','onze','hun','jullie','u','hem','haar','mij','mijn',
  'jouw','heel','goed','even','eens','ok','okay','hm','hmm','dag','hoi','doei','bye','even',
  'gewoon','want','eigenlijk','eigenlijk','misschien','gewoon','zeg','hoor','toch','echt','hier',
  'the','a','an','it','in','on','at','to','for','of','and','or','but','not','with','this','that',
  'are','be','been','have','has','do','does','did','will','would','could','should','may','might',
  'can','i','you','my','your','our','their','yes','no','so','just','if','then','what','how',
  'when','where','who','yeah','uh','um','ah','oh','well','right','okay','sure','hi','hello','bye',
  'know','think','like','get','got','going','want','need','make','see','look','come','go','said',
  'say','saying','told','tell','thing','things','call','called','calling','speak','speaking',
])

function extractTopics(transcripts) {
  const freq = {}
  for (const { text } of transcripts) {
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
    words.forEach(w => {
      if (w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w)) {
        freq[w] = (freq[w] || 0) + 1
      }
    })
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))
}

async function analyzeWithClaude(transcripts) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const content = transcripts.map((t, i) => `[Call ${i + 1} ID:${t.call_id}]\n${t.text.slice(0, 700)}`).join('\n\n---\n\n')
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze these call center transcripts (Dutch/English). For each return sentiment and 2-3 short English topic phrases.
Return ONLY JSON: [{"call_id":<number>,"sentiment":"positive|neutral|negative","topics":["...","..."]}]

${content}`,
      }],
    })
    const match = response.content[0].text.match(/\[[\s\S]*?\]/)
    return match ? JSON.parse(match[0]) : null
  } catch (e) { console.warn('Claude analysis failed:', e.message); return null }
}

async function main() {
  const yearStart = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000)

  console.log('Fetching users...')
  const users = await fetchUsers()
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))

  const rawCalls = await fetchAllCalls(yearStart)

  const calls = rawCalls.map(c => ({
    id: c.id,
    direction: c.direction,
    missed_call_reason: c.missed_call_reason || null,
    started_at: c.started_at,
    answered_at: c.answered_at || null,
    duration: c.duration || 0,
    wait_time: c.answered_at ? Math.max(0, c.answered_at - c.started_at) : null,
    user_id: c.user?.id || null,
    has_recording: !!(c.recording || c.asset),
  }))

  // Fetch transcripts for topic extraction (always, not just when AI is enabled)
  console.log('Fetching transcripts for topic extraction...')
  const sample = calls.filter(c => c.has_recording && c.answered_at).slice(-100) // most recent 100
  const transcripts = []
  for (const call of sample) {
    const utterances = await fetchTranscription(call.id)
    if (utterances?.length) {
      transcripts.push({ call_id: call.id, text: utterances.map(u => u.text).join(' ') })
    }
    await sleep(1100)
  }
  console.log(`  Fetched ${transcripts.length} transcripts`)

  // Topics from transcript word frequency (always available)
  const topTopics = extractTopics(transcripts)

  // AI sentiment analysis (optional, needs ANTHROPIC_API_KEY)
  let qualitative = []
  if (process.env.ANTHROPIC_API_KEY && transcripts.length > 0) {
    console.log(`Analyzing ${transcripts.length} transcripts with Claude...`)
    for (let i = 0; i < transcripts.length; i += 20) {
      const results = await analyzeWithClaude(transcripts.slice(i, i + 20))
      if (results) qualitative.push(...results)
      await sleep(500)
    }
    console.log(`  ${qualitative.length} calls analyzed`)
  }

  mkdirSync(join(ROOT, 'public'), { recursive: true })
  writeFileSync(join(ROOT, 'public/data.json'), JSON.stringify({
    generated_at: new Date().toISOString(),
    users: userMap,
    calls,
    qualitative,
    top_topics: topTopics,
    has_ai_analysis: qualitative.length > 0,
  }))

  console.log(`Done. ${calls.length} calls, ${transcripts.length} transcripts, ${qualitative.length} AI-analyzed.`)
}

main().catch(e => { console.error(e); process.exit(1) })
