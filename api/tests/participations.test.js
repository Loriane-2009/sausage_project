import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import mongoose from 'mongoose';
import supertest from 'supertest';

import app from '../src/app.js';
import Game from '../src/models/game.js';
import GameMap from '../src/models/GameMap.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

before(() => Game.init());
beforeEach(cleanUpDatabase);
after(() => mongoose.disconnect());

async function createGame(host, overrides = {}) {
  const map = await GameMap.create({
    name: 'Map test',
    difficulty: 'easy',
    obstacles: [
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ]
  });
  return Game.create({
    map: map._id,
    host: host._id,
    invitationCode: 'ABC234',
    maxPlayers: 3,
    participations: [{ user: host._id }],
    ...overrides
  });
}

describe('POST /api/games/:id/participations', () => {
  let hote;
  let joueur;
  let autre;

  beforeEach(async () => {
    hote = await createUser({ username: 'hote', email: 'hote@test.ch' });
    joueur = await createUser({ username: 'joueur', email: 'joueur@test.ch' });
    autre = await createUser({ username: 'autre', email: 'autre@test.ch' });
  });

  const join = async (gameId, user, body = { invitationCode: 'ABC234' }) =>
    supertest(app)
      .post(`/api/games/${gameId}/participations`)
      .set('Authorization', `Bearer ${await generateToken(user)}`)
      .send(body);

  it('201 : un joueur rejoint la partie avec le bon code', async () => {
    const game = await createGame(hote);
    const res = await join(game.id, joueur);
    assert.equal(res.status, 201);
    assert.equal(
      res.headers.location,
      `/api/games/${game.id}/participations/${joueur.id}`
    );
    assert.deepEqual(res.body, { user: joueur.id, score: null, rank: null });
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 2);
  });

  it('401 : sans token', async () => {
    const game = await createGame(hote);
    const res = await supertest(app)
      .post(`/api/games/${game.id}/participations`)
      .send({ invitationCode: 'ABC234' });
    assert.equal(res.status, 401);
  });

  it("403 : mauvais code d'invitation", async () => {
    const game = await createGame(hote);
    const res = await join(game.id, joueur, { invitationCode: 'ZZZ999' });
    assert.equal(res.status, 403);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 1);
  });

  it('404 : partie inconnue', async () => {
    const res = await join(new mongoose.Types.ObjectId(), joueur);
    assert.equal(res.status, 404);
  });

  it('404 : id de partie mal formé', async () => {
    const res = await join('pas-un-id', joueur);
    assert.equal(res.status, 404);
  });

  it('409 : la partie est pleine', async () => {
    const game = await createGame(hote, {
      maxPlayers: 2,
      participations: [{ user: hote._id }, { user: autre._id }]
    });
    const res = await join(game.id, joueur);
    assert.equal(res.status, 409);
  });

  it('409 : la partie a déjà été lancée', async () => {
    const game = await createGame(hote, { status: 'playing' });
    const res = await join(game.id, joueur);
    assert.equal(res.status, 409);
  });

  it('409 : le joueur participe déjà', async () => {
    const game = await createGame(hote);
    const res = await join(game.id, hote);
    assert.equal(res.status, 409);
  });
});

describe('DELETE /api/games/:id/participations/:userId', () => {
  let hote;
  let joueur;
  let autre;

  beforeEach(async () => {
    hote = await createUser({ username: 'hote', email: 'hote@test.ch' });
    joueur = await createUser({ username: 'joueur', email: 'joueur@test.ch' });
    autre = await createUser({ username: 'autre', email: 'autre@test.ch' });
  });

  const leave = async (gameId, userId, user) =>
    supertest(app)
      .delete(`/api/games/${gameId}/participations/${userId}`)
      .set('Authorization', `Bearer ${await generateToken(user)}`);

  const gameWithPlayers = (overrides = {}) =>
    createGame(hote, {
      participations: [
        { user: hote._id },
        { user: joueur._id },
        { user: autre._id }
      ],
      ...overrides
    });

  it('204 : un joueur quitte la partie', async () => {
    const game = await gameWithPlayers();
    const res = await leave(game.id, joueur.id, joueur);
    assert.equal(res.status, 204);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 2);
    assert.ok(!inDb.participations.some(p => p.user.equals(joueur._id)));
  });

  it("204 : l'hôte exclut un joueur", async () => {
    const game = await gameWithPlayers();
    const res = await leave(game.id, joueur.id, hote);
    assert.equal(res.status, 204);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 2);
  });

  it("204 : la partie est supprimée quand l'hôte la quitte", async () => {
    const game = await gameWithPlayers();
    const res = await leave(game.id, hote.id, hote);
    assert.equal(res.status, 204);
    assert.equal(await Game.findById(game.id), null);
  });

  it('401 : sans token', async () => {
    const game = await gameWithPlayers();
    const res = await supertest(app).delete(
      `/api/games/${game.id}/participations/${joueur.id}`
    );
    assert.equal(res.status, 401);
  });

  it('403 : un joueur ne peut pas exclure un autre joueur', async () => {
    const game = await gameWithPlayers();
    const res = await leave(game.id, autre.id, joueur);
    assert.equal(res.status, 403);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 3);
  });

  it('404 : partie inconnue', async () => {
    const res = await leave(new mongoose.Types.ObjectId(), joueur.id, joueur);
    assert.equal(res.status, 404);
  });

  it("404 : le joueur n'est pas inscrit à la partie", async () => {
    const game = await createGame(hote);
    const res = await leave(game.id, joueur.id, hote);
    assert.equal(res.status, 404);
  });

  it("409 : la partie n'est plus en attente", async () => {
    const game = await gameWithPlayers({ status: 'playing' });
    const res = await leave(game.id, joueur.id, joueur);
    assert.equal(res.status, 409);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 3);
  });
});

