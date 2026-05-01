import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'

export default function Payments() {
  const [list, setList] = useState([])
  const { toast } = useAuth()

  useEffect(() => { (async () => {
    try { setList(await api.listPayments()) } catch (e) { toast(e.message, 'error') }
  })() }, [])

  const total = list.reduce((a, p) => a + (p.amount || 0), 0)

  return (
    <>
      <h1 className="page-title">Payments</h1>
      <p className="page-sub">{list.length} transactions · ₹{total.toLocaleString()} total</p>

      <div className="card mt-md">
        {list.length === 0
          ? <div className="empty">No payments yet.</div>
          : (
            <table className="table">
              <thead><tr><th>Txn ID</th><th>Student</th><th>Purpose</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {list.map(p => (
                  <tr key={p.id}>
                    <td style={{fontFamily: 'monospace', fontSize: 12}}>{p.txn_id}</td>
                    <td>{p.student_name}</td>
                    <td className="muted" style={{textTransform: 'capitalize'}}>{p.purpose.replace('_',' ')}</td>
                    <td style={{fontWeight: 600}}>₹{p.amount.toLocaleString()}</td>
                    <td className="muted">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td><span className="badge badge-success">Paid</span></td>
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
