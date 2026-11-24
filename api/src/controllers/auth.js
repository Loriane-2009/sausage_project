import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { jwtExpiresIn, jwtSecret } from '../config.js';
import User from '../models/user.js';

// POST /api/auth/tokens — connexion : renvoie un JWT
export async function createToken(req, res) {
  const { username, password } = req.body ?? {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res
      .status(422)
      .send({ message: 'username et password sont obligatoires' });
  }

  const user = await User.findOne({ username: username.trim() }).exec();

  // Même message si le username n'existe pas ou si le mot de passe est faux :
  // on ne révèle pas quels usernames existent.
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!valid) {
    return res.status(401).send({ message: 'Identifiants incorrects' });
  }

  // « sub » (subject) = l'id de l'utilisateur, standard des JWT
  const token = jwt.sign({ sub: user._id.toString() }, jwtSecret, {
    expiresIn: jwtExpiresIn
  });

  res.send({ token });
}
