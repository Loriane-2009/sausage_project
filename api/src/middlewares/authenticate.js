import jwt from 'jsonwebtoken';

import { jwtSecret } from '../config.js';
import User from '../models/user.js';

// À placer avant toute route qui demande d'être connecté.
// Lit le header « Authorization: Bearer <token> », vérifie le token,
// puis met l'utilisateur connecté dans req.currentUser.
export async function authenticate(req, res, next) {
  const header = req.get('Authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).send({ message: 'Authentication required' });
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    // Signature fausse, token modifié ou expiré
    return res.status(401).send({ message: 'Invalid or expired token' });
  }

  // L'utilisateur a peut-être été supprimé depuis la création du token
  const user = await User.findById(payload.sub).exec();
  if (!user) {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }

  req.currentUser = user;
  next();
}