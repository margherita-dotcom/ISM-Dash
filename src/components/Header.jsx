import { DASHBOARD_USERS } from '../utils'

const PERIODS = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
]

export default function Header({ period, onPeriodChange, selectedUsers, onUsersChange, generatedAt }) {
  const toggleUser = (id) => {
    const next = selectedUsers.includes(id)
      ? selectedUsers.filter(x => x !== id)
      : [...selectedUsers, id]
    onUsersChange(next)
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">ISM Dashboard</h1>
        {generatedAt && (
          <span className="last-updated">
            Updated {new Date(generatedAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div className="header-controls">
        <div className="toggle-group">
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`toggle-btn ${period === p.key ? 'active' : ''}`}
              onClick={() => onPeriodChange(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="toggle-group">
          <button
            className={`toggle-btn ${selectedUsers.length === 0 ? 'active' : ''}`}
            onClick={() => onUsersChange([])}
          >
            All
          </button>
          {DASHBOARD_USERS.map(u => (
            <button
              key={u.email}
              className={`toggle-btn ${selectedUsers.includes(u.id) ? 'active' : ''} ${!u.id ? 'disabled' : ''}`}
              onClick={() => u.id && toggleUser(u.id)}
              title={!u.id ? 'Not in Aircall yet' : undefined}
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
