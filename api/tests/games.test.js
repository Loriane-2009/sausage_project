// Tests de POST /api/games (création d'une partie).
//
// Ligne du tableau des routes :
// POST /api/games | Crée une partie | connecté | mapId, maxPlayers
// | 201, 401, 404, 422 | l'hôte est l'utilisateur connecté, statut waiting

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

import mongoose from "mongoose";
import supertest from "supertest";

import app from "../src/app.js";
import Game from "../src/models/game.js";
import GameMap from "../src/models/GameMap.js";
import { cleanUpDatabase, createUser, generateToken } from "./utils.js";

// Attend que MongoDB ait créé l'index « unique » du code d'invitation.
before(() => Game.init());
beforeEach(cleanUpDatabase);
after(() => mongoose.disconnect());

describe("POST /api/games", () => {
  let user;
  let token;
  let map;

  // Un utilisateur connecté et une map existante, créés directement en base
  beforeEach(async () => {
    user = await createUser();
    token = generateToken(user);
    map = await GameMap.create({
      name: "Map de test",
      difficulty: "easy",
      obstacles: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    });
  });

  test("crée une partie et renvoie 201 avec un header Location", async () => {
    const res = await supertest(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ mapId: map.id, maxPlayers: 3 });

    assert.equal(res.status, 201);
    assert.match(res.headers["content-type"], /application\/json/);
    assert.ok(
      mongoose.isValidObjectId(res.body.id),
      "la réponse doit contenir un id",
    );
    assert.equal(res.headers.location, `/api/games/${res.body.id}`);
    assert.equal(res.body.status, "waiting");
    assert.equal(res.body.maxPlayers, 3);
    assert.match(res.body.invitationCode, /^[A-Z2-9]{6}$/);
    assert.equal(await Game.countDocuments().exec(), 1);
  });

  test("définit l'hôte avec l'utilisateur connecté et l'ajoute aux participations", async () => {
    const res = await supertest(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ mapId: map.id, maxPlayers: 3 });

    assert.equal(res.status, 201);
    assert.equal(res.body.host, user.id);
    assert.equal(res.body.participations.length, 1);
    assert.equal(res.body.participations[0].user, user.id);
    assert.equal(res.body.participations[0].score, null);
  });

  test("ignore un hôte envoyé par le client", async () => {
    const other = await createUser({ username: "autre" });

    const res = await supertest(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ mapId: map.id, maxPlayers: 3, host: other.id });

    assert.equal(res.status, 201);
    assert.equal(res.body.host, user.id);
  });

  test("renvoie 401 sans token", async () => {
    const res = await supertest(app)
      .post("/api/games")
      .send({ mapId: map.id, maxPlayers: 3 });

    assert.equal(res.status, 401);
    assert.equal(typeof res.body.message, "string");
    assert.equal(await Game.countDocuments().exec(), 0);
  });

  test("renvoie 404 si la map n'existe pas", async () => {
    const res = await supertest(app)
      .post("/api/games")
      .set("Authorization", `Bearer ${token}`)
      .send({ mapId: new mongoose.Types.ObjectId().toString(), maxPlayers: 3 });

    assert.equal(res.status, 404);
    assert.equal(typeof res.body.message, "string");
    assert.equal(await Game.countDocuments().exec(), 0);
  });

  // Un test par donnée invalide : chacun reste ciblé et lisible dans le rapport.
  // Chaque cas reçoit l'id de la map créée juste au-dessus.
  const invalidCases = [
    ["mapId manquant", () => ({ maxPlayers: 3 })],
    ["mapId mal formé", () => ({ mapId: "abc", maxPlayers: 3 })],
    ["maxPlayers manquant", (mapId) => ({ mapId })],
    ["maxPlayers inférieur à 2", (mapId) => ({ mapId, maxPlayers: 1 })],
    ["maxPlayers supérieur à 4", (mapId) => ({ mapId, maxPlayers: 5 })],
    ["maxPlayers non entier", (mapId) => ({ mapId, maxPlayers: 2.5 })],
    ["maxPlayers est un texte", (mapId) => ({ mapId, maxPlayers: "3" })],
  ];

  for (const [label, buildBody] of invalidCases) {
    test(`renvoie 422 si ${label}`, async () => {
      const res = await supertest(app)
        .post("/api/games")
        .set("Authorization", `Bearer ${token}`)
        .send(buildBody(map.id));

      assert.equal(res.status, 422);
      assert.equal(typeof res.body.message, "string");
      assert.equal(await Game.countDocuments().exec(), 0);
    });
  }
});
