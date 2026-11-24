// Tests des middlewares authenticate, requireAdmin et requireSelfOrAdmin.
//
// Aucune vraie route ne les utilise encore : on les branche sur une petite
// application de test, qui n'existe que dans ce fichier.

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import supertest from 'supertest';

import { authenticate } from '../src/middlewares/authenticate.js';
import {
  requireAdmin,
  requireSelfOrAdmin
} from '../src/middlewares/authorize.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

const app = express();
app.get('/protected', authenticate, (req, res) => {
  res.send({ id: req.currentUser.id });
});
app.get('/admin-only', authenticate, requireAdmin, (req, res) => {
  res.send({ ok: true });
});
app.get('/users/:id', authenticate, requireSelfOrAdmin(), (req, res) => {
  res.send({ ok: true });
});

before(() => mongoose.connect(process.env.DATABASE_URL));
beforeEach(cleanUpDatabase);
after(() => mongoose.disconnect());

describe('authenticate', () => {
  test('laisse passer avec un token valide et fournit req.currentUser', async () => {
    const user = await createUser();

    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${generateToken(user)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.id, user.id);
  });

  test('renvoie 401 sans header Authorization', async () => {
    const res = await supertest(app).get('/protected');

    assert.equal(res.status, 401);
    assert.equal(res.headers['www-authenticate'], 'Bearer');
    assert.equal(res.body.message, 'Authentication required');
  });

  test("renvoie 401 si le header n'est pas au format Bearer", async () => {
    const user = await createUser();

    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', generateToken(user));

    assert.equal(res.status, 401);
    assert.equal(res.headers['www-authenticate'], 'Bearer');
  });

  test('renvoie 401 si le token est signé avec un autre secret', async () => {
    const user = await createUser();
    const fakeToken = jwt.sign({ sub: user.id }, 'pas-le-bon-secret');

    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${fakeToken}`);

    assert.equal(res.status, 401);
    assert.equal(res.headers['www-authenticate'], 'Bearer');
    assert.equal(res.body.message, 'Invalid or expired token');
  });

  test('renvoie 401 si le token est expiré', async () => {
    const user = await createUser();
    const expired = jwt.sign(
      { sub: user.id, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );

    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expired}`);

    assert.equal(res.status, 401);
    assert.equal(res.headers['www-authenticate'], 'Bearer');
  });

  test("renvoie 401 si l'utilisateur du token a été supprimé", async () => {
    const user = await createUser();
    const token = generateToken(user);
    await user.deleteOne();

    const res = await supertest(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 401);
    assert.equal(res.headers['www-authenticate'], 'Bearer');
  });
});

describe('requireAdmin', () => {
  test('laisse passer un admin', async () => {
    const admin = await createUser({ username: 'admin', role: 'admin' });

    const res = await supertest(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${generateToken(admin)}`);

    assert.equal(res.status, 200);
  });

  test('renvoie 403 pour un simple user', async () => {
    const user = await createUser();

    const res = await supertest(app)
      .get('/admin-only')
      .set('Authorization', `Bearer ${generateToken(user)}`);

    assert.equal(res.status, 403);
  });
});

describe('requireSelfOrAdmin', () => {
  test("laisse passer l'utilisateur concerné", async () => {
    const user = await createUser();

    const res = await supertest(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${generateToken(user)}`);

    assert.equal(res.status, 200);
  });

  test('laisse passer un admin pour un autre utilisateur', async () => {
    const user = await createUser();
    const admin = await createUser({ username: 'admin', role: 'admin' });

    const res = await supertest(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${generateToken(admin)}`);

    assert.equal(res.status, 200);
  });

  test('renvoie 403 pour un autre utilisateur', async () => {
    const user = await createUser();
    const other = await createUser({ username: 'autre' });

    const res = await supertest(app)
      .get(`/users/${user.id}`)
      .set('Authorization', `Bearer ${generateToken(other)}`);

    assert.equal(res.status, 403);
  });
});
