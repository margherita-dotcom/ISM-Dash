import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const SENTIMENT_COLORS = { positive: '#22c55e', neutral: '#64748b', negative: '#ef4444' }
const tooltipStyle = { contentStyle: { background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 6, color: '#e2e8f0' } }

export default function QualPanel({ calls, qualitative, topTopics, hasAI }) {
  const callIds = new Set(calls.map(c => c.id))

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
  qualitative.filter(q => callIds.has(q.call_id)).forEach(q => {
    if (q.sentiment in sentimentCounts) sentimentCounts[q.sentiment]++
  })
  const sentimentData = Object.entries(sentimentCounts)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, key: name }))
    .filter(d => d.value > 0)

  // If AI enabled, use Claude-extracted topics; otherwise use transcript word frequency
  let topicsData
  if (hasAI && qualitative.length > 0) {
    const freq = {}
    qualitative.filter(q => callIds.has(q.call_id)).forEach(q => {
      q.topics?.forEach(t => { freq[t] = (freq[t] || 0) + 1 })
    })
    topicsData = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
  } else {
    topicsData = (topTopics || []).slice(0, 10)
  }

  return (
    <div className="qual-panel">
      <div className="chart-card">
        <h3 className="card-title">
          Sentiment
          {!hasAI && <span className="ai-badge">Enable AI for analysis</span>}
        </h3>
        {sentimentData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                  {sentimentData.map(entry => <Cell key={entry.key} fill={SENTIMENT_COLORS[entry.key]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="sentiment-legend">
              {sentimentData.map(d => (
                <span key={d.key} className="legend-item">
                  <span className="legend-dot" style={{ background: SENTIMENT_COLORS[d.key] }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="no-data">
            {hasAI ? 'No sentiment data for this period' : 'Add ANTHROPIC_API_KEY to GitHub Secrets to enable sentiment'}
          </div>
        )}
      </div>

      <div className="chart-card">
        <h3 className="card-title">
          Top Topics
          {!hasAI && <span className="ai-badge">From transcripts</span>}
        </h3>
        {topicsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topicsData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={130} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="Calls" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data">No topic data available</div>
        )}
      </div>
    </div>
  )
}
