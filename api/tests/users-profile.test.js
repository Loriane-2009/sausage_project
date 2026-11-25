// Tests du profil utilisateur : GET, PATCH et DELETE /api/users/:id
// (le POST /api/users est testé dans users.test.js)
//
// Lignes du tableau des routes :
// GET    /api/users/:id | connecté         | 200, 401, 404
//        (les autres joueurs ne voient que le username)
// PATCH  /api/users/:id | soi-même ou admin | 200, 401, 403, 404, 409, 422
//        (le role n'est modifiable que par un admin)
// DELETE /api/users/:id | soi-même ou admin | 204, 401, 403, 404
//        (supprime aussi ses parties et ses participations)

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import supertest from 'supertest';

import app from '../src/app.js';
import Game from '../src/models/game.js';
import User from '../src/models/user.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

// Un id au bon format mais qui n'existe pas en base
const unknownId = new mongoose.Types.ObjectId().toString();

// Crée une partie directement en base (sans passer par l'API des parties)
function createGame({ host, players = [], invitationCode = 'ABC123' }) {
  return Game.create({
    map: new mongoose.Types.ObjectId(),
    host: host._id,
    invitationCode,
    maxPlayers: 4,
    participations: [host, ...players].map(player => ({ user: player._id }))
  });
}

before(() => User.init());
beforeEach(cleanUpDatabase);
after(() => mongoose.disconnect());

describe('GET /api/users/:id', () => {
  test('renvoie tout son propre profil, email compris', async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .get(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, lea.id);
    assert.equal(res.body.username, 'lea');
    assert.equal(res.body.email, 'lea@example.com');
    assert.equal(res.body.role, 'user');
    assert.equal(res.body.passwordHash, undefined);
  });

  test("ne renvoie que l'id et le username du profil d'un autre joueur", async () => {
    const lea = await createUser({ username: 'lea' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .get(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { id: ana.id, username: 'ana' });
  });

  test("renvoie l'email d'un autre joueur à un admin", async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .get(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'ana@example.com');
  });

  test("renvoie 401 si l'utilisateur n'est pas connecté", async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app).get(`/api/users/${lea.id}`);

    assert.equal(res.status, 401);
  });

  test("renvoie 404 si l'utilisateur n'existe pas", async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .get(`/api/users/${unknownId}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 404);
    assert.equal(typeof res.body.message, 'string');
  });

  test("renvoie 404 si l'id est mal formé", async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .get('/api/users/abc')
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 404);
  });
});

describe('PATCH /api/users/:id', () => {
  test('modifie son propre username', async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .patch(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`)
      .send({ username: 'lea2' });

    assert.equal(res.status, 200);
    assert.equal(res.body.username, 'lea2');
    assert.equal(res.body.passwordHash, undefined);
    const saved = await User.findById(lea.id).exec();
    assert.equal(saved.username, 'lea2');
  });

  test('modifie son mot de passe et le stocke haché', async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .patch(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`)
      .send({ password: 'nouveaumotdepasse' });

    assert.equal(res.status, 200);
    const saved = await User.findById(lea.id).exec();
    assert.ok(await bcrypt.compare('nouveaumotdepasse', saved.passwordHash));
  });

  test("permet à un admin de modifier le profil d'un autre", async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .patch(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ email: 'ana.nouveau@example.com' });

    assert.equal(res.status, 200);
    assert.equal(res.body.email, 'ana.nouveau@example.com');
  });

  test("permet à un admin de changer le rôle d'un autre", async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .patch(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ role: 'admin' });

    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'admin');
  });

  test('renvoie 403 si un user essaie de changer son propre rôle', async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .patch(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`)
      .send({ role: 'admin' });

    assert.equal(res.status, 403);
    const saved = await User.findById(lea.id).exec();
    assert.equal(saved.role, 'user');
  });

  test("renvoie 403 si un user modifie le profil d'un autre", async () => {
    const lea = await createUser({ username: 'lea' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .patch(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`)
      .send({ username: 'pirate' });

    assert.equal(res.status, 403);
    const saved = await User.findById(ana.id).exec();
    assert.equal(saved.username, 'ana');
  });

  test("renvoie 401 si l'utilisateur n'est pas connecté", async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .patch(`/api/users/${lea.id}`)
      .send({ username: 'lea2' });

    assert.equal(res.status, 401);
  });

  test("renvoie 404 si l'utilisateur n'existe pas", async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });

    const res = await supertest(app)
      .patch(`/api/users/${unknownId}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`)
      .send({ username: 'personne' });

    assert.equal(res.status, 404);
  });

  test('renvoie 409 si le nouveau username est déjà pris', async () => {
    const lea = await createUser({ username: 'lea' });
    await createUser({ username: 'ana' });

    const res = await supertest(app)
      .patch(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`)
      .send({ username: 'ana' });

    assert.equal(res.status, 409);
  });

  const invalidCases = [
    ['aucun champ à modifier', {}],
    ['username trop court', { username: 'le' }],
    ['email invalide', { email: 'pas-un-email' }],
    ['password trop court', { password: 'court' }]
  ];

  for (const [label, body] of invalidCases) {
    test(`renvoie 422 si ${label}`, async () => {
      const lea = await createUser({ username: 'lea' });

      const res = await supertest(app)
        .patch(`/api/users/${lea.id}`)
        .set('Authorization', `Bearer ${generateToken(lea)}`)
        .send(body);

      assert.equal(res.status, 422);
      assert.equal(typeof res.body.message, 'string');
      const saved = await User.findById(lea.id).exec();
      assert.equal(saved.username, 'lea');
    });
  }
});

