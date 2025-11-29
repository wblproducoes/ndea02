const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const { getPool } = require('../db/pool')
const { emitStatusUpdate, emitCounterUpdate } = require('../services/realtime')
function makeKey(serie, aluno, mesa) { return crypto.createHash('sha1').update(`${serie}|${aluno}|${mesa}`).digest('hex') }
router.get('/tables', async (req, res) => {
  const pool = getPool()
  const [rows] = await pool.query('SELECT id, name, session_key FROM tables ORDER BY id')
  res.json(rows)
})
router.get('/my-station', async (req, res) => {
  const pool = getPool()
  const sessionKey = String(req.query.session_key || '').trim()
  if (!sessionKey) return res.status(400).json({ error: 'session_key ausente' })
  const [rows] = await pool.query('SELECT id, name FROM tables WHERE session_key=?', [sessionKey])
  if (!rows.length) return res.status(404).json({ error: 'Estação não encontrada' })
  const tableId = rows[0].id
  const [rrole] = await pool.query('SELECT role FROM station_roles WHERE table_id=?', [tableId])
  res.json({ table_id: tableId, name: rows[0].name, role: rrole.length ? rrole[0].role : null })
})
router.post('/register-station', async (req, res) => {
  const pool = getPool()
  const sessionKey = String(req.body.session_key || '').trim()
  let name = String(req.body.name || '').trim()
  if (!sessionKey) return res.status(400).json({ error: 'session_key ausente' })
  const [rows] = await pool.query('SELECT id, name FROM tables WHERE session_key=?', [sessionKey])
  if (rows.length) {
    const tableId = rows[0].id
    const [rrole] = await pool.query('SELECT role FROM station_roles WHERE table_id=?', [tableId])
    return res.json({ table_id: tableId, name: rows[0].name, role: rrole.length ? rrole[0].role : null })
  }
  if (!name) name = `Estação ${Math.floor(Math.random()*1000)}`
  await pool.query('INSERT INTO tables (name, session_key) VALUES (?,?)', [name, sessionKey])
  const [rows2] = await pool.query('SELECT id, name FROM tables WHERE session_key=?', [sessionKey])
  res.json({ table_id: rows2[0].id, name: rows2[0].name, role: null })
})
router.get('/records', async (req, res) => {
  const pool = getPool()
  const tableId = req.query.table_id ? Number(req.query.table_id) : null
  let sql = 'SELECT id, table_id, serie, aluno, mesa, veio, chamado, produtos, updated_at FROM records'
  const params = []
  if (tableId) { sql += ' WHERE table_id=?'; params.push(tableId) }
  sql += ' ORDER BY serie, aluno'
  const [rows] = await pool.query(sql, params)
  const [lr] = await pool.query('SELECT MAX(changed_at) AS ts FROM logs WHERE action_type="GLOBAL_RESET"')
  const resetTs = lr.length ? lr[0].ts : null
  let lastSql = 'SELECT record_id, table_id, action_type, changed_at FROM logs WHERE action_type IN ("TOGGLE_VEIO","TOGGLE_CHAMADO") AND record_id IS NOT NULL'
  const lastParams = []
  if (resetTs) { lastSql += ' AND changed_at > ?'; lastParams.push(resetTs) }
  lastSql += ' ORDER BY changed_at DESC'
  const [last] = await pool.query(lastSql, lastParams)
  const lastVeio = {}
  const lastChamado = {}
  for (const l of last) {
    if (l.action_type === 'TOGGLE_VEIO' && !(l.record_id in lastVeio)) lastVeio[l.record_id] = l.table_id
    if (l.action_type === 'TOGGLE_CHAMADO' && !(l.record_id in lastChamado)) lastChamado[l.record_id] = l.table_id
  }
  const [tables] = await pool.query('SELECT id, name FROM tables')
  const mapNames = {}
  for (const t of tables) mapNames[t.id] = t.name
  const enriched = rows.map(r => ({
    ...r,
    altered_by_veio: r.id in lastVeio ? mapNames[lastVeio[r.id]] || null : null,
    altered_by_chamado: r.id in lastChamado ? mapNames[lastChamado[r.id]] || null : null
  }))
  res.json(enriched)
})
router.post('/record/:id/toggle', async (req, res) => {
  const pool = getPool()
  const id = Number(req.params.id)
  const field = String(req.body.field || '').trim()
  let tableId = req.body.table_id ? Number(req.body.table_id) : null
  const sessionKey = req.body.session_key ? String(req.body.session_key).trim() : ''
  if (!id || !['veio','chamado'].includes(field)) return res.status(400).json({ error: 'Parâmetros inválidos' })
  const [rows] = await pool.query('SELECT veio, chamado FROM records WHERE id=?', [id])
  if (!rows.length) return res.status(404).json({ error: 'Registro não encontrado' })
  const oldValue = rows[0][field] ? 1 : 0
  const newValue = oldValue ? 0 : 1
  if (!tableId && sessionKey) {
    const [ts] = await pool.query('SELECT id, name FROM tables WHERE session_key=?', [sessionKey])
    if (ts.length) tableId = ts[0].id
  }
  if (!tableId) return res.status(403).json({ error: 'Estação não identificada' })
  const [tinfo] = await pool.query('SELECT name FROM tables WHERE id=?', [tableId])
  if (!tinfo.length) return res.status(403).json({ error: 'Estação não identificada' })
  const byName = tinfo[0].name || ''
  if (/^Estação\s/.test(byName)) return res.status(403).json({ error: 'Estação não identificada' })
  const [roleRow] = await pool.query('SELECT role FROM station_roles WHERE table_id=?', [tableId])
  const role = roleRow.length ? String(roleRow[0].role || '').toLowerCase() : ''
  if (role !== 'admin') {
    if (role === 'apresentador' && field !== 'chamado') return res.status(403).json({ error: 'Permissão insuficiente (apresentador)' })
    if (role === 'coxia' && field !== 'veio') return res.status(403).json({ error: 'Permissão insuficiente (coxia)' })
    if (!['apresentador','coxia'].includes(role)) return res.status(403).json({ error: 'Estação sem função definida' })
  }
  await pool.query(`UPDATE records SET ${field}=? WHERE id=?`, [newValue, id])
  await pool.query('INSERT INTO logs (record_id, table_id, action_type, details) VALUES (?,?,?,?)', [id, tableId, field === 'veio' ? 'TOGGLE_VEIO' : 'TOGGLE_CHAMADO', JSON.stringify({ field, oldValue, newValue })])
  emitStatusUpdate({ record_id: id, field, value: newValue, table_id: tableId, by_name: byName })
  const [cntVeio] = await pool.query('SELECT serie, SUM(veio=1) AS veio FROM records GROUP BY serie')
  const [cntChamado] = await pool.query('SELECT serie, SUM(chamado=1) AS chamado FROM records GROUP BY serie')
  const map = {}
  for (const r of cntVeio) { map[r.serie] = map[r.serie] || { serie: r.serie, veio: 0, chamado: 0 }; map[r.serie].veio = Number(r.veio) }
  for (const r of cntChamado) { map[r.serie] = map[r.serie] || { serie: r.serie, veio: 0, chamado: 0 }; map[r.serie].chamado = Number(r.chamado) }
  emitCounterUpdate(Object.values(map))
  res.json({ id, field, value: newValue })
})
router.get('/counters', async (req, res) => {
  const { getCounters } = require('../services/counters')
  const data = await getCounters()
  res.json(data)
})
module.exports = router
// Last reset timestamp
router.get('/last-reset', async (req, res) => {
  const pool = getPool()
  const [lr] = await pool.query('SELECT MAX(changed_at) AS ts FROM logs WHERE action_type="GLOBAL_RESET"')
  const ts = lr.length && lr[0].ts ? lr[0].ts : null
  res.json({ ts })
})