describe('PATCH /api/games/:id/participations/:userId', () => {
  let hote;
  let joueur;
  let autre;

  beforeEach(async () => {
    hote = await createUser({ username: 'hote', email: 'hote@test.ch' });
    joueur = await createUser({ username: 'joueur', email: 'joueur@test.ch' });
    autre = await createUser({ username: 'autre', email: 'autre@test.ch' });
  });

  const sendScore = async (gameId, userId, user, body) =>
    supertest(app)
      .patch(`/api/games/${gameId}/participations/${userId}`)
      .set('Authorization', `Bearer ${await generateToken(user)}`)
      .send(body);

  const playingGame = (overrides = {}) =>
    createGame(hote, {
      status: 'playing',
      participations: [{ user: hote._id }, { user: joueur._id }],
      ...overrides
    });

  it('200 : un joueur envoie son score', async () => {
    const game = await playingGame();
    const res = await sendScore(game.id, joueur.id, joueur, { score: 50 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { user: joueur.id, score: 50, rank: null });
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.status, 'playing');
    assert.equal(inDb.participations[1].score, 50);
  });

  it('200 : le dernier score termine la partie et calcule les rangs', async () => {
    const game = await playingGame({
      participations: [{ user: hote._id, score: 30 }, { user: joueur._id }]
    });
    const res = await sendScore(game.id, joueur.id, joueur, { score: 50 });
    assert.equal(res.status, 200);
    assert.equal(res.body.rank, 1);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.status, 'finished');
    assert.equal(inDb.participations[0].rank, 2);
    assert.equal(inDb.participations[1].rank, 1);
  });

  it('401 : sans token', async () => {
    const game = await playingGame();
    const res = await supertest(app)
      .patch(`/api/games/${game.id}/participations/${joueur.id}`)
      .send({ score: 50 });
    assert.equal(res.status, 401);
  });

  it("403 : un joueur ne peut pas envoyer le score d'un autre", async () => {
    const game = await playingGame();
    const res = await sendScore(game.id, hote.id, joueur, { score: 50 });
    assert.equal(res.status, 403);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations[0].score, null);
  });

  it('404 : partie inconnue', async () => {
    const res = await sendScore(
      new mongoose.Types.ObjectId(),
      joueur.id,
      joueur,
      { score: 50 }
    );
    assert.equal(res.status, 404);
  });

  it("404 : le joueur n'est pas inscrit à la partie", async () => {
    const game = await playingGame();
    const res = await sendScore(game.id, autre.id, autre, { score: 50 });
    assert.equal(res.status, 404);
  });

  it("409 : la partie n'est pas en cours", async () => {
    const game = await playingGame({ status: 'waiting' });
    const res = await sendScore(game.id, joueur.id, joueur, { score: 50 });
    assert.equal(res.status, 409);
  });

  it('409 : le score a déjà été envoyé', async () => {
    const game = await playingGame({
      participations: [{ user: hote._id }, { user: joueur._id, score: 20 }]
    });
    const res = await sendScore(game.id, joueur.id, joueur, { score: 50 });
    assert.equal(res.status, 409);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations[1].score, 20);
  });

  it('422 : score manquant', async () => {
    const game = await playingGame();
    const res = await sendScore(game.id, joueur.id, joueur, {});
    assert.equal(res.status, 422);
  });

  it('422 : score négatif', async () => {
    const game = await playingGame();
    const res = await sendScore(game.id, joueur.id, joueur, { score: -5 });
    assert.equal(res.status, 422);
  });

  it('422 : score à virgule', async () => {
    const game = await playingGame();
    const res = await sendScore(game.id, joueur.id, joueur, { score: 12.5 });
    assert.equal(res.status, 422);
  });
});
