/**
 * Hostel Management System — Node.js + Express + MongoDB Atlas backend
 * =====================================================================
 * Design Patterns:
 *   • Singleton  -> DatabaseFactory (one MongoClient per process)
 *   • Factory    -> DatabaseFactory.col() / User.wrap()
 *   • Observer   -> NotificationService (events persisted + broadcast)
 *   • State      -> Complaint state machine
 *   • MVC        -> Express routes = Controllers delegating to domain models
 */
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { MongoClient, ObjectId } from 'mongodb'

// ─── DatabaseFactory (Singleton + Factory) ───────────────────────────────
class DatabaseFactory {
  static _client = null
  static _db = null

  static async init() {
    if (this._client) return this._db
    this._client = new MongoClient(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    await this._client.connect()
    this._db = this._client.db(process.env.DB_NAME || 'hostel_mgmt')
    await this._db.collection('users').createIndex({ email: 1 }, { unique: true })
    await this._db.collection('rooms').createIndex({ room_number: 1 }, { unique: true })
    console.log('[DB] connected to', this._db.databaseName)
    return this._db
  }

  static db() { return this._db }
  static col(name) { return this._db.collection(name) }
}

// ─── NotificationService (Observer) ──────────────────────────────────────
class NotificationService {
  static subscribers = {}
  static subscribe(event, cb) { (this.subscribers[event] ||= []).push(cb) }
  static async publish(event, payload) {
    await DatabaseFactory.col('events').insertOne({ event, payload, created_at: new Date() })
    for (const cb of (this.subscribers[event] || [])) { try { await cb(payload) } catch (e) { console.error(e) } }
  }
}
;['user.registered','application.created','room.allocated','complaint.created','complaint.updated','payment.received']
  .forEach(ev => NotificationService.subscribe(ev, p => console.log(`[EVT] ${ev}`, p)))

// ─── Helpers ─────────────────────────────────────────────────────────────
const oid = (x) => { try { return new ObjectId(x) } catch { return null } }
const serialize = (doc) => {
  if (doc == null) return doc
  if (Array.isArray(doc)) return doc.map(serialize)
  if (doc instanceof Date) return doc.toISOString()
  if (doc instanceof ObjectId) return doc.toString()
  if (typeof doc === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(doc)) out[k === '_id' ? 'id' : k] = serialize(v)
    return out
  }
  return doc
}

// ─── User + subclasses (Factory) ─────────────────────────────────────────
class User {
  constructor(row) { Object.assign(this, row) }

  static async create({ name, email, password, role, phone = '' }) {
    if (!['student','warden','admin'].includes(role)) throw Object.assign(new Error('invalid role'), { status: 400 })
    const existing = await DatabaseFactory.col('users').findOne({ email })
    if (existing) throw Object.assign(new Error('email already registered'), { status: 409 })
    const password_hash = await bcrypt.hash(password, 10)
    const doc = { name, email, password_hash, role, phone, created_at: new Date() }
    const res = await DatabaseFactory.col('users').insertOne(doc)
    doc._id = res.insertedId
    NotificationService.publish('user.registered', { id: doc._id.toString(), name, role })
    return User.wrap(doc)
  }

  static wrap(row) {
    if (!row) return null
    const K = { student: Student, warden: Warden, admin: Admin }[row.role] || User
    return new K(row)
  }

  static async login(email, password) {
    const row = await DatabaseFactory.col('users').findOne({ email })
    if (!row) throw Object.assign(new Error('invalid credentials'), { status: 401 })
    const ok = await bcrypt.compare(password, row.password_hash)
    if (!ok) throw Object.assign(new Error('invalid credentials'), { status: 401 })
    return User.wrap(row)
  }

  static async byId(id) {
    const _id = oid(id); if (!_id) return null
    const row = await DatabaseFactory.col('users').findOne({ _id })
    return User.wrap(row)
  }

  toPublic() { const { password_hash, ...rest } = this; return serialize(rest) }
}

