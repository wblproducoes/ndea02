const fs = require('fs')
const path = require('path')
const { getPool } = require('./pool')
async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'ddl.sql'), 'utf8')
  const stmts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)
  const pool = getPool()
  for (const s of stmts) {
    await pool.query(s)
  }
}
module.exports = { ensureSchema }
