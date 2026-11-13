// ce qui se passe quand qqn crée un compte
import bcrypt from 'bcrypt';

import User from '../models/user.js';

// POST /api/users — créer un compte
export async function createUser(req, res) {
  const { username, email, password } = req.body;

  // Le mot de passe en clair n'est jamais stocké, donc Mongoose ne peut pas
  // le vérifier : on contrôle sa longueur ici.
  if (typeof password !== 'string' || password.length < 8) {
    return res
      .status(422)
      .send({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // On ne prend pas le "role" envoyé par le client : tout nouveau compte est "user".
  const user = await User.create({ username, email, passwordHash });

  res.status(201).location(`/api/users/${user._id}`).send(user);
}