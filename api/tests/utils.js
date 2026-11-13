// Outils partagés par tous les fichiers de tests.
// À importer dans chaque fichier *.test.js.

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

import User from '../src/models/user.js';

/**
 * Vide toutes les collections de la base de test.
 * Refuse de tourner sur une base dont le nom ne finit pas par « -test »,
 * pour ne jamais effacer la base locale de travail ni Atlas.
 */
export async function cleanUpDatabase() {
  if (!mongoose.connection.name.endsWith('-test')) {
    throw new Error(`Refus de vider la base ${mongoose.connection.name}`);
  }

  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map(collection => collection.deleteMany({})));
}

/**
 * Crée un utilisateur directement en base (sans passer par l'API).
 * Coût bcrypt à 4 pour que les tests restent rapides.
 */
export async function createUser({
  username = 'joueuse',
  email = `${username}@example.com`,
  password = 'motdepasse123',
  role = 'user'
} = {}) {
  const passwordHash = await bcrypt.hash(password, 4);
  return User.create({ username, email, passwordHash, role });
}

// generateToken(user) sera ajouté ici avec la connexion (POST /api/auth/tokens).
