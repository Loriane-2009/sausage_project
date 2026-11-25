import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import supertest from 'supertest';
import app from '../src/app.js';
import Game from '../src/models/game.js';
import GameMap from '../src/models/GameMap.js';
import { cleanUpDatabase, createUser, generateToken } from './utils.js';

describe('Maps', () => {
  let adminToken;
  let userToken;
  let admin;

  const validMap = {
    name: 'Prairie',
    difficulty: 'easy',
    obstacles: [
      { x: 1, y: 1 },
      { x: 2, y: 2 }
    ]
  };

  before(() => GameMap.init());
  after(() => mongoose.disconnect());

  beforeEach(async () => {
    await cleanUpDatabase();
    admin = await createUser({
      username: 'admin2',
      email: 'admin2@test.ch',
      role: 'admin'
    });
    const user = await createUser({
      username: 'joueuse',
      email: 'joueuse@test.ch'
    });
    adminToken = await generateToken(admin);
    userToken = await generateToken(user);
  });

  const auth = token => ({ Authorization: `Bearer ${token}` });

  // Une partie qui utilise la map (pour tester les 409)
  const useMapInGame = map =>
    Game.create({
      map: map._id,
      host: admin._id,
      invitationCode: 'ABC234',
      maxPlayers: 2,
      participations: [{ user: admin._id }]
    });

  describe('POST /api/maps', () => {
    const post = (token, body) =>
      supertest(app).post('/api/maps').set(auth(token)).send(body);

    test('201 : un admin crée une map', async () => {
      const res = await post(adminToken, validMap);
      assert.equal(res.status, 201);
      assert.equal(res.headers.location, `/api/maps/${res.body.id}`);
      assert.equal(res.body.difficulty, 'easy');
      assert.equal(res.body.obstacles.length, 2);
      assert.notEqual(await GameMap.findById(res.body.id), null);
    });

    test('401 : sans token', async () => {
      const res = await supertest(app).post('/api/maps').send(validMap);
      assert.equal(res.status, 401);
    });

    test("403 : un utilisateur qui n'est pas admin", async () => {
      const res = await post(userToken, validMap);
      assert.equal(res.status, 403);
    });

    test('422 : mauvais nombre d’obstacles pour la difficulté', async () => {
      const res = await post(adminToken, { ...validMap, difficulty: 'hard' });
      assert.equal(res.status, 422);
    });

    test('422 : obstacle hors de la grille', async () => {
      const res = await post(adminToken, {
        ...validMap,
        obstacles: [
          { x: 1, y: 1 },
          { x: 99, y: 2 }
        ]
      });
      assert.equal(res.status, 422);
    });

    test('422 : obstacles en doublon', async () => {
      const res = await post(adminToken, {
        ...validMap,
        obstacles: [
          { x: 1, y: 1 },
          { x: 1, y: 1 }
        ]
      });
      assert.equal(res.status, 422);
    });

    test('422 : difficulté inconnue', async () => {
      const res = await post(adminToken, {
        ...validMap,
        difficulty: 'nimporte'
      });
      assert.equal(res.status, 422);
    });

    test('422 : body vide', async () => {
      const res = await post(adminToken, {});
      assert.equal(res.status, 422);
    });
  });

  describe('GET /api/maps', () => {
    const list = (token, query = '') =>
      supertest(app).get(`/api/maps${query}`).set(auth(token));

    test('200 : un utilisateur connecté liste les maps', async () => {
      await GameMap.create(validMap);
      const res = await list(userToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.total, 1);
      assert.equal(res.body.data[0].name, 'Prairie');
    });

    test('200 : filtre par difficulté', async () => {
      await GameMap.create(validMap);
      await GameMap.create({
        name: 'Forêt',
        difficulty: 'medium',
        obstacles: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
          { x: 4, y: 4 }
        ]
      });
      const res = await list(userToken, '?difficulty=medium');
      assert.equal(res.status, 200);
      assert.equal(res.body.total, 1);
      assert.equal(res.body.data[0].name, 'Forêt');
    });

    test('200 : pagination', async () => {
      await GameMap.create({ ...validMap, name: 'Map 1' });
      await GameMap.create({ ...validMap, name: 'Map 2' });
      await GameMap.create({ ...validMap, name: 'Map 3' });
      const res = await list(userToken, '?page=2&pageSize=2');
      assert.equal(res.status, 200);
      assert.equal(res.body.page, 2);
      assert.equal(res.body.pageSize, 2);
      assert.equal(res.body.total, 3);
      assert.equal(res.body.data.length, 1);
    });

    test('401 : sans token', async () => {
      const res = await supertest(app).get('/api/maps');
      assert.equal(res.status, 401);
    });

    test('422 : difficulté inconnue', async () => {
      const res = await list(userToken, '?difficulty=nimporte');
      assert.equal(res.status, 422);
    });

    test('422 : page invalide', async () => {
      const res = await list(userToken, '?page=0');
      assert.equal(res.status, 422);
    });
  });

  describe('GET /api/maps/:id', () => {
    test('200 : renvoie la map avec ses obstacles', async () => {
      const map = await GameMap.create(validMap);
      const res = await supertest(app)
        .get(`/api/maps/${map.id}`)
        .set(auth(userToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.id, map.id);
      assert.equal(res.body.obstacles.length, 2);
    });

    test('401 : sans token', async () => {
      const map = await GameMap.create(validMap);
      const res = await supertest(app).get(`/api/maps/${map.id}`);
      assert.equal(res.status, 401);
    });

    test('404 : map inconnue', async () => {
      const res = await supertest(app)
        .get(`/api/maps/${new mongoose.Types.ObjectId()}`)
        .set(auth(userToken));
      assert.equal(res.status, 404);
    });

    test('404 : id mal formé', async () => {
      const res = await supertest(app)
        .get('/api/maps/pas-un-id')
        .set(auth(userToken));
      assert.equal(res.status, 404);
    });
  });

  describe('PATCH /api/maps/:id', () => {
    const patch = (id, token, body) =>
      supertest(app).patch(`/api/maps/${id}`).set(auth(token)).send(body);

    test('200 : un admin modifie les obstacles', async () => {
      const map = await GameMap.create(validMap);
      const obstacles = [
        { x: 5, y: 5 },
        { x: 6, y: 6 }
      ];
      const res = await patch(map.id, adminToken, { obstacles });
      assert.equal(res.status, 200);
      assert.equal(res.body.obstacles[0].x, 5);
      const inDb = await GameMap.findById(map.id);
      assert.equal(inDb.obstacles[0].x, 5);
    });

    test('401 : sans token', async () => {
      const map = await GameMap.create(validMap);
      const res = await supertest(app)
        .patch(`/api/maps/${map.id}`)
        .send({ name: 'Nouveau nom' });
      assert.equal(res.status, 401);
    });

    test("403 : un utilisateur qui n'est pas admin", async () => {
      const map = await GameMap.create(validMap);
      const res = await patch(map.id, userToken, { name: 'Nouveau nom' });
      assert.equal(res.status, 403);
    });

    test('404 : map inconnue', async () => {
      const res = await patch(new mongoose.Types.ObjectId(), adminToken, {
        name: 'Nouveau nom'
      });
      assert.equal(res.status, 404);
    });

    test('409 : la map est déjà utilisée par une partie', async () => {
      const map = await GameMap.create(validMap);
      await useMapInGame(map);
      const res = await patch(map.id, adminToken, { name: 'Nouveau nom' });
      assert.equal(res.status, 409);
    });

    test('422 : body sans champ à modifier', async () => {
      const map = await GameMap.create(validMap);
      const res = await patch(map.id, adminToken, {});
      assert.equal(res.status, 422);
    });

    test('422 : obstacles invalides', async () => {
      const map = await GameMap.create(validMap);
      const res = await patch(map.id, adminToken, {
        obstacles: [{ x: 1, y: 1 }]
      });
      assert.equal(res.status, 422);
    });
  });

  describe('DELETE /api/maps/:id', () => {
    const remove = (id, token) =>
      supertest(app).delete(`/api/maps/${id}`).set(auth(token));

    test('204 : un admin supprime une map', async () => {
      const map = await GameMap.create(validMap);
      const res = await remove(map.id, adminToken);
      assert.equal(res.status, 204);
      assert.equal(await GameMap.findById(map.id), null);
    });

    test('401 : sans token', async () => {
      const map = await GameMap.create(validMap);
      const res = await supertest(app).delete(`/api/maps/${map.id}`);
      assert.equal(res.status, 401);
    });

    test("403 : un utilisateur qui n'est pas admin", async () => {
      const map = await GameMap.create(validMap);
      const res = await remove(map.id, userToken);
      assert.equal(res.status, 403);
      assert.notEqual(await GameMap.findById(map.id), null);
    });

    test('404 : map inconnue', async () => {
      const res = await remove(new mongoose.Types.ObjectId(), adminToken);
      assert.equal(res.status, 404);
    });

    test('409 : la map est déjà utilisée par une partie', async () => {
      const map = await GameMap.create(validMap);
      await useMapInGame(map);
      const res = await remove(map.id, adminToken);
      assert.equal(res.status, 409);
      assert.notEqual(await GameMap.findById(map.id), null);
    });
  });
});
