#!/usr/bin/env node
// Fetches Aircall data and generates public/data.json
// Usage: AIRCALL_API_ID=... AIRCALL_API_TOKEN=... node scripts/fetch-data.mjs

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const API_ID = process.env.AIRCALL_API_ID
const API_TOKEN = process.env.AIRCALL_API_TOKEN

if (!API_ID || !API_TOKEN) {
  console.error('Error: AIRCALL_API_ID and AIRCALL_API_TOKEN are required')
  process.exit(1)
}

const AUTH = Buffer.from(`${API_ID}:${API_TOKEN}`).toString('base64')

async function aircall(path, params = {}) {
  const url = new URL(`https://api.aircall.io${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${AUTH}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Aircall ${path}: ${res.status} ${body.slice(0, 200)}`)
  }
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
    const data = await aircall('/v1/calls', { page, per_page: 50, from: fromTs, order: 'asc' })
    calls.push(...(data.calls || []))
    totalPages = data.meta?.total_pages || 1
    page++
    if (page <= totalPages) await sleep(120)
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

async function analyzeWithClaude(transcripts) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const content = transcripts
      .map((t, i) => `[Call ${i + 1} ID:${t.call_id}]\n${t.text.slice(0, 700)}`)
      .join('\n\n---\n\n')
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze these call center transcripts (Dutch/English). For each, return:
- sentiment: "positive", "neutral", or "negative"
- topics: 2-3 short English phrases describing the main subjects

Return ONLY a JSON array: [{"call_id": <number>, "sentiment": "...", "topics": ["...", "..."]}]

Transcripts:
${content}`,
      }],
    })
    const text = response.content[0].text
    const match = text.match(/\[[\s\S]*?\]/)
    return match ? JSON.parse(match[0]) : null
  } catch (e) {
    console.warn('Claude analysis failed:', e.message)
    return null
  }
}

async function main() {
  const yearStart = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000)

  console.log('Fetching users...')
  const users = await fetchUsers()
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]))
  console.log(`  ${users.length} users`)

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
    tags: (c.tags || []).map(t => t.name),
    has_recording: !!(c.recording || c.asset),
  }))

  // Tag frequency for topics fallback
  const tagFreq = {}
  calls.forEach(c => c.tags.forEach(t => { tagFreq[t] = (tagFreq[t] || 0) + 1 }))
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }))

  // Qualitative analysis
  let qualitative = []
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY

  if (hasAnthropicKey) {
    console.log('Fetching transcripts for AI analysis...')
    const sample = calls.filter(c => c.has_recording && c.answered_at).slice(0, 60)
    const transcripts = []
    for (const call of sample) {
      const utterances = await fetchTranscription(call.id)
      if (utterances?.length) {
        transcripts.push({ call_id: call.id, text: utterances.map(u => u.text).join(' ') })
      }
      await sleep(100)
    }
    console.log(`  Analyzing ${transcripts.length} transcripts with Claude...`)
    for (let i = 0; i < transcripts.length; i += 20) {
      const batch = transcripts.slice(i, i + 20)
      const results = await analyzeWithClaude(batch)
      if (results) qualitative.push(...results)
      await sleep(500)
    }
    console.log(`  AI analysis complete: ${qualitative.length} calls analyzed`)
  } else {
    console.log('Skipping AI analysis (no ANTHROPIC_API_KEY)')
  }

  mkdirSync(join(ROOT, 'public'), { recursive: true })
  writeFileSync(
    join(ROOT, 'public/data.json'),
    JSON.stringify({
      generated_at: new Date().toISOString(),
      users: userMap,
      calls,
      qualitative,
      top_tags: topTags,
      has_ai_analysis: qualitative.length > 0,
    }),
  )

  console.log(`Done. ${calls.length} calls written to public/data.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