class Student extends User {
  async apply(preferences) {
    const existing = await DatabaseFactory.col('applications').findOne({ student_id: this._id, status: { $ne: 'rejected' } })
    if (existing) throw Object.assign(new Error('You already have an active application'), { status: 400 })
    const doc = {
      student_id: this._id, student_name: this.name, preferences, status: 'pending',
      room_id: null, applied_at: new Date(),
    }
    const res = await DatabaseFactory.col('applications').insertOne(doc)
    doc._id = res.insertedId
    NotificationService.publish('application.created', { id: doc._id.toString(), student: this.name })
    return doc
  }
}
class Warden extends User {}
class Admin extends User {}

// ─── Room ────────────────────────────────────────────────────────────────
class Room {
  static async create(d) {
    const doc = {
      room_number: d.room_number,
      block: d.block || 'A',
      floor: Number(d.floor) || 1,
      room_type: d.room_type || 'double',
      capacity: Number(d.capacity) || 2,
      rent: Number(d.rent) || 5000,
      occupants: [],
      created_at: new Date(),
    }
    try {
      const res = await DatabaseFactory.col('rooms').insertOne(doc)
      doc._id = res.insertedId
      return doc
    } catch (e) {
      if (e.code === 11000) throw Object.assign(new Error('Room number already exists'), { status: 409 })
      throw e
    }
  }
  static all() { return DatabaseFactory.col('rooms').find().sort({ room_number: 1 }).toArray() }
  static get(id) { const _id = oid(id); return _id ? DatabaseFactory.col('rooms').findOne({ _id }) : null }
  static addOccupant(roomId, studentId) {
    return DatabaseFactory.col('rooms').updateOne({ _id: roomId }, { $addToSet: { occupants: studentId } })
  }
}

// ─── RoomAllocationEngine ────────────────────────────────────────────────
class RoomAllocationEngine {
  static async allocate(appId, warden, explicitRoomId = null) {
    const _appId = oid(appId); if (!_appId) throw Object.assign(new Error('Invalid application id'), { status: 400 })
    const app = await DatabaseFactory.col('applications').findOne({ _id: _appId })
    if (!app) throw Object.assign(new Error('Application not found'), { status: 404 })
    if (app.status === 'allocated') throw Object.assign(new Error('Already allocated'), { status: 400 })

    let room
    if (explicitRoomId) {
      room = await Room.get(explicitRoomId)
      if (!room) throw Object.assign(new Error('Room not found'), { status: 404 })
      if ((room.occupants || []).length >= room.capacity) throw Object.assign(new Error('Room is full'), { status: 400 })
    } else {
      room = await this._autoPick(app.preferences || {})
      if (!room) throw Object.assign(new Error('No matching room available'), { status: 400 })
    }

    await Room.addOccupant(room._id, app.student_id)
    await DatabaseFactory.col('applications').updateOne(
      { _id: app._id },
      { $set: { status: 'allocated', room_id: room._id, allocated_by: warden.name, allocated_at: new Date() } }
    )
    NotificationService.publish('room.allocated', {
      student: app.student_name, room_number: room.room_number, warden: warden.name,
    })
    return room
  }

  static async _autoPick(prefs) {
    const filter = { $expr: { $lt: [{ $size: { $ifNull: ['$occupants', []] } }, '$capacity'] } }
    if (prefs.room_type) filter.room_type = prefs.room_type
    if (prefs.block) filter.block = prefs.block
    let room = await DatabaseFactory.col('rooms').findOne(filter)
    if (room) return room
    // relax block, then type
    if (prefs.block) { delete filter.block; room = await DatabaseFactory.col('rooms').findOne(filter); if (room) return room }
    if (prefs.room_type) { delete filter.room_type; room = await DatabaseFactory.col('rooms').findOne(filter); if (room) return room }
    return null
  }
}

// ─── Complaint (State machine) ───────────────────────────────────────────
class Complaint {
  static STATES = ['submitted','under_review','assigned','in_progress','resolved']

  static async create(student, category, description) {
    const doc = {
      student_id: student._id, student_name: student.name,
      category, description, status: 'submitted',
      history: [{ status: 'submitted', at: new Date(), by: student.name }],
      created_at: new Date(),
    }
    const res = await DatabaseFactory.col('complaints').insertOne(doc)
    doc._id = res.insertedId
    NotificationService.publish('complaint.created', { id: doc._id.toString(), student: student.name, category })
    return doc
  }

