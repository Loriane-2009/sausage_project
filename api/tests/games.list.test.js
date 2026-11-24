import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import supertest from "supertest";
import app from "../src/app.js";
import Game from "../src/models/game.js";
import GameMap from "../src/models/GameMap.js";
import { cleanUpDatabase, createUser, generateToken } from "./utils.js";

describe("GET /api/games", () => {
  let host;
  let hostToken;
  let other;
  let counter = 0;

  before(() => Game.init());
  after(() => mongoose.disconnect());

  beforeEach(async () => {
    await cleanUpDatabase();
    host = await createUser({ username: "hote", email: "hote@test.ch" });
    hostToken = await generateToken(host);
    other = await createUser({ username: "autre", email: "autre@test.ch" });
  });

  // Crée une partie avec sa propre map et un code unique
  const makeGame = async (hostUser, overrides = {}) => {
    counter += 1;
    const map = await GameMap.create({
      name: `Map ${counter}`,
      difficulty: "easy",
      obstacles: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    return Game.create({
      map: map._id,
      host: hostUser._id,
      invitationCode: `GAME${String(counter).padStart(2, "0")}`,
      maxPlayers: 3,
      participations: [{ user: hostUser._id }],
      ...overrides,
    });
  };

  const list = (token, query = "") =>
    supertest(app)
      .get(`/api/games${query}`)
      .set("Authorization", `Bearer ${token}`);

  test("200 : sans filtre, un utilisateur voit seulement ses parties", async () => {
    const mine = await makeGame(host);
    await makeGame(other);
    const res = await list(hostToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.data[0].id, mine.id);
  });

  test("200 : sans filtre, un admin voit toutes les parties", async () => {
    await makeGame(host);
    await makeGame(other);
    const admin = await createUser({
      username: "admin2",
      email: "admin2@test.ch",
      role: "admin",
    });
    const res = await list(await generateToken(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 2);
  });

  test("200 : filtre userId sur soi-même", async () => {
    const mine = await makeGame(host);
    await makeGame(other);
    const res = await list(hostToken, `?userId=${host.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.data[0].id, mine.id);
  });

  test("200 : un admin peut filtrer sur l'historique d'un autre", async () => {
    await makeGame(host);
    const admin = await createUser({
      username: "admin2",
      email: "admin2@test.ch",
      role: "admin",
    });
    const res = await list(await generateToken(admin), `?userId=${host.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
  });

  test("200 : filtre status", async () => {
    await makeGame(host);
    const playing = await makeGame(host, { status: "playing" });
    const res = await list(hostToken, "?status=playing");
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.data[0].id, playing.id);
  });

  test("200 : pagination", async () => {
    await makeGame(host);
    await makeGame(host);
    await makeGame(host);
    const res = await list(hostToken, "?page=2&pageSize=2");
    assert.equal(res.status, 200);
    assert.equal(res.body.page, 2);
    assert.equal(res.body.pageSize, 2);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.data.length, 1);
  });

  test("200 : tri du plus récent au plus ancien", async () => {
    const old = await makeGame(host, { createdAt: new Date("2026-01-01") });
    const middle = await makeGame(host, { createdAt: new Date("2026-02-01") });
    const recent = await makeGame(host, { createdAt: new Date("2026-03-01") });
    const res = await list(hostToken);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((g) => g.id),
      [recent.id, middle.id, old.id],
    );
  });

  test("200 : recherche par code d'invitation, infos minimales", async () => {
    const game = await makeGame(host);
    const stranger = await generateToken(other);
    const res = await list(stranger, `?invitationCode=${game.invitationCode}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    const found = res.body.data[0];
    assert.equal(found.id, game.id);
    assert.equal(found.difficulty, "easy");
    assert.equal(found.playerCount, 1);
    assert.equal(found.maxPlayers, 3);
    assert.equal(found.invitationCode, undefined);
    assert.equal(found.host, undefined);
  });

  test("200 : un code d'invitation d'une partie lancée ne renvoie rien", async () => {
    const game = await makeGame(host, { status: "playing" });
    const res = await list(hostToken, `?invitationCode=${game.invitationCode}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
    assert.deepEqual(res.body.data, []);
  });

  test("401 : sans token", async () => {
    const res = await supertest(app).get("/api/games");
    assert.equal(res.status, 401);
  });

  test("403 : userId d'un autre utilisateur sans être admin", async () => {
    const res = await list(hostToken, `?userId=${other.id}`);
    assert.equal(res.status, 403);
  });

  test("422 : page invalide", async () => {
    const res = await list(hostToken, "?page=0");
    assert.equal(res.status, 422);
  });

  test("422 : pageSize trop grand", async () => {
    const res = await list(hostToken, "?pageSize=1000");
    assert.equal(res.status, 422);
  });

  test("422 : status inconnu", async () => {
    const res = await list(hostToken, "?status=nimporte");
    assert.equal(res.status, 422);
  });

  test("422 : userId mal formé", async () => {
    const res = await list(hostToken, "?userId=pas-un-id");
    assert.equal(res.status, 422);
  });
});
