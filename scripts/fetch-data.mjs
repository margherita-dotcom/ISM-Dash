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
    const data = await aircall('/v1/calls', { page, per_page: PER_PAGE, from: fromTs, order: 'desc' })
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

// Simple keyword-based sentiment (Dutch + English)
const POSITIVE_WORDS = new Set([
  'goed','prima','super','top','perfect','fijn','bedankt','dankjewel','dankuwel','geweldig',
  'uitstekend','blij','tevreden','prettig','fijne','mooi','helpen','geholpen','opgelost',
  'geregeld','gelukt','werkend','werkt','snel','duidelijk','begrijp','begrepen',
  'good','great','perfect','excellent','happy','satisfied','thanks','thank','helpful',
  'resolved','fixed','working','works','quick','clear','understand','wonderful','fantastic',
])
const NEGATIVE_WORDS = new Set([
  'slecht','probleem','storing','kapot','klacht','boos','teleurgesteld','niet','nooit',
  'lang','wachten','wacht','vervelend','fout','verkeerd','mis','kwijt','stuk','defect',
  'ontevreden','erg','heel','moeilijk','onduidelijk','begrijp niet','snap niet',
  'bad','problem','broken','complaint','angry','disappointed','never','long','wait',
  'wrong','error','fault','difficult','unclear','frustrated','issue','fail','failed',
])

function analyzeSentiment(text) {
  const words = text.toLowerCase().split(/\s+/)
  let pos = 0, neg = 0
  words.forEach(w => {
    if (POSITIVE_WORDS.has(w)) pos++
    if (NEGATIVE_WORDS.has(w)) neg++
  })
  if (pos === 0 && neg === 0) return 'neutral'
  if (pos > neg * 1.5) return 'positive'
  if (neg > pos * 1.5) return 'negative'
  return 'neutral'
}

// Dutch + English stop words for transcript topic extraction
const STOP = new Set([
  // Dutch articles/pronouns/prepositions
  'de','het','een','dat','dit','die','deze','dan','meer','heel','toch','echt','hier','daar','toen',
  'op','te','en','van','ik','je','we','ze','hij','zij','met','voor','niet','maar','ook','als','zo',
  'er','bij','aan','zijn','was','om','af','in','uit','over','door','naar','of','heb','bent','ben',
  'dus','uw','ons','onze','hun','jullie','u','hem','haar','mij','mijn','jouw','alle','elke',
  'geen','iets','alles','niets','iemand','niemand','wel','nog','al','nu','ja','nee','hoe','wat',
  'wie','waar','wanneer','want','want',
  // Dutch verbs (infinitive + conjugations)
  'zijn','hebben','hebben','heeft','had','hadden','worden','wordt','werd','werden','kunnen','kan',
  'kon','konden','willen','wil','wilde','wilden','moeten','moet','moest','moesten','mogen','mag',
  'mocht','zullen','zal','zou','zouden','gaan','gaat','ging','gingen','komen','komt','kwam','kwamen',
  'zien','ziet','zag','zagen','zeggen','zegt','zei','zeiden','doen','doet','deed','deden','maken',
  'maakt','maakte','denken','denkt','dacht','weten','weet','wist','nemen','neemt','nam','laten',
  'laat','liet','horen','hoort','hoorde','staan','staat','stond','liggen','ligt','lag','zitten',
  'zit','zat','kijken','kijkt','keek','sturen','stuurt','stuurde','bellen','belt','belde',
  'wachten','wacht','wachtte','vragen','vraagt','vroeg','helpen','helpt','hielp','werken','werkt',
  'werkte','krijgen','krijgt','kreeg','geven','geeft','gaf','vertellen','vertelt','vertelde',
  'zetten','zet','zette','zetten','komen','kommen','proberen','probeert','probeerde','gebruiken',
  'noemen','heet','heten','kennen','kent','kende','blijven','blijft','bleef','schrijven','schrijft',
  // Dutch adverbs/discourse
  'even','eens','gewoon','eigenlijk','misschien','zeker','precies','helemaal','prima','graag',
  'anders','verder','samen','snel','lang','kort','veel','weinig','vaak','altijd','nooit','soms',
  'bijna','ongeveer','meteen','straks','later','eerst','daarna','alvast','ook','maar','nou',
  'hoor','oké','oke','klopt','snap','begrijp','bedoel','effe','ff','hm','hmm','ah','eh',
  'ok','okay','super','top','goed','fijn','kijk','kijkt',
  // Dutch discourse/filler
  'natuurlijk','inderdaad','beetje','goedemiddag','goedemorgen','goedenavond','dank','alleen',
  'allemaal','hele','zelf','mee','trouwens','sowieso','namelijk','bijvoorbeeld','eigenlijk',
  'gewoon','alvast','straks','later','eerst','daarna','meteen','ongeveer','bijna','helemaal',
  'vandaag','morgen','gisteren','volgende','vorige','deze','afgelopen','komende','waarbij',
  'waarvoor','waarmee','waarom','waarna','daarvoor','daarmee','daarna','waarbij','waardoor',
  // Dutch greetings/fillers
  'dag','hoi','hai','doei','bye','hallo','gedag','bedankt','dankjewel','dankuwel','tot','ziens',
  // English
  'the','a','an','it','in','on','at','to','for','of','and','or','but','not','with','this','that',
  'are','be','been','have','has','do','does','did','will','would','could','should','may','might',
  'can','i','you','my','your','our','their','yes','no','so','just','if','then','what','how',
  'when','where','who','yeah','uh','um','ah','oh','well','right','okay','sure','hi','hello','bye',
  'know','think','like','get','got','going','want','need','make','see','look','come','go','said',
  'say','saying','told','tell','thing','things','call','called','calling','speak','speaking',
  'also','very','really','actually','maybe','still','already','here','there','now','then',
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
    number_id: c.number?.id || null,
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

  // Sentiment: keyword for transcript calls, heuristic for the rest (100% coverage)
  let qualitative = []

  if (process.env.ANTHROPIC_API_KEY && transcripts.length > 0) {
    console.log(`Analyzing ${transcripts.length} transcripts with Claude...`)
    for (let i = 0; i < transcripts.length; i += 20) {
      const results = await analyzeWithClaude(transcripts.slice(i, i + 20))
      if (results) qualitative.push(...results)
      await sleep(500)
    }
  } else if (transcripts.length > 0) {
    qualitative = transcripts.map(t => ({
      call_id: t.call_id,
      sentiment: analyzeSentiment(t.text),
      topics: [],
    }))
  }

  // Heuristic sentiment for all remaining calls (duration/status based)
  const analyzedIds = new Set(qualitative.map(q => q.call_id))
  const heuristic = calls
    .filter(c => !analyzedIds.has(c.id))
    .map(c => ({
      call_id: c.id,
      sentiment: !c.answered_at ? 'negative'
        : c.duration >= 180 ? 'positive'
        : c.duration < 20 ? 'neutral'
        : 'neutral',
      topics: [],
    }))
  qualitative = [...qualitative, ...heuristic]
  console.log(`Sentiment: ${qualitative.length - heuristic.length} keyword + ${heuristic.length} heuristic`)

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
