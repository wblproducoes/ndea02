const xlsx = require('xlsx')
const crypto = require('crypto')
const { getPool } = require('../db/pool')
function norm(v) { return String(v || '').trim() }
function makeKey(serie, aluno, mesa) { return crypto.createHash('sha1').update(`${serie}|${aluno}|${mesa}`).digest('hex') }
async function upsertExcel(buffer, tableId) {
  const wb = xlsx.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '' })
  const pool = getPool()
  let inserted = 0
  let updated = 0
  for (const row of rows) {
    const serie = norm(row['Série'])
    const aluno = norm(row['Aluno'])
    const mesa = norm(row['Mesa'])
    const veio = ['Sim','sim','SIM','1','true'].includes(norm(row['Veio']))
    const chamado = ['Sim','sim','SIM','1','true'].includes(norm(row['Chamado']))
    const produtos = norm(row['Produtos'])
    if (!serie || !aluno || !mesa) continue
    const uniqueKey = makeKey(serie, aluno, mesa)
    const [exists] = await pool.query('SELECT id FROM records WHERE unique_key=?', [uniqueKey])
    if (exists.length) {
      const id = exists[0].id
      await pool.query('UPDATE records SET serie=?, aluno=?, mesa=?, veio=?, chamado=?, produtos=?, table_id=? WHERE id=?', [serie, aluno, mesa, veio ? 1 : 0, chamado ? 1 : 0, produtos, tableId || null, id])
      updated++
    } else {
      await pool.query('INSERT INTO records (table_id, serie, aluno, mesa, veio, chamado, produtos, unique_key) VALUES (?,?,?,?,?,?,?,?)', [tableId || null, serie, aluno, mesa, veio ? 1 : 0, chamado ? 1 : 0, produtos, uniqueKey])
      inserted++
    }
  }
  return { inserted, updated, total: inserted + updated }
}
module.exports = { upsertExcel }
