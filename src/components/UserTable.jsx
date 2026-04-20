import { formatDuration } from '../utils'

function PickupBar({ rate }) {
  return (
    <div className="rate-bar">
      <div className="rate-track">
        <div className="rate-fill" style={{ width: `${rate}%` }} />
      </div>
      <span>{rate}%</span>
    </div>
  )
}

export default function UserTable({ data }) {
  return (
    <div className="table-container">
      <table className="user-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Inbound</th>
            <th>Pickup (in)</th>
            <th>Outbound</th>
            <th>Pickup (out)</th>
            <th>Time on Phone</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.name}>
              <td className="agent-name">{row.name}</td>
              <td>{row.inbound}</td>
              <td><PickupBar rate={row.inboundPickupRate} /></td>
              <td>{row.outbound}</td>
              <td><PickupBar rate={row.outboundPickupRate} /></td>
              <td>{formatDuration(row.totalDuration)}</td>
            </tr>
          ))}
          {data.every(r => r.handled === 0) && (
            <tr>
              <td colSpan={6} className="no-data-row">No calls for selected period / agents</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
