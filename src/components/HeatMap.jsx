const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function HeatMap({ data }) {
  const maxVal = Math.max(1, ...data.flat())

  return (
    <div className="heatmap-container">
      {data.map((row, dayIdx) => (
        <div key={dayIdx} className="heatmap-row">
          <span className="heatmap-label">{DAYS[dayIdx]}</span>
          <div className="heatmap-cells">
            {row.map((count, hourIdx) => (
              <div
                key={hourIdx}
                className="heatmap-cell"
                title={`${DAYS[dayIdx]} ${hourIdx}:00–${hourIdx + 1}:00: ${count} calls`}
                style={{ opacity: count === 0 ? 0.07 : 0.15 + (count / maxVal) * 0.85 }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="heatmap-row">
        <span className="heatmap-label" />
        <div className="heatmap-hour-labels">
          {[0, 6, 12, 18, 23].map(h => (
            <span key={h} style={{ left: `${(h / 23) * 100}%` }}>{h}h</span>
          ))}
        </div>
      </div>
    </div>
  )
}
