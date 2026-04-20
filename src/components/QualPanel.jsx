import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const SENTIMENT_COLORS = { positive: '#ccf822', neutral: '#26926a', negative: '#ff6933' }
const tooltipStyle = { contentStyle: { background: '#0f1d1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, color: '#e8f0ee' } }

const NL_EN = {
  // Product & technical
  warmtepomp: 'heat pump', pomp: 'pump', buitenunit: 'outdoor unit', binnenunit: 'indoor unit',
  storing: 'malfunction', defect: 'defect', kapot: 'broken', foutcode: 'error code',
  reset: 'reset', stroomstoring: 'power outage', lekkage: 'leak', druk: 'pressure',
  thermostaat: 'thermostat', ketel: 'boiler', radiator: 'radiator',
  vloerverwarming: 'underfloor heating', verwarming: 'heating', koeling: 'cooling',
  warmwater: 'hot water', aansluiting: 'connection', temperatuur: 'temperature',
  // Service & people
  installateur: 'installer', installatie: 'installation', monteur: 'technician',
  technicus: 'technician', inbedrijfstelling: 'commissioning', onderhoud: 'maintenance',
  reparatie: 'repair', onderdeel: 'spare part', service: 'service',
  // Planning
  afspraak: 'appointment', datum: 'date', planning: 'scheduling', oplevering: 'handover',
  levering: 'delivery', wachttijd: 'waiting time', spoed: 'urgent', urgent: 'urgent',
  terugbellen: 'callback',
  // Commercial
  garantie: 'warranty', factuur: 'invoice', betaling: 'payment', terugbetaling: 'refund',
  subsidie: 'subsidy', offerte: 'quote', contract: 'contract', bestelling: 'order',
  annulering: 'cancellation',
  // Customer / admin
  klant: 'customer', klacht: 'complaint', probleem: 'problem', adres: 'address',
  nummer: 'number', telefoon: 'phone', registratie: 'registration', activering: 'activation',
  // Days / months that slip through
  maandag: 'monday', dinsdag: 'tuesday', woensdag: 'wednesday', donderdag: 'thursday',
  vrijdag: 'friday', januari: 'january', februari: 'february', maart: 'march',
  april: 'april', mei: 'may', juni: 'june', juli: 'july', augustus: 'august',
  september: 'september', oktober: 'october', november: 'november', december: 'december',
}

function translate(word) {
  return NL_EN[word.toLowerCase()] || word
}

function translatePhrase(phrase) {
  return phrase.split(' ').map(translate).join(' ')
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
                  <td>{translatePhrase(t.name)}</td>
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
