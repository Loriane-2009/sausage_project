import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Game from "../../src/models/game.js";

// Données valides de départ, modifiées dans chaque test
function validGame(overrides = {}) {
  return {
    map: new mongoose.Types.ObjectId(),
    host: new mongoose.Types.ObjectId(),
    invitationCode: "K7P2QX",
    maxPlayers: 4,
    ...overrides,
  };
}

// Vérifie que la validation échoue sur le champ donné
async function assertInvalid(data, field) {
  await assert.rejects(new Game(data).validate(), (err) => {
    assert.equal(err.name, "ValidationError");
    assert.ok(err.errors[field], `une erreur est attendue sur ${field}`);
    return true;
  });
}

describe("Modèle Game", () => {
  it("accepte une partie valide et met le statut waiting par défaut", async () => {
    const game = new Game(validGame());
    await assert.doesNotReject(game.validate());
    assert.equal(game.status, "waiting");
    assert.equal(game.participations.length, 0);
  });

  it("refuse une partie sans hôte", async () => {
    await assertInvalid(validGame({ host: undefined }), "host");
  });

  it("refuse une partie sans map", async () => {
    await assertInvalid(validGame({ map: undefined }), "map");
  });

  it("refuse une partie sans code d’invitation", async () => {
    await assertInvalid(
      validGame({ invitationCode: undefined }),
      "invitationCode",
    );
  });

  it("refuse un statut inconnu", async () => {
    await assertInvalid(validGame({ status: "cancelled" }), "status");
  });

  it("refuse moins de 2 joueurs", async () => {
    await assertInvalid(validGame({ maxPlayers: 1 }), "maxPlayers");
  });

  it("refuse plus de 4 joueurs", async () => {
    await assertInvalid(validGame({ maxPlayers: 5 }), "maxPlayers");
  });

  it("refuse un score négatif dans une participation", async () => {
    const data = validGame({
      participations: [{ user: new mongoose.Types.ObjectId(), score: -1 }],
    });
    await assertInvalid(data, "participations.0.score");
  });
});
