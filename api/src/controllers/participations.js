import createError from 'http-errors';

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
