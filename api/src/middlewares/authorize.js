// Middlewares d'autorisation, à placer APRÈS authenticate.

// Réservé aux admins (ex. créer une map)
export function requireAdmin(req, res, next) {
  if (req.currentUser.role !== 'admin') {
    return res.status(403).send({ message: 'Forbidden' });
  }
  next();
}

// Réservé à l'utilisateur concerné par l'URL, ou à un admin
// (ex. PATCH /api/users/:id). Par défaut, l'id est lu dans req.params.id.
export function requireSelfOrAdmin(paramName = 'id') {
  return function (req, res, next) {
    const isSelf = req.currentUser.id === req.params[paramName];
    if (!isSelf && req.currentUser.role !== 'admin') {
      return res.status(403).send({ message: 'Forbidden' });
    }
    next();
  };
}
