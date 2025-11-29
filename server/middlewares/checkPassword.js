module.exports = function(req, res, next) {
  const password = req.body.password || req.headers['x-admin-password']
  if (!process.env.ADMIN_PASSWORD) return res.status(500).json({ error: 'Configuração ausente' })
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).json({ error: 'Senha inválida' })
  next()
}
