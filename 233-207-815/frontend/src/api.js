/**
 * Frontend API client — talks to the Node/Express/MongoDB backend on :5000.
 * All OOP and design patterns live on the server (see server/server.js).
 */

const BASE = '/api'

function getSaved() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const u = getSaved()
  if (u?.id) headers['X-User-Id'] = u.id
  let res
  try {
    res = await fetch(BASE + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Cannot reach backend at /api — is the server running on :5000?')
  }
  const text = await res.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return { error: text } } })() : {}
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

export const api = {
  getUser: getSaved,

  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),

  // Rooms
  listRooms: () => request('/rooms'),
  createRoom: (payload) => request('/rooms', { method: 'POST', body: payload }),

  // Applications
  apply: (preferences) => request('/applications', { method: 'POST', body: { preferences } }),
  myApplications: () => request('/applications/me'),
  allApplications: () => request('/applications'),
  allocate: (appId, roomId) => request(`/applications/${appId}/allocate`, { method: 'POST', body: { room_id: roomId } }),

  // Complaints
  createComplaint: (payload) => request('/complaints', { method: 'POST', body: payload }),
  listComplaints: () => request('/complaints'),
  advanceComplaint: (id, status) => request(`/complaints/${id}/advance`, { method: 'POST', body: { status } }),

  // Payments
  makePayment: (amount, purpose = 'hostel_fee') => request('/payments', { method: 'POST', body: { amount, purpose } }),
  listPayments: () => request('/payments'),

  // Dashboards / meta
  studentDashboard: () => request('/student/dashboard'),
  adminDashboard: () => request('/admin/dashboard'),
  patterns: () => request('/meta/patterns'),
  health: () => request('/health'),
}