  static async advance(id, next, actor) {
    const _id = oid(id); if (!_id) throw Object.assign(new Error('invalid id'), { status: 400 })
    const c = await DatabaseFactory.col('complaints').findOne({ _id })
    if (!c) throw Object.assign(new Error('Not found'), { status: 404 })
    const cur = this.STATES.indexOf(c.status)
    const nxt = this.STATES.indexOf(next)
    if (nxt < 0) throw Object.assign(new Error('Invalid status'), { status: 400 })
    if (nxt <= cur) throw Object.assign(new Error(`Cannot go from ${c.status} to ${next}`), { status: 400 })
    await DatabaseFactory.col('complaints').updateOne(
      { _id },
      { $set: { status: next, updated_at: new Date() },
        $push: { history: { status: next, at: new Date(), by: actor.name } } }
    )
    NotificationService.publish('complaint.updated', { id: id, from: c.status, to: next, by: actor.name })
  }
}

// ─── Payment ─────────────────────────────────────────────────────────────
class Payment {
  static async create(student, amount, purpose) {
    const doc = {
      student_id: student._id, student_name: student.name,
      amount: Number(amount), purpose, status: 'paid',
      txn_id: 'TXN' + Date.now().toString(36).toUpperCase(),
      created_at: new Date(),
    }
    const res = await DatabaseFactory.col('payments').insertOne(doc)
    doc._id = res.insertedId
    NotificationService.publish('payment.received', { student: student.name, amount })
    return doc
  }
}

// ─── Express (Controller) ────────────────────────────────────────────────
const app = express()
app.use(cors())
app.use(express.json())

const requireAuth = (...roles) => async (req, res, next) => {
  const id = req.header('X-User-Id')
  if (!id) return res.status(401).json({ error: 'missing user' })
  const u = await User.byId(id)
  if (!u) return res.status(401).json({ error: 'invalid user' })
  if (roles.length && !roles.includes(u.role)) return res.status(403).json({ error: 'forbidden' })
  req.user = u
  next()
}

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res))
  .catch(e => { console.error(e); res.status(e.status || 500).json({ error: e.message || 'server error' }) })

// Health / meta
app.get('/api/health', wrap(async (_req, res) => {
  await DatabaseFactory.db().command({ ping: 1 })
  res.json({ ok: true, db: DatabaseFactory.db().databaseName })
}))

app.get('/api/meta/patterns', (_req, res) => res.json({
  patterns: [
    { name: 'Singleton',  klass: 'DatabaseFactory',        purpose: 'Single MongoClient per process' },
    { name: 'Factory',    klass: 'User.create / col()',    purpose: 'Produces Student/Warden/Admin + collection handles' },
    { name: 'Observer',   klass: 'NotificationService',    purpose: 'Publishes + persists domain events' },
    { name: 'State',      klass: 'Complaint',              purpose: 'Enforces lifecycle transitions' },
    { name: 'MVC',        klass: 'Express routes',         purpose: 'Controllers delegating to domain models' },
  ],
  classes: ['User','Student','Warden','Admin','Room','Complaint','Payment','RoomAllocationEngine','NotificationService','DatabaseFactory'],
}))

// Auth
app.post('/api/auth/register', wrap(async (req, res) => {
  const u = await User.create(req.body)
  res.status(201).json(u.toPublic())
}))
app.post('/api/auth/login', wrap(async (req, res) => {
  const u = await User.login(req.body.email, req.body.password)
  res.json(u.toPublic())
}))

// Rooms
app.get('/api/rooms', wrap(async (_req, res) => res.json(serialize(await Room.all()))))
app.post('/api/rooms', requireAuth('admin','warden'), wrap(async (req, res) => {
  res.status(201).json(serialize(await Room.create(req.body)))
}))

