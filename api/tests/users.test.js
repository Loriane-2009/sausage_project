// Tests de POST /api/users (inscription) — niveau « complet ».
//
// Ligne du tableau des routes :
// POST /api/users | Crée un compte | public | username, email, password
// | 201, 409, 422 | 409 si username ou email déjà pris. role = user à la création
//
// Règles de validation supposées (à confirmer en groupe, puis à reporter
// dans le schéma Mongoose et dans openapi.yml) :
// - username : obligatoire, 3 à 20 caractères, unique
// - email    : obligatoire, format e-mail, unique
// - password : obligatoire, 8 caractères minimum
// - la réponse JSON expose `id` (et pas `_id`), jamais `password` ni `passwordHash`

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import supertest from 'supertest';

import app from '../src/app.js';
import User from '../src/models/user.js';
import { cleanUpDatabase, createUser } from './utils.js';

const validBody = {
  username: 'lea',
  email: 'lea@example.com',
  password: 'motdepasse123'
};

// Attend que MongoDB ait créé les index « unique » avant le premier test.
before(() => User.init());
beforeEach(cleanUpDatabase);
after(() => mongoose.disconnect());

describe('POST /api/users', () => {
  test('crée un compte et renvoie 201 avec un header Location', async () => {
    const res = await supertest(app).post('/api/users').send(validBody);

    assert.equal(res.status, 201);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.ok(mongoose.isValidObjectId(res.body.id), 'la réponse doit contenir un id');
    assert.equal(res.headers.location, `/api/users/${res.body.id}`);
    assert.equal(res.body.username, 'lea');
    assert.equal(res.body.email, 'lea@example.com');
    assert.equal(res.body.role, 'user');
  });

  test('ne renvoie jamais le mot de passe ni son hash', async () => {
    const res = await supertest(app).post('/api/users').send(validBody);

    assert.equal(res.status, 201);
    assert.equal(res.body.password, undefined);
    assert.equal(res.body.passwordHash, undefined);
  });

  test('enregistre le mot de passe haché avec bcrypt', async () => {
    await supertest(app).post('/api/users').send(validBody);

    const user = await User.findOne({ username: 'lea' }).exec();
    assert.ok(user, "l'utilisateur n'a pas été enregistré");
    assert.notEqual(user.passwordHash, validBody.password);
    assert.ok(await bcrypt.compare(validBody.password, user.passwordHash));
  });

  test('ignore un role envoyé par le client et crée un simple user', async () => {
    const res = await supertest(app)
      .post('/api/users')
      .send({ ...validBody, role: 'admin' });

    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'user');
    const user = await User.findById(res.body.id).exec();
    assert.equal(user.role, 'user');
  });

  test('renvoie 409 si le username est déjà pris', async () => {
    await createUser({ username: 'lea', email: 'autre@example.com' });

    const res = await supertest(app).post('/api/users').send(validBody);

    assert.equal(res.status, 409);
    assert.equal(typeof res.body.message, 'string');
    assert.equal(await User.countDocuments().exec(), 1);
  });

  test("renvoie 409 si l'email est déjà pris", async () => {
    await createUser({ username: 'autre', email: 'lea@example.com' });

    const res = await supertest(app).post('/api/users').send(validBody);

    assert.equal(res.status, 409);
    assert.equal(typeof res.body.message, 'string');
    assert.equal(await User.countDocuments().exec(), 1);
  });

  // Un test par donnée invalide : chacun reste ciblé et lisible dans le rapport.
  const invalidCases = [
    ['username manquant', { ...validBody, username: undefined }],
    ['email manquant', { ...validBody, email: undefined }],
    ['password manquant', { ...validBody, password: undefined }],
    ['username trop court', { ...validBody, username: 'le' }],
    ['username trop long', { ...validBody, username: 'a'.repeat(21) }],
    ['email invalide', { ...validBody, email: 'pas-un-email' }],
    ['password trop court', { ...validBody, password: 'court' }]
  ];

  for (const [label, body] of invalidCases) {
    test(`renvoie 422 si ${label}`, async () => {
      const res = await supertest(app).post('/api/users').send(body);

      assert.equal(res.status, 422);
      assert.equal(typeof res.body.message, 'string');
      assert.equal(await User.countDocuments().exec(), 0);
    });
  }
});
