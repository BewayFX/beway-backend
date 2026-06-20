module.exports = function requireAdmin(req, res, next) {
  const key = req.header('x-admin-key');
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid x-admin-key header.' });
  }
  next();
};
