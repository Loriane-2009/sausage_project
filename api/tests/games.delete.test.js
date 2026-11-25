import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import Game from '../src/models/game.js';
import GameMap from '../src/models/GameMap.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

describe('DELETE /api/games/:id', () => {
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

  const remove = (id, token) =>
    supertest(app)
      .delete(`/api/games/${id}`)
      .set('Authorization', `Bearer ${token}`);

  test("204 : l'hôte supprime sa partie en attente", async () => {
    const res = await remove(game.id, hostToken);
    assert.equal(res.status, 204);
    assert.equal(await Game.findById(game.id), null);
  });

  test('204 : un admin supprime une partie en cours', async () => {
    await Game.updateOne({ _id: game._id }, { status: 'playing' });
    const admin = await createUser({
      username: 'admin2',
      email: 'admin2@test.ch',
      role: 'admin'
    });
    const res = await remove(game.id, await generateToken(admin));
    assert.equal(res.status, 204);
    assert.equal(await Game.findById(game.id), null);
  });

  test('401 : sans token', async () => {
    const res = await supertest(app).delete(`/api/games/${game.id}`);
    assert.equal(res.status, 401);
  });

  test("403 : un utilisateur qui n'est ni hôte ni admin", async () => {
    const other = await createUser({
      username: 'autre',
      email: 'autre@test.ch'
    });
    const res = await remove(game.id, await generateToken(other));
    assert.equal(res.status, 403);
    assert.notEqual(await Game.findById(game.id), null);
  });

  test('404 : partie inconnue', async () => {
    const res = await remove(new mongoose.Types.ObjectId(), hostToken);
    assert.equal(res.status, 404);
  });

  test('404 : id mal formé', async () => {
    const res = await remove('pas-un-id', hostToken);
    assert.equal(res.status, 404);
  });

  test("409 : l'hôte ne peut pas supprimer une partie déjà lancée", async () => {
    await Game.updateOne({ _id: game._id }, { status: 'playing' });
    const res = await remove(game.id, hostToken);
    assert.equal(res.status, 409);
    assert.notEqual(await Game.findById(game.id), null);
  });
});
