const { getPool } = require('../db/pool')
async function getCounters() {
  const pool = getPool()
  const [rowsVeio] = await pool.query('SELECT serie, SUM(veio=1) AS veio FROM records GROUP BY serie')
  const [rowsChamado] = await pool.query('SELECT serie, SUM(chamado=1) AS chamado FROM records GROUP BY serie')
  const map = {}
  for (const r of rowsVeio) { map[r.serie] = map[r.serie] || { serie: r.serie, veio: 0, chamado: 0 }; map[r.serie].veio = Number(r.veio) }
  for (const r of rowsChamado) { map[r.serie] = map[r.serie] || { serie: r.serie, veio: 0, chamado: 0 }; map[r.serie].chamado = Number(r.chamado) }
  return Object.values(map).sort((a,b)=>a.serie.localeCompare(b.serie))
}
module.exports = { getCounters }
