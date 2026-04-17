import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const SENTIMENT_COLORS = { positive: '#ccf822', neutral: '#26926a', negative: '#ff6933' }
const tooltipStyle = { contentStyle: { background: '#0f1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#e8f0ee' } }

const NL_EN = {
  warmtepomp: 'heat pump', storing: 'malfunction', installateur: 'installer',
  installatie: 'installation', afspraak: 'appointment', datum: 'date',
  planning: 'scheduling', monteur: 'technician', garantie: 'warranty',
  factuur: 'invoice', betaling: 'payment', terugbetaling: 'refund',
  probleem: 'problem', klacht: 'complaint', reparatie: 'repair',
  onderdeel: 'spare part', onderhoud: 'maintenance', aansluiting: 'connection',
  verwarming: 'heating', warmwater: 'hot water', subsidie: 'subsidy',
  offerte: 'quote', lekkage: 'leak', druk: 'pressure', thermostaat: 'thermostat',
  ketel: 'boiler', radiator: 'radiator', vloerverwarming: 'underfloor heating',
  foutcode: 'error code', technicus: 'technician', contract: 'contract',
  adres: 'address', klant: 'customer', pomp: 'pump', koeling: 'cooling',
  temperatuur: 'temperature', buitenunit: 'outdoor unit', binnenunit: 'indoor unit',
  inbedrijfstelling: 'commissioning', oplevering: 'handover', levering: 'delivery',
  bestelling: 'order', annulering: 'cancellation', wachttijd: 'waiting time',
  terugbellen: 'callback', urgent: 'urgent', spoed: 'urgent', defect: 'defect',
  kapot: 'broken', service: 'service', nummer: 'number', registratie: 'registration',
  activering: 'activation', stroomstoring: 'power outage', reset: 'reset',
  woensdag: 'wednesday', dinsdag: 'tuesday', maandag: 'monday', vrijdag: 'friday',
  donderdag: 'thursday', januari: 'january', februari: 'february', maart: 'march',
  april: 'april', telefoon: 'phone', adres: 'address',
}

function translate(word) {
  return NL_EN[word.toLowerCase()] || word
}

export default function QualPanel({ calls, qualitative, topTopics, hasAI }) {
  const callIds = new Set(calls.map(c => c.id))

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
  qualitative.filter(q => callIds.has(q.call_id)).forEach(q => {
    if (q.sentiment in sentimentCounts) sentimentCounts[q.sentiment]++
  })
  const sentimentData = Object.entries(sentimentCounts)
    .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, key: name }))
    .filter(d => d.value > 0)

  const topicsData = (topTopics || []).slice(0, 10)

  return (
    <div className="qual-panel">
      <div className="chart-card">
        <h3 className="card-title">
          Sentiment
          <span className="ai-badge">
            {sentimentData.reduce((s, d) => s + d.value, 0)} calls analyzed
          </span>
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
          <div className="no-data">No sentiment data for selected period</div>
        )}
      </div>

      <div className="chart-card">
        <h3 className="card-title">
          Top Topics
          <span className="ai-badge">From transcripts</span>
        </h3>
        {topicsData.length > 0 ? (
          <table className="topics-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Mentions</th>
              </tr>
            </thead>
            <tbody>
              {topicsData.map(t => (
                <tr key={t.name}>
                  <td>{translate(t.name)}</td>
                  <td>{t.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="no-data">No topic data available</div>
        )}
      </div>
    </div>
  )
}
