import mongoose from 'mongoose';

import User from '../models/user.js';

// Charge l'utilisateur de l'URL (/api/users/:id) et le met dans req.user.
// Répond 404 si l'id est mal formé ou si l'utilisateur n'existe pas.
export async function loadUserFromParams(req, res, next) {
  const { id } = req.params;

  // Sans ce contrôle, un id comme « abc » ferait planter findById (erreur 500)
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).send({ message: 'Utilisateur introuvable' });
  }

  const user = await User.findById(id).exec();
  if (!user) {
    return res.status(404).send({ message: 'Utilisateur introuvable' });
  }

  req.user = user;
  next();
}
