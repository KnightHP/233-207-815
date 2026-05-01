import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../App'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'student', phone: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const { login, toast } = useAuth()
  const nav = useNavigate()

  const on = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    try {
      if (tab === 'login') {
        const u = await api.login(form.email, form.password)
        login(u)
        toast(`Welcome back, ${u.name}`)
        nav(u.role === 'student' ? '/student' : u.role === 'warden' ? '/warden' : '/admin')
      } else {
        await api.register(form)
        const u = await api.login(form.email, form.password)
        login(u)
        toast('Account created')
        nav(u.role === 'student' ? '/student' : u.role === 'warden' ? '/warden' : '/admin')
      }
    } catch (e) { setErr(e.message) }
    finally { setLoading(false) }
  }

  const quick = (email, password) => { setForm({ ...form, email, password }); setTab('login') }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div style={{display:'flex', alignItems:'center', gap: 12, marginBottom: 20}}>
          <div className="logo" style={{width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #22d3ee)', display:'grid', placeItems:'center', fontSize: 22}}>🏛️</div>
          <div>
            <h1 style={{margin: 0}}>Hostel Management</h1>
            <p className="sub" style={{margin: 0}}>OOP · MongoDB · React</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Sign In</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Create Account</button>
        </div>

        <form onSubmit={submit}>
          {tab === 'register' && (
            <>
              <div className="field">
                <label>Full Name</label>
                <input className="input" value={form.name} onChange={on('name')} required />
              </div>
              <div className="field">
                <label>Role</label>
                <select className="select" value={form.role} onChange={on('role')}>
                  <option value="student">Student</option>
                  <option value="warden">Warden</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="field">
                <label>Phone</label>
                <input className="input" value={form.phone} onChange={on('phone')} />
              </div>
            </>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" value={form.email} onChange={on('email')} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" className="input" value={form.password} onChange={on('password')} required />
          </div>
          {err && <div className="badge badge-danger" style={{marginBottom: 12}}>{err}</div>}
          <button className="btn btn-primary" style={{width: '100%'}} disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="divider" />
        <div className="muted" style={{fontSize: 12, marginBottom: 10}}>Demo accounts (pre-seeded):</div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
          <button className="btn btn-ghost btn-sm" onClick={() => quick('student@hostel.com', 'student123')}>Student · student@hostel.com</button>
          <button className="btn btn-ghost btn-sm" onClick={() => quick('warden@hostel.com', 'warden123')}>Warden · warden@hostel.com</button>
          <button className="btn btn-ghost btn-sm" onClick={() => quick('admin@hostel.com', 'admin123')}>Admin · admin@hostel.com</button>
        </div>
      </div>
    </div>
  )
}
