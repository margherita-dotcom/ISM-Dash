export default function KPICard({ label, value, color }) {
  return (
    <div className={`kpi-card kpi-card--${color}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
}
