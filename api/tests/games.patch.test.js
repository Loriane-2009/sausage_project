import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import Game from '../src/models/game.js';
import GameMap from '../src/models/GameMap.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

describe('PATCH /api/games/:id', () => {
  let host;
  let hostToken;
  let game;

  before(() => Game.init());
  after(() => mongoose.disconnect());

  beforeEach(async () => {
    await cleanUpDatabase();
    host = await createUser({ username: 'hote', email: 'hote@test.ch' });
    hostToken = await generateToken(host);
    const map = await GameMap.create({
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

  const patch = (id, token, body) =>
    supertest(app)
      .patch(`/api/games/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  test("200 : l'hôte lance la partie", async () => {
    const res = await patch(game.id, hostToken, { status: 'playing' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'playing');
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.status, 'playing');
  });

  test('401 : sans token', async () => {
    const res = await supertest(app)
      .patch(`/api/games/${game.id}`)
      .send({ status: 'playing' });
    assert.equal(res.status, 401);
  });

  test("403 : un utilisateur qui n'est pas l'hôte", async () => {
    const other = await createUser({
      username: 'autre',
      email: 'autre@test.ch'
    });
    const res = await patch(game.id, await generateToken(other), {
      status: 'playing'
    });
    assert.equal(res.status, 403);
  });

  test('404 : partie inconnue', async () => {
    const res = await patch(new mongoose.Types.ObjectId(), hostToken, {
      status: 'playing'
    });
    assert.equal(res.status, 404);
  });

  test('404 : id mal formé', async () => {
    const res = await patch('pas-un-id', hostToken, { status: 'playing' });
    assert.equal(res.status, 404);
  });

  test('409 : la partie est déjà en cours', async () => {
    await Game.updateOne({ _id: game._id }, { status: 'playing' });
    const res = await patch(game.id, hostToken, { status: 'playing' });
    assert.equal(res.status, 409);
  });

  test('409 : la partie est terminée', async () => {
    await Game.updateOne({ _id: game._id }, { status: 'finished' });
    const res = await patch(game.id, hostToken, { status: 'playing' });
    assert.equal(res.status, 409);
  });

  test('422 : statut absent', async () => {
    const res = await patch(game.id, hostToken, {});
    assert.equal(res.status, 422);
  });

  test('422 : statut "finished" interdit', async () => {
    const res = await patch(game.id, hostToken, { status: 'finished' });
    assert.equal(res.status, 422);
  });

  test('422 : statut "waiting" interdit', async () => {
    const res = await patch(game.id, hostToken, { status: 'waiting' });
    assert.equal(res.status, 422);
  });

  test('422 : statut inconnu', async () => {
    const res = await patch(game.id, hostToken, { status: 'nimporte' });
    assert.equal(res.status, 422);
  });
});
