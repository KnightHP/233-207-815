import { useEffect, useState, Fragment } from 'react'
import { api } from '../api'
import { useAuth } from '../App'

const STATES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved']
const LABELS = { submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved' }

export default function Complaints() {
  const [list, setList] = useState([])
  const { user, toast } = useAuth()

  const load = async () => { try { setList(await api.listComplaints()) } catch (e) { toast(e.message, 'error') } }
  useEffect(() => { load() }, [])

  const advance = async (id, status) => {
    try { await api.advanceComplaint(id, status); toast('Status updated'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const canAdvance = user.role === 'warden' || user.role === 'admin'

  return (
    <>
      <h1 className="page-title">Complaints</h1>
      <p className="page-sub">{list.length} total · {list.filter(c => c.status !== 'resolved').length} open</p>

      <div className="card mt-md">
        {list.length === 0
          ? <div className="empty">No complaints found.</div>
          : list.map(c => {
            const idx = STATES.indexOf(c.status)
            const next = idx < STATES.length - 1 ? STATES[idx + 1] : null
            return (
              <div key={c.id} style={{padding: '16px 0', borderBottom: '1px solid var(--border)'}}>
                <div className="flex-between" style={{marginBottom: 10}}>
                  <div>
                    <div style={{fontWeight: 600, textTransform: 'capitalize'}}>
                      {c.category} · <span className="muted" style={{fontWeight: 400}}>{c.student_name}</span>
                    </div>
                    <div className="muted" style={{fontSize: 13, marginTop: 2}}>{c.description}</div>
                  </div>
                  {canAdvance && next
                    ? <button className="btn btn-primary btn-sm" onClick={() => advance(c.id, next)}>→ {LABELS[next]}</button>
                    : <span className={`badge ${c.status === 'resolved' ? 'badge-success' : 'badge-info'}`}>{LABELS[c.status]}</span>
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
                {c.history?.length > 0 && (
                  <div className="muted" style={{fontSize: 11, marginTop: 8}}>
                    Last update: {LABELS[c.history.at(-1).status]} by {c.history.at(-1).by} · {new Date(c.history.at(-1).at).toLocaleString()}
                  </div>
                )}
              </div>
            )
          })
        }
      </div>
    </>
  )
}
