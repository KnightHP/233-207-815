import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../App'

export default function Rooms() {
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState({ room_number: '', block: 'A', floor: 1, room_type: 'double', capacity: 2, rent: 5000 })
  const { user, toast } = useAuth()

  const load = async () => { try { setRooms(await api.listRooms()) } catch (e) { toast(e.message, 'error') } }
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    try { await api.createRoom({ ...form, floor: Number(form.floor), capacity: Number(form.capacity), rent: Number(form.rent) });
          toast('Room created'); setForm({ ...form, room_number: '' }); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const isStaff = user.role === 'warden' || user.role === 'admin'

  return (
    <>
      <h1 className="page-title">Rooms</h1>
      <p className="page-sub">{rooms.length} total · {rooms.filter(r => (r.occupants||[]).length < r.capacity).length} available</p>

      {isStaff && (
        <div className="card mt-md">
          <div className="section-title">Add New Room</div>
          <form onSubmit={create} style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) auto', gap: 10, alignItems: 'end'}}>
            <div className="field" style={{margin: 0}}>
              <label>Room #</label>
              <input className="input" required value={form.room_number} onChange={e => setForm({...form, room_number: e.target.value})} />
            </div>
            <div className="field" style={{margin: 0}}>
              <label>Block</label>
              <input className="input" value={form.block} onChange={e => setForm({...form, block: e.target.value})} />
            </div>
            <div className="field" style={{margin: 0}}>
              <label>Floor</label>
              <input className="input" type="number" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} />
            </div>
            <div className="field" style={{margin: 0}}>
              <label>Type</label>
              <select className="select" value={form.room_type} onChange={e => setForm({...form, room_type: e.target.value})}>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="triple">Triple</option>
              </select>
            </div>
            <div className="field" style={{margin: 0}}>
              <label>Capacity</label>
              <input className="input" type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
            </div>
            <div className="field" style={{margin: 0}}>
              <label>Rent</label>
              <input className="input" type="number" value={form.rent} onChange={e => setForm({...form, rent: e.target.value})} />
            </div>
            <button className="btn btn-primary">+ Add</button>
          </form>
        </div>
      )}

      <div className="grid cols-4 mt-lg">
        {rooms.map(r => {
          const occ = (r.occupants || []).length
          const full = occ >= r.capacity
          return (
            <div key={r.id} className="room-card">
              <div className="flex-between">
                <div className="num">{r.room_number}</div>
                <span className={`badge ${full ? 'badge-danger' : 'badge-success'}`}>{full ? 'Full' : 'Available'}</span>
              </div>
              <div className="meta">Block {r.block} · Floor {r.floor} · {r.room_type}</div>
              <div className="meta">₹{r.rent}/month</div>
              <div className="occ">
                <div className="flex-between"><span className="muted">Occupancy</span><span>{occ}/{r.capacity}</span></div>
                <div className="occ-bar"><div style={{width: `${(occ / r.capacity) * 100}%`}} /></div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
