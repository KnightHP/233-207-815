import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'

export default function AdminDashboard() {
  const [dash, setDash] = useState(null)
  const [patterns, setPatterns] = useState(null)
  const { toast } = useAuth()

  useEffect(() => {
    (async () => {
      try {
        setDash(await api.adminDashboard())
        setPatterns(await api.patterns())
      } catch (e) { toast(e.message, 'error') }
    })()
  }, [])

  if (!dash) return <div className="empty">Loading…</div>
  const s = dash.stats

  return (
    <>
      <h1 className="page-title">Admin Dashboard</h1>
      <p className="page-sub">Institution-wide overview across students, rooms, complaints, and revenue.</p>

      <div className="grid cols-4">
        <Stat label="Students"       value={s.students}       icon="👥" />
        <Stat label="Wardens"        value={s.wardens}        icon="🛡️" />
        <Stat label="Rooms Total"    value={s.rooms_total}    icon="🏢" />
        <Stat label="Rooms Available" value={s.rooms_available} icon="🛏️" />
        <Stat label="Rooms Occupied" value={s.rooms_occupied} icon="🔒" />
        <Stat label="Pending Apps"   value={s.applications_pending} icon="📄" />
        <Stat label="Open Complaints" value={s.complaints_open} icon="📝" />
        <Stat label="Revenue"        value={'₹' + (s.revenue || 0).toLocaleString()} icon="💰" />
      </div>

      <div className="grid cols-2 mt-lg">
        <div className="card">
          <div className="section-title">🧱 OOP Architecture & Design Patterns</div>
          <p className="muted" style={{marginTop: 0, fontSize: 13}}>
            Implemented in <span className="chip">server/server.js</span>
          </p>
          {patterns?.patterns?.map(p => (
            <div key={p.name} className="pattern-box">
              <div className="name">{p.name} <span className="tag">{p.klass || p.class}</span></div>
              <div className="desc">{p.purpose}</div>
            </div>
          ))}
          <div className="divider" />
          <div className="section-title" style={{fontSize: 14}}>Domain Classes</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
            {patterns?.classes?.map(c => <span key={c} className="chip">{c}</span>)}
          </div>
        </div>

        <div className="card">
          <div className="section-title">📡 Recent System Events</div>
          <p className="muted" style={{marginTop: 0, fontSize: 13}}>Emitted by the Observer (NotificationService).</p>
          {dash.recent_events?.length === 0
            ? <div className="empty">No events yet.</div>
            : dash.recent_events.map(ev => (
              <div key={ev.id} style={{padding: '10px 0', borderBottom: '1px solid var(--border)'}}>
                <div className="flex-between">
                  <span className="badge badge-info">{ev.event}</span>
                  <span className="muted" style={{fontSize: 12}}>{new Date(ev.created_at).toLocaleString()}</span>
                </div>
                <div className="muted" style={{fontSize: 12, marginTop: 4}}>
                  {Object.entries(ev.payload || {}).map(([k, v]) => (
                    <span key={k} style={{marginRight: 10}}><b>{k}:</b> {String(v)}</span>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </>
  )
}

function Stat({ label, value, icon }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="icon">{icon}</div>
    </div>
  )
}
