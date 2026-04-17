import { formatDuration } from '../utils'

export default function UserTable({ data }) {
  return (
    <div className="table-container">
      <table className="user-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Calls Handled</th>
            <th>Answered</th>
            <th>Avg Duration</th>
            <th>Answer Rate</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.name}>
              <td className="agent-name">{row.name}</td>
              <td>{row.handled}</td>
              <td>{row.answered}</td>
              <td>{formatDuration(row.avgDuration)}</td>
              <td>
                <div className="rate-bar">
                  <div className="rate-track">
                    <div className="rate-fill" style={{ width: `${row.answerRate}%` }} />
                  </div>
                  <span>{row.answerRate}%</span>
                </div>
              </td>
            </tr>
          ))}
          {data.every(r => r.handled === 0) && (
            <tr>
              <td colSpan={5} className="no-data-row">No calls for selected period / agents</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
