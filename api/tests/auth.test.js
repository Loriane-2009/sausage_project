// Tests de POST /api/auth/tokens (connexion) — niveau « complet ».
//
// Ligne du tableau des routes :
// POST /api/auth/tokens | Connecte l'utilisateur et renvoie un JWT | public
// | username, password | 200 ({ token }), 401, 422 | login par username uniquement

import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import supertest from 'supertest';

import app from '../src/app.js';
import { cleanUpDatabase, createUser } from './utils.js';

beforeEach(cleanUpDatabase);
after(() => mongoose.disconnect());

describe('POST /api/auth/tokens', () => {
  test('renvoie 200 et un JWT valide avec les bons identifiants', async () => {
    const user = await createUser({
      username: 'lea',
      password: 'motdepasse123'
    });

    const res = await supertest(app)
      .post('/api/auth/tokens')
      .send({ username: 'lea', password: 'motdepasse123' });

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(typeof res.body.token, 'string');

    // Le token est signé avec notre secret et contient l'id de l'utilisateur
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    assert.equal(payload.sub, user._id.toString());
    assert.ok(payload.exp > payload.iat, 'le token doit avoir une expiration');
  });

  test('renvoie 401 si le mot de passe est faux', async () => {
    await createUser({ username: 'lea', password: 'motdepasse123' });

    const res = await supertest(app)
      .post('/api/auth/tokens')
      .send({ username: 'lea', password: 'mauvais-mdp' });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Identifiants incorrects');
    assert.equal(res.body.token, undefined);
  });

  test("renvoie 401 avec le même message si le username n'existe pas", async () => {
    const res = await supertest(app)
      .post('/api/auth/tokens')
      .send({ username: 'inconnue', password: 'motdepasse123' });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Identifiants incorrects');
  });

  test('renvoie 422 si le username manque', async () => {
    const res = await supertest(app)
      .post('/api/auth/tokens')
      .send({ password: 'motdepasse123' });

    assert.equal(res.status, 422);
    assert.equal(typeof res.body.message, 'string');
  });

  test('renvoie 422 si le password manque', async () => {
    const res = await supertest(app)
      .post('/api/auth/tokens')
      .send({ username: 'lea' });

    assert.equal(res.status, 422);
    assert.equal(typeof res.body.message, 'string');
  });
});