describe('DELETE /api/users/:id', () => {
  test('supprime son propre compte', async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app)
      .delete(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 204);
    assert.equal(await User.findById(lea.id).exec(), null);
  });

  test("permet à un admin de supprimer le compte d'un autre", async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .delete(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`);

    assert.equal(res.status, 204);
    assert.equal(await User.findById(ana.id).exec(), null);
  });

  test('supprime les parties dont il est l’hôte', async () => {
    const lea = await createUser({ username: 'lea' });
    const ana = await createUser({ username: 'ana' });
    const game = await createGame({ host: lea, players: [ana] });

    const res = await supertest(app)
      .delete(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 204);
    assert.equal(await Game.findById(game.id).exec(), null);
  });

  test('le retire des parties des autres joueurs', async () => {
    const lea = await createUser({ username: 'lea' });
    const ana = await createUser({ username: 'ana' });
    const game = await createGame({ host: ana, players: [lea] });

    const res = await supertest(app)
      .delete(`/api/users/${lea.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 204);
    const saved = await Game.findById(game.id).exec();
    assert.ok(saved, "la partie d'Ana doit toujours exister");
    assert.deepEqual(
      saved.participations.map(p => p.user.toString()),
      [ana.id]
    );
  });

  test("renvoie 403 si un user supprime le compte d'un autre", async () => {
    const lea = await createUser({ username: 'lea' });
    const ana = await createUser({ username: 'ana' });

    const res = await supertest(app)
      .delete(`/api/users/${ana.id}`)
      .set('Authorization', `Bearer ${generateToken(lea)}`);

    assert.equal(res.status, 403);
    assert.ok(await User.findById(ana.id).exec());
  });

  test("renvoie 401 si l'utilisateur n'est pas connecté", async () => {
    const lea = await createUser({ username: 'lea' });

    const res = await supertest(app).delete(`/api/users/${lea.id}`);

    assert.equal(res.status, 401);
  });

  test("renvoie 404 si l'utilisateur n'existe pas", async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });

    const res = await supertest(app)
      .delete(`/api/users/${unknownId}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`);

    assert.equal(res.status, 404);
  });
});