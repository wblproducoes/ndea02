const express = require('express')
const router = express.Router()
const { getPool } = require('../db/pool')
const checkPassword = require('../middlewares/checkPassword')
const { emitDataRefresh, emitTableRenamed } = require('../services/realtime')
router.post('/reset', checkPassword, async (req, res) => {
  const pool = getPool()
  await pool.query('UPDATE records SET veio=0, chamado=0')
  await pool.query('INSERT INTO logs (action_type, details) VALUES (?,?)', ['GLOBAL_RESET', JSON.stringify({})])
  emitDataRefresh({ reason: 'reset' })
  res.json({ ok: true })
})
router.post('/rename-table', checkPassword, async (req, res) => {
  const pool = getPool()
  const tableId = Number(req.body.table_id)
  const newName = String(req.body.new_name || '').trim()
  const role = req.body.role ? String(req.body.role).trim().toLowerCase() : ''
  if (!tableId || !newName) return res.status(400).json({ error: 'Parâmetros inválidos' })
  await pool.query('UPDATE tables SET name=? WHERE id=?', [newName, tableId])
  await pool.query('INSERT INTO logs (table_id, action_type, details) VALUES (?,?,?)', [tableId, 'RENAME_TABLE', JSON.stringify({ new_name: newName })])
  emitTableRenamed({ table_id: tableId, name: newName })
  if (role && ['admin','apresentador','coxia'].includes(role)) {
    await pool.query('CREATE TABLE IF NOT EXISTS station_roles (table_id INT PRIMARY KEY, role VARCHAR(20) NOT NULL, FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE ON UPDATE CASCADE)')
    await pool.query('REPLACE INTO station_roles (table_id, role) VALUES (?, ?)', [tableId, role])
    await pool.query('INSERT INTO logs (table_id, action_type, details) VALUES (?,?,?)', [tableId, 'SET_ROLE', JSON.stringify({ role })])
  }
  res.json({ ok: true, role: role || null })
})
module.exports = router

// Set role for station
router.post('/set-role', checkPassword, async (req, res) => {
  const pool = getPool()
  const tableId = Number(req.body.table_id)
  const role = String(req.body.role || '').trim().toLowerCase()
  if (!tableId || !['admin','apresentador','coxia'].includes(role)) return res.status(400).json({ error: 'Parâmetros inválidos' })
  await pool.query('CREATE TABLE IF NOT EXISTS station_roles (table_id INT PRIMARY KEY, role VARCHAR(20) NOT NULL, FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE ON UPDATE CASCADE)')
  await pool.query('REPLACE INTO station_roles (table_id, role) VALUES (?, ?)', [tableId, role])
  await pool.query('INSERT INTO logs (table_id, action_type, details) VALUES (?,?,?)', [tableId, 'SET_ROLE', JSON.stringify({ role })])
  res.json({ ok: true, table_id: tableId, role })
})
