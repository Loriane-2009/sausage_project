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
  let host;
  let player;
  let playerToken;

  beforeEach(async () => {
    host = await createUser({ username: 'hote', email: 'hote@test.ch' });
    player = await createUser({ username: 'joueur', email: 'joueur@test.ch' });
    playerToken = generateToken(player);
  });

  const join = (gameId, token, body) =>
    supertest(app)
      .post(`/api/games/${gameId}/participations`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('ajoute le joueur connecté à une partie en waiting avec le bon code (201)', async () => {
    const game = await createGame(host);
    const res = await join(game.id, playerToken, { invitationCode: 'ABC234' });

    assert.equal(res.status, 201);
    assert.equal(
      res.headers.location,
      `/api/games/${game.id}/participations/${player.id}`
    );
    assert.deepEqual(res.body, { user: player.id, score: null, rank: null });

    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 2);
    assert.ok(inDb.participations[1].user.equals(player._id));
  });

  it('refuse sans token (401)', async () => {
    const game = await createGame(host);
    const res = await supertest(app)
      .post(`/api/games/${game.id}/participations`)
      .send({ invitationCode: 'ABC234' });

    assert.equal(res.status, 401);
  });

  it("refuse un code d'invitation incorrect (403)", async () => {
    const game = await createGame(host);
    const res = await join(game.id, playerToken, { invitationCode: 'ZZZ999' });

    assert.equal(res.status, 403);
    const inDb = await Game.findById(game.id);
    assert.equal(inDb.participations.length, 1);
  });

  it('refuse une partie inexistante (404)', async () => {
    const res = await join(new mongoose.Types.ObjectId(), playerToken, {
      invitationCode: 'ABC234'
    });

    assert.equal(res.status, 404);
  });

  it('refuse une partie pleine (409)', async () => {
    const other = await createUser({
      username: 'autre',
      email: 'autre@test.ch'
    });
    const game = await createGame(host, {
      maxPlayers: 2,
      participations: [{ user: host._id }, { user: other._id }]
    });
    const res = await join(game.id, playerToken, { invitationCode: 'ABC234' });

    assert.equal(res.status, 409);
  });

  it('refuse une partie déjà lancée (409)', async () => {
    const game = await createGame(host, { status: 'playing' });
    const res = await join(game.id, playerToken, { invitationCode: 'ABC234' });

    assert.equal(res.status, 409);
  });

  it('refuse un joueur déjà inscrit (409)', async () => {
    const game = await createGame(host);
    const res = await join(game.id, generateToken(host), {
      invitationCode: 'ABC234'
    });

    assert.equal(res.status, 409);
  });
});

describe('DELETE /api/games/:id/participations/:userId', () => {
  it.todo('permet à un joueur de quitter la partie (204)');
  it.todo("permet à l'hôte d'exclure un joueur (204)");
  it.todo("supprime la partie quand l'hôte la quitte (204)");
  it.todo('refuse sans token (401)');
  it.todo("refuse qu'un joueur exclue quelqu'un d'autre (403)");
  it.todo('refuse une partie ou une participation inexistante (404)');
  it.todo("refuse si la partie n'est plus en waiting (409)");
});

describe('PATCH /api/games/:id/participations/:userId', () => {
  it.todo('enregistre le score du joueur connecté (200)');
  it.todo(
    'passe la partie en finished et calcule les rangs au dernier score (200)'
  );
  it.todo('refuse sans token (401)');
  it.todo("refuse d'enregistrer le score d'un autre joueur (403)");
  it.todo('refuse une partie ou une participation inexistante (404)');
  it.todo("refuse si la partie n'est pas en playing (409)");
  it.todo('refuse un score déjà envoyé (409)');
  it.todo('refuse un score manquant (422)');
  it.todo('refuse un score négatif ou non entier (422)');
});