// Applications
app.post('/api/applications', requireAuth('student'), wrap(async (req, res) => {
  const doc = await req.user.apply(req.body.preferences || {})
  res.status(201).json(serialize(doc))
}))
app.get('/api/applications/me', requireAuth('student'), wrap(async (req, res) => {
  const docs = await DatabaseFactory.col('applications').find({ student_id: req.user._id }).sort({ applied_at: -1 }).toArray()
  res.json(serialize(docs))
}))
app.get('/api/applications', requireAuth('warden','admin'), wrap(async (_req, res) => {
  const docs = await DatabaseFactory.col('applications').find().sort({ applied_at: -1 }).toArray()
  res.json(serialize(docs))
}))
app.post('/api/applications/:id/allocate', requireAuth('warden','admin'), wrap(async (req, res) => {
  const room = await RoomAllocationEngine.allocate(req.params.id, req.user, req.body.room_id || null)
  res.json({ room_id: room._id.toString(), room_number: room.room_number })
}))

// Complaints
app.post('/api/complaints', requireAuth('student'), wrap(async (req, res) => {
  const c = await Complaint.create(req.user, req.body.category || 'general', req.body.description || '')
  res.status(201).json(serialize(c))
}))
app.get('/api/complaints', wrap(async (req, res) => {
  const uid = req.header('X-User-Id')
  const u = uid ? await User.byId(uid) : null
  const q = (u && u.role === 'student') ? { student_id: u._id } : {}
  const docs = await DatabaseFactory.col('complaints').find(q).sort({ created_at: -1 }).toArray()
  res.json(serialize(docs))
}))
app.post('/api/complaints/:id/advance', requireAuth('warden','admin'), wrap(async (req, res) => {
  await Complaint.advance(req.params.id, req.body.status, req.user)
  res.json({ ok: true })
}))

// Payments
app.post('/api/payments', requireAuth('student'), wrap(async (req, res) => {
  const p = await Payment.create(req.user, req.body.amount || 0, req.body.purpose || 'hostel_fee')
  res.status(201).json(serialize(p))
}))
app.get('/api/payments', wrap(async (req, res) => {
  const uid = req.header('X-User-Id')
  const u = uid ? await User.byId(uid) : null
  const q = (u && u.role === 'student') ? { student_id: u._id } : {}
  const docs = await DatabaseFactory.col('payments').find(q).sort({ created_at: -1 }).toArray()
  res.json(serialize(docs))
}))

// Dashboards
app.get('/api/student/dashboard', requireAuth('student'), wrap(async (req, res) => {
  const s = req.user
  const application = await DatabaseFactory.col('applications').findOne({ student_id: s._id }, { sort: { applied_at: -1 } })
  const room = application?.room_id ? await DatabaseFactory.col('rooms').findOne({ _id: application.room_id }) : null
  const complaints = await DatabaseFactory.col('complaints').find({ student_id: s._id }).sort({ created_at: -1 }).toArray()
  const payments   = await DatabaseFactory.col('payments').find({ student_id: s._id }).sort({ created_at: -1 }).toArray()
  res.json({
    student: { name: s.name, email: s.email, phone: s.phone },
    application: serialize(application),
    room: serialize(room),
    complaints: serialize(complaints),
    payments: serialize(payments),
  })
}))

app.get('/api/admin/dashboard', requireAuth('admin','warden'), wrap(async (_req, res) => {
  const db = DatabaseFactory.db()
  const rooms = await db.collection('rooms').find().toArray()
  const occupied = rooms.filter(r => (r.occupants||[]).length >= r.capacity).length
  const payments = await db.collection('payments').find().toArray()
  res.json({
    stats: {
      students: await db.collection('users').countDocuments({ role: 'student' }),
      wardens:  await db.collection('users').countDocuments({ role: 'warden' }),
      rooms_total: rooms.length,
      rooms_occupied: occupied,
      rooms_available: rooms.length - occupied,
      applications_pending: await db.collection('applications').countDocuments({ status: 'pending' }),
      complaints_open: await db.collection('complaints').countDocuments({ status: { $ne: 'resolved' } }),
      revenue: payments.reduce((a,p) => a + (p.amount || 0), 0),
    },
    recent_events: serialize(await db.collection('events').find().sort({ created_at: -1 }).limit(15).toArray()),
  })
}))

// ─── Boot ────────────────────────────────────────────────────────────────
const PORT = 3000
DatabaseFactory.init()
  .then(() => app.listen(PORT, () => console.log(`[API] http://localhost:${PORT}`)))
  .catch(err => { console.error('[FATAL]', err); process.exit(1) })

export { DatabaseFactory, User, Room, bcrypt }
