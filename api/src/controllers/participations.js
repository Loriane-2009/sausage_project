import createError from 'http-errors';

import { computeRanks } from '../lib/ranks.js';
import Game from '../models/game.js';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

async function findGame(id) {
  if (!OBJECT_ID.test(id)) {
    throw createError(404, 'Partie introuvable');
  }
  const game = await Game.findById(id);
  if (!game) {
    throw createError(404, 'Partie introuvable');
  }
  return game;
}

export async function joinGame(req, res) {
  const game = await findGame(req.params.id);
  const { invitationCode } = req.body ?? {};
  const userId = req.currentUser._id;

  if (
    typeof invitationCode !== 'string' ||
    invitationCode.toUpperCase() !== game.invitationCode
  ) {
    throw createError(403, "Code d'invitation incorrect");
  }
  if (game.status !== 'waiting') {
    throw createError(409, 'La partie a déjà été lancée');
  }
  if (game.participations.some(p => p.user.equals(userId))) {
    throw createError(409, 'Tu participes déjà à cette partie');
  }
  if (game.participations.length >= game.maxPlayers) {
    throw createError(409, 'La partie est pleine');
  }

  game.participations.push({ user: userId });
  await game.save();

  res
    .status(201)
    .location(`/api/games/${game.id}/participations/${userId}`)
    .send(game.participations.at(-1));
}

export async function leaveGame(req, res) {
  const game = await findGame(req.params.id);
  const { userId } = req.params;
  const currentUserId = req.currentUser._id.toString();
  const hostId = game.host.toString();

  if (currentUserId !== userId && currentUserId !== hostId) {
    throw createError(403, 'Tu ne peux pas retirer ce joueur');
  }

  const index = game.participations.findIndex(
    p => p.user.toString() === userId
  );
  if (index === -1) {
    throw createError(404, 'Participation introuvable');
  }
  if (game.status !== 'waiting') {
    throw createError(409, 'La partie a déjà été lancée');
  }

  if (userId === hostId) {
    await game.deleteOne();
  } else {
    game.participations.splice(index, 1);
    await game.save();
  }

  res.status(204).send();
}

export async function submitScore(req, res) {
  const game = await findGame(req.params.id);
  const { userId } = req.params;
  const { score } = req.body ?? {};

  if (req.currentUser._id.toString() !== userId) {
    throw createError(403, 'Tu ne peux envoyer que ton propre score');
  }
  if (!Number.isInteger(score) || score < 0) {
    throw createError(422, 'Le score doit être un entier positif ou nul');
  }

  const participation = game.participations.find(
    p => p.user.toString() === userId
  );
  if (!participation) {
    throw createError(404, 'Participation introuvable');
  }
  if (game.status !== 'playing') {
    throw createError(409, "La partie n'est pas en cours");
  }
  if (participation.score !== null) {
    throw createError(409, 'Tu as déjà envoyé ton score');
  }

  const updated = await Game.findOneAndUpdate(
    {
      _id: game._id,
      status: 'playing',
      participations: { $elemMatch: { user: participation.user, score: null } }
    },
    { $set: { 'participations.$.score': score } },
    { new: true }
  );
  if (!updated) {
    throw createError(409, 'Tu as déjà envoyé ton score');
  }

  if (updated.participations.every(p => p.score !== null)) {
    const ranked = computeRanks(updated.participations.map(p => p.toObject()));
    updated.participations.forEach((p, i) => {
      p.rank = ranked[i].rank;
    });
    updated.status = 'finished';
    await updated.save();
  }

  res.send(updated.participations.find(p => p.user.toString() === userId));
}
