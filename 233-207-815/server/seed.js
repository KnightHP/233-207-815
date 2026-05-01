/** Seed demo users + rooms into MongoDB Atlas (idempotent). */
import 'dotenv/config'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcryptjs'

const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
await client.connect()
const db = client.db(process.env.DB_NAME || 'hostel_mgmt')

await db.collection('users').createIndex({ email: 1 }, { unique: true })
await db.collection('rooms').createIndex({ room_number: 1 }, { unique: true })

const users = [
  { name: 'System Admin', email: 'admin@hostel.com',   password: 'admin123',   role: 'admin',   phone: '9000000001' },
  { name: 'Warden Khan',  email: 'warden@hostel.com',  password: 'warden123',  role: 'warden',  phone: '9000000002' },
  { name: 'Faheem Ali',   email: 'student@hostel.com', password: 'student123', role: 'student', phone: '9000000003' },
]

console.log('Seeding users…')
for (const u of users) {
  const existing = await db.collection('users').findOne({ email: u.email })
  if (existing) { console.log(`  · ${u.email} exists`); continue }
  const password_hash = await bcrypt.hash(u.password, 10)
  await db.collection('users').insertOne({
    name: u.name, email: u.email, password_hash, role: u.role, phone: u.phone, created_at: new Date(),
  })
  console.log(`  + ${u.email} (${u.role})`)
}

console.log('Seeding rooms…')
let added = 0
for (const block of ['A', 'B']) {
  for (const floor of [1, 2]) {
    for (let n = 1; n <= 5; n++) {
      const num = `${block}${floor}0${n}`
      if (await db.collection('rooms').findOne({ room_number: num })) continue
      const even = n % 2 === 0
      await db.collection('rooms').insertOne({
        room_number: num, block, floor,
        room_type: even ? 'double' : 'triple',
        capacity: even ? 2 : 3,
        rent: even ? 5000 : 4000,
        occupants: [], created_at: new Date(),
      })
      added++
    }
  }
}
console.log(`  + inserted ${added} new rooms`)

await client.close()
console.log('Done.')
