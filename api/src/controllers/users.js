// La logique des routes /api/users
import bcrypt from 'bcrypt';

import Game from '../models/game.js';
import User from '../models/user.js';

const PASSWORD_MIN_LENGTH = 8;

// Le mot de passe en clair n'est jamais stocké, donc Mongoose ne peut pas
// le vérifier : on contrôle sa longueur ici.
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH;
}

// L'utilisateur connecté regarde-t-il son propre profil, ou est-il admin ?
function isSelfOrAdmin(currentUser, user) {
  return currentUser.id === user.id || currentUser.role === 'admin';
}

// POST /api/users — créer un compte
export async function createUser(req, res) {
  const { username, email, password } = req.body;

  if (!isValidPassword(password)) {
    return res
      .status(422)
      .send({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // On ne prend pas le "role" envoyé par le client : tout nouveau compte est "user".
  const user = await User.create({ username, email, passwordHash });

  res.status(201).location(`/api/users/${user._id}`).send(user);
}

// GET /api/users/:id — voir un profil
// Soi-même ou un admin voit tout (dont l'email), les autres seulement le username.
export function getUser(req, res) {
  if (isSelfOrAdmin(req.currentUser, req.user)) {
    return res.send(req.user);
  }

  res.send({ id: req.user.id, username: req.user.username });
}

// PATCH /api/users/:id — modifier un profil (soi-même ou admin)
export async function updateUser(req, res) {
  const body = req.body ?? {};
  const user = req.user;

  // Seuls ces champs peuvent être modifiés, le reste est ignoré
  const fields = ['username', 'email', 'password', 'role'].filter(
    field => body[field] !== undefined
  );
  if (fields.length === 0) {
    return res.status(422).send({ message: 'Aucun champ à modifier' });
  }

  // Seul un admin peut changer un rôle (sinon n'importe qui se mettrait admin)
  if (fields.includes('role') && req.currentUser.role !== 'admin') {
    return res
      .status(403)
      .send({ message: 'Seul un admin peut modifier le rôle' });
  }

  if (fields.includes('password')) {
    if (!isValidPassword(body.password)) {
      return res.status(422).send({
        message: 'Le mot de passe doit contenir au moins 8 caractères'
      });
    }
    user.passwordHash = await bcrypt.hash(body.password, 10);
  }

  for (const field of ['username', 'email', 'role']) {
    if (fields.includes(field)) {
      user[field] = body[field];
    }
  }

  // save() lance les validations du modèle : 422 si invalide,
  // 409 si le username ou l'email est déjà pris (middleware d'erreur)
  await user.save();
  res.send(user);
}

// DELETE /api/users/:id — supprimer un compte (soi-même ou admin)
export async function deleteUser(req, res) {
  const userId = req.user._id;

  // 1. Les parties dont il est l'hôte sont supprimées
  await Game.deleteMany({ host: userId });

  // 2. Il est retiré des parties des autres joueurs
  await Game.updateMany(
    { 'participations.user': userId },
    { $pull: { participations: { user: userId } } }
  );

  // 3. Puis le compte lui-même
  await req.user.deleteOne();

  res.sendStatus(204);
}