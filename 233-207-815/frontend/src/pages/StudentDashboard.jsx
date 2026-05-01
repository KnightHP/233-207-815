import { useEffect, useState, Fragment } from 'react'
import { api } from '../api'
import { useAuth } from '../App'

const APP_STEPS = ['pending', 'under_review', 'approved', 'allocated']
const APP_LABELS = { pending: 'Submitted', under_review: 'Under Review', approved: 'Approved', allocated: 'Allocated' }

export default function StudentDashboard() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState({ room_type: 'double', block: 'A' })
  const [complaint, setComplaint] = useState({ category: 'electrical', description: '' })
  const [payAmt, setPayAmt] = useState(5000)
  const { toast } = useAuth()

  const load = async () => { try { setData(await api.studentDashboard()) } catch (e) { toast(e.message, 'error') } }
  useEffect(() => { load() }, [])

  const apply = async () => {
    try { await api.apply(form); toast('Application submitted'); load() }
    catch (e) { toast(e.message, 'error') }
  }
  const raise = async () => {
    if (!complaint.description.trim()) return toast('Enter description', 'error')
    try { await api.createComplaint(complaint); toast('Complaint filed'); setComplaint({ ...complaint, description: '' }); load() }
    catch (e) { toast(e.message, 'error') }
  }
  const pay = async () => {
    try { await api.makePayment(Number(payAmt), 'hostel_fee'); toast('Payment successful'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  if (!data) return <div className="empty">Loading…</div>
  const { application, room, complaints = [], payments = [], student } = data

  const appStatus = application?.status || null
  const stepIdx = appStatus ? (appStatus === 'allocated' ? 3 : 0) : -1

  return (
    <>
      <h1 className="page-title">Welcome, {student.name.split(' ')[0]} 👋</h1>
      <p className="page-sub">Manage your hostel stay — room, complaints, and fees in one place.</p>

      <div className="grid cols-4 mt-md">
        <div className="card stat">
          <div className="label">Room Status</div>
          <div className="value">{room ? room.room_number : '—'}</div>
          <div className="icon">🛏️</div>
        </div>
        <div className="card stat">
          <div className="label">Open Complaints</div>
          <div className="value">{complaints.filter(c => c.status !== 'resolved').length}</div>
          <div className="icon">📝</div>
        </div>
        <div className="card stat">
          <div className="label">Total Paid</div>
          <div className="value">₹{payments.reduce((a,p)=>a+(p.amount||0),0).toLocaleString()}</div>
          <div className="icon">💳</div>
        </div>
        <div className="card stat">
          <div className="label">Application</div>
          <div className="value" style={{fontSize: 18}}>{application ? APP_LABELS[appStatus] || appStatus : 'Not applied'}</div>
          <div className="icon">📄</div>
        </div>
      </div>

      <div className="grid cols-2 mt-lg">
        {/* ---------- Room / Application ---------- */}
        <div className="card">
          <div className="section-title">Room Allocation</div>
          {room ? (
            <>
              <div className="flex-between">
                <div>
                  <div style={{fontSize: 28, fontWeight: 700}}>Room {room.room_number}</div>
                  <div className="muted" style={{fontSize: 13}}>Block {room.block} · Floor {room.floor} · {room.room_type}</div>
                </div>
                <span className="badge badge-success">Allocated</span>
              </div>
              <div className="divider" />
              <div className="flex gap-md">
                <div className="chip">Rent: ₹{room.rent}</div>
                <div className="chip">Capacity: {room.capacity}</div>
                <div className="chip">Occupants: {(room.occupants || []).length}</div>
              </div>
            </>
          ) : application ? (
            <>
              <div className="tracker">
                {APP_STEPS.map((s, i) => (
                  <Fragment key={s}>
                    <div className={`step ${i <= stepIdx ? (i < stepIdx ? 'done' : 'active') : ''}`}>
                      <div className="dot">{i + 1}</div>
                      <span>{APP_LABELS[s]}</span>
                    </div>
                    {i < APP_STEPS.length - 1 && <div className={`bar ${i < stepIdx ? 'done' : ''}`} />}
                  </Fragment>
                ))}
              </div>
              <div className="muted" style={{fontSize: 13}}>
                Preferences: {application.preferences?.room_type} · Block {application.preferences?.block}
              </div>
            </>
          ) : (
            <>
              <p className="muted" style={{marginTop: 0}}>Apply for a hostel room by selecting your preferences.</p>
              <div className="field">
                <label>Room Type</label>
                <select className="select" value={form.room_type} onChange={e => setForm({...form, room_type: e.target.value})}>
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="triple">Triple</option>
                </select>
              </div>
              <div className="field">
                <label>Preferred Block</label>
                <select className="select" value={form.block} onChange={e => setForm({...form, block: e.target.value})}>
                  <option value="A">Block A</option>
                  <option value="B">Block B</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={apply}>Apply for Room</button>
            </>
          )}
        </div>

        {/* ---------- Payment ---------- */}
        <div className="card">
          <div className="section-title">Pay Hostel Fee</div>
          <div className="field">
            <label>Amount (₹)</label>
            <input className="input" type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={pay}>💳 Pay Now</button>
          <div className="divider" />
          <div className="section-title" style={{fontSize: 14}}>Recent Payments</div>
          {payments.length === 0
            ? <div className="muted" style={{fontSize: 13}}>No payments yet.</div>
            : payments.slice(0, 4).map(p => (
              <div key={p.id} className="flex-between" style={{padding: '8px 0', borderBottom: '1px solid var(--border)'}}>
                <div>
                  <div style={{fontSize: 14, fontWeight: 500}}>₹{p.amount}</div>
                  <div className="muted" style={{fontSize: 11}}>{p.txn_id} · {new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <span className="badge badge-success">Paid</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* ---------- Complaints ---------- */}
      <div className="card mt-lg">
        <div className="section-title">Raise a Complaint</div>
        <div className="grid cols-3" style={{gap: 12}}>
          <div className="field">
            <label>Category</label>
            <select className="select" value={complaint.category} onChange={e => setComplaint({...complaint, category: e.target.value})}>
              <option value="electrical">Electrical</option>
              <option value="plumbing">Plumbing</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="food">Food</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="field" style={{gridColumn: 'span 2'}}>
            <label>Description</label>
            <input className="input" value={complaint.description} placeholder="Describe the issue..." onChange={e => setComplaint({...complaint, description: e.target.value})} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={raise}>Submit Complaint</button>

        <div className="divider" />
        <div className="section-title" style={{fontSize: 14}}>My Complaints</div>
        {complaints.length === 0
          ? <div className="empty">No complaints yet</div>
          : (
            <table className="table">
              <thead><tr><th>Category</th><th>Description</th><th>Status</th><th>Filed</th></tr></thead>
              <tbody>
                {complaints.map(c => (
                  <tr key={c.id}>
                    <td style={{textTransform: 'capitalize'}}>{c.category}</td>
                    <td className="muted">{c.description}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="muted">{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>
    </>
  )
}

function StatusBadge({ status }) {
  const map = {
    submitted: 'badge-info',
    under_review: 'badge-warn',
    assigned: 'badge-warn',
    in_progress: 'badge-warn',
    resolved: 'badge-success',
  }
  return <span className={`badge ${map[status] || 'badge-neutral'}`}>{status.replace('_',' ')}</span>
}
