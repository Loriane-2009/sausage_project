import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import Game from '../src/models/game.js';
import GameMap from '../src/models/GameMap.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

describe('GET /api/games/:id', () => {
  let host;
  let hostToken;
  let map;
  let game;

  before(() => Game.init());
  after(() => mongoose.disconnect());

  beforeEach(async () => {
    await cleanUpDatabase();
    host = await createUser({ username: 'hote', email: 'hote@test.ch' });
    hostToken = await generateToken(host);
    map = await GameMap.create({
      name: 'Map test',
      difficulty: 'easy',
      obstacles: [
        { x: 1, y: 1 },
        { x: 2, y: 2 }
      ]
    });
    game = await Game.create({
      map: map._id,
      host: host._id,
      invitationCode: 'ABC234',
      maxPlayers: 3,
      participations: [{ user: host._id }]
    });
  });

  test('200 : un participant peut lire la partie', async () => {
    const res = await supertest(app)
      .get(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, game.id);
    assert.equal(res.body.map, map.id);
  });

  test('200 : ?include=map renvoie la map complète', async () => {
    const res = await supertest(app)
      .get(`/api/games/${game.id}?include=map`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.map.name, 'Map test');
    assert.equal(res.body.map.obstacles.length, 2);
  });

  test('200 : un admin peut lire une partie dont il ne fait pas partie', async () => {
    const admin = await createUser({
      username: 'admin2',
      email: 'admin2@test.ch',
      role: 'admin'
    });
    const res = await supertest(app)
      .get(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${await generateToken(admin)}`);
    assert.equal(res.status, 200);
  });

  test('401 : sans token', async () => {
    const res = await supertest(app).get(`/api/games/${game.id}`);
    assert.equal(res.status, 401);
  });

  test('403 : un utilisateur qui ne participe pas à la partie', async () => {
    const stranger = await createUser({
      username: 'intruse',
      email: 'intruse@test.ch'
    });
    const res = await supertest(app)
      .get(`/api/games/${game.id}`)
      .set('Authorization', `Bearer ${await generateToken(stranger)}`);
    assert.equal(res.status, 403);
  });

  test('404 : partie inconnue', async () => {
    const res = await supertest(app)
      .get(`/api/games/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(res.status, 404);
  });

  test('404 : id mal formé', async () => {
    const res = await supertest(app)
      .get('/api/games/pas-un-id')
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(res.status, 404);
  });
});
