import { useEffect, useState, Fragment } from 'react'
import { api } from '../api'
import { useAuth } from '../App'

export default function WardenDashboard() {
  const [apps, setApps] = useState([])
  const [rooms, setRooms] = useState([])
  const [complaints, setComplaints] = useState([])
  const [dash, setDash] = useState(null)
  const [selected, setSelected] = useState({}) // appId -> roomId
  const { toast } = useAuth()

  const load = async () => {
    try {
      const [a, r, c, d] = await Promise.all([
        api.allApplications(), api.listRooms(), api.listComplaints(), api.adminDashboard(),
      ])
      setApps(a); setRooms(r); setComplaints(c); setDash(d)
    } catch (e) { toast(e.message, 'error') }
  }
  useEffect(() => { load() }, [])

  const allocate = async (appId) => {
    try {
      await api.allocate(appId, selected[appId] || null)
      toast('Room allocated'); load()
    } catch (e) { toast(e.message, 'error') }
  }

  const advance = async (id, status) => {
    try { await api.advanceComplaint(id, status); toast(`Moved to ${status.replace('_',' ')}`); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const pending = apps.filter(a => a.status === 'pending')
  const openComplaints = complaints.filter(c => c.status !== 'resolved')
  const availableRooms = rooms.filter(r => (r.occupants || []).length < r.capacity)

  const s = dash?.stats || {}

  return (
    <>
      <h1 className="page-title">Warden Dashboard</h1>
      <p className="page-sub">Allocate rooms and manage the complaint lifecycle.</p>

      <div className="grid cols-4">
        <Stat label="Pending Applications" value={pending.length} icon="📄" />
        <Stat label="Available Rooms" value={s.rooms_available ?? availableRooms.length} icon="🛏️" />
        <Stat label="Open Complaints" value={openComplaints.length} icon="📝" />
        <Stat label="Total Students" value={s.students ?? '—'} icon="👥" />
      </div>

      <div className="card mt-lg">
        <div className="section-title">Pending Room Applications</div>
        {pending.length === 0
          ? <div className="empty">No pending applications 🎉</div>
          : (
            <table className="table">
              <thead><tr><th>Student</th><th>Preferences</th><th>Applied</th><th>Allocate Room</th><th></th></tr></thead>
              <tbody>
                {pending.map(a => (
                  <tr key={a.id}>
                    <td>{a.student_name}</td>
                    <td className="muted">{a.preferences?.room_type || 'any'} · Block {a.preferences?.block || 'any'}</td>
                    <td className="muted">{new Date(a.applied_at).toLocaleDateString()}</td>
                    <td>
                      <select className="select" style={{padding: '6px 10px', fontSize: 13}}
                        value={selected[a.id] || ''}
                        onChange={e => setSelected({...selected, [a.id]: e.target.value})}>
                        <option value="">Auto-pick (by preferences)</option>
                        {availableRooms.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.room_number} · Block {r.block} · {r.room_type} ({(r.occupants||[]).length}/{r.capacity})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td><button className="btn btn-primary btn-sm" onClick={() => allocate(a.id)}>Allocate</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      <div className="card mt-lg">
        <div className="section-title">Complaint Lifecycle</div>
        {complaints.length === 0
          ? <div className="empty">No complaints yet.</div>
          : complaints.map(c => <ComplaintRow key={c.id} c={c} advance={advance} />)
        }
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

const STATES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved']
const LABELS = { submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved' }

function ComplaintRow({ c, advance }) {
  const idx = STATES.indexOf(c.status)
  const next = idx < STATES.length - 1 ? STATES[idx + 1] : null
  return (
    <div style={{padding: '14px 0', borderBottom: '1px solid var(--border)'}}>
      <div className="flex-between" style={{marginBottom: 10}}>
        <div>
          <div style={{fontWeight: 600}}>{c.category} · <span className="muted" style={{fontWeight: 400}}>{c.student_name}</span></div>
          <div className="muted" style={{fontSize: 13, marginTop: 2}}>{c.description}</div>
        </div>
        {next
          ? <button className="btn btn-primary btn-sm" onClick={() => advance(c.id, next)}>Advance to {LABELS[next]}</button>
          : <span className="badge badge-success">Resolved</span>
        }
      </div>
      <div className="tracker" style={{margin: 0}}>
        {STATES.map((s, i) => (
          <Fragment key={s}>
            <div className={`step ${i < idx ? 'done' : i === idx ? 'active' : ''}`}>
              <div className="dot">{i + 1}</div>
              <span>{LABELS[s]}</span>
            </div>
            {i < STATES.length - 1 && <div className={`bar ${i < idx ? 'done' : ''}`} />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
