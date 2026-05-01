import { useState, createContext, useContext } from 'react'
import { Routes, Route, Navigate, useNavigate, NavLink, useLocation, Outlet } from 'react-router-dom'
import { api } from './api'

import Login from './pages/Login.jsx'
import StudentDashboard from './pages/StudentDashboard.jsx'
import WardenDashboard from './pages/WardenDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import Rooms from './pages/Rooms.jsx'
import Complaints from './pages/Complaints.jsx'
import Payments from './pages/Payments.jsx'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)
export const useToast = () => useContext(AuthCtx).toast

export default function App() {
  const [user, setUser] = useState(api.getUser())
  const [toast, setToast] = useState(null)

  const login = (u) => { localStorage.setItem('user', JSON.stringify(u)); setUser(u) }
  const logout = () => { localStorage.removeItem('user'); setUser(null) }
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2600)
  }

  return (
    <AuthCtx.Provider value={{ user, login, logout, toast: showToast }}>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <Routes>
        <Route path="/login" element={user ? <Navigate to={home(user.role)} /> : <Login />} />
        <Route element={user ? <Shell /> : <Navigate to="/login" />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/warden" element={<WardenDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/complaints" element={<Complaints />} />
          <Route path="/payments" element={<Payments />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? home(user.role) : '/login'} />} />
      </Routes>
    </AuthCtx.Provider>
  )
}

function home(role) {
  return role === 'student' ? '/student' : role === 'warden' ? '/warden' : '/admin'
}

function Shell() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const links = {
    student: [
      { to: '/student',    label: 'Dashboard',  icon: '🏠' },
      { to: '/rooms',      label: 'Rooms',      icon: '🛏️' },
      { to: '/complaints', label: 'Complaints', icon: '📝' },
      { to: '/payments',   label: 'Payments',   icon: '💳' },
    ],
    warden: [
      { to: '/warden',     label: 'Dashboard',  icon: '🏠' },
      { to: '/rooms',      label: 'Rooms',      icon: '🛏️' },
      { to: '/complaints', label: 'Complaints', icon: '📝' },
    ],
    admin: [
      { to: '/admin',      label: 'Dashboard',  icon: '🏠' },
      { to: '/rooms',      label: 'Rooms',      icon: '🛏️' },
      { to: '/complaints', label: 'Complaints', icon: '📝' },
      { to: '/payments',   label: 'Payments',   icon: '💳' },
    ],
  }[user.role] || []

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">🏛️</div>
          <div>Hostel<br/><span style={{fontSize: 11, color: 'var(--text-dim)', fontWeight: 400}}>Management System</span></div>
        </div>
        {links.map(l => (
          <NavLink key={l.to} to={l.to} className={({isActive}) => 'nav-link' + (isActive ? ' active' : '')}>
            <span>{l.icon}</span>{l.label}
          </NavLink>
        ))}
        <div className="user-pill">
          <b>{user.name}</b>
          <div className="muted" style={{fontSize: 12}}>{user.email}</div>
          <span className="role">{user.role}</span>
          <button className="logout" onClick={() => { logout(); nav('/login') }}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
