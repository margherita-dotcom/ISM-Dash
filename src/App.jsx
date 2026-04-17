import { useState, useEffect } from 'react'
import Header from './components/Header'
import KPICard from './components/KPICard'
import VolumeChart from './components/VolumeChart'
import HeatMap from './components/HeatMap'
import UserTable from './components/UserTable'
import QualPanel from './components/QualPanel'
import { filterCalls, computeKPIs, computeVolumeData, computeHeatmapData, computeUserStats, formatDuration, DASHBOARD_USERS } from './utils'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('week')
  const [selectedUsers, setSelectedUsers] = useState([])

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data.json')
      .then(r => { if (!r.ok) throw new Error('data.json not found') ; return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  if (error) return (
    <div className="state-screen">
      <h2>No data available</h2>
      <p>{error}</p>
      <p>Run the GitHub Actions workflow or <code>npm run fetch</code> locally to generate data.</p>
    </div>
  )

  if (!data) return (
    <div className="state-screen">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  )

  const filtered = filterCalls(data.calls, period, selectedUsers)
  const kpis = computeKPIs(filtered)
  const volumeData = computeVolumeData(filtered, period)
  const heatmapData = computeHeatmapData(filtered)
  const userStats = computeUserStats(filtered, DASHBOARD_USERS)

  return (
    <div className="app">
      <Header
        period={period}
        onPeriodChange={setPeriod}
        selectedUsers={selectedUsers}
        onUsersChange={setSelectedUsers}
        generatedAt={data.generated_at}
      />
      <main className="main">
        <div className="kpi-row">
          <KPICard label="Inbound" value={kpis.inbound} color="blue" />
          <KPICard label="Outbound" value={kpis.outbound} color="green" />
          <KPICard label="Missed" value={kpis.missed} color="red" />
          <KPICard label="Avg Duration" value={formatDuration(kpis.avgDuration)} color="purple" />
          <KPICard label="Avg Wait Time" value={formatDuration(kpis.avgWait)} color="yellow" />
        </div>

        <div className="charts-row">
          <div className="chart-card">
            <h3 className="card-title">Call Volume</h3>
            <VolumeChart data={volumeData} />
          </div>
          <div className="chart-card">
            <h3 className="card-title">Calls by Hour &amp; Day</h3>
            <HeatMap data={heatmapData} />
          </div>
        </div>

        <div className="chart-card">
          <h3 className="card-title">Performance by Agent</h3>
          <UserTable data={userStats} />
        </div>

        <QualPanel
          calls={filtered}
          qualitative={data.qualitative}
          topTags={data.top_tags}
          hasAI={data.has_ai_analysis}
        />
      </main>
    </div>
  )
}
