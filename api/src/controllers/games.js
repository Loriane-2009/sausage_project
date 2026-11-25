import GameMap from '../models/GameMap.js';
import Game from '../models/game.js';
import { generateInvitationCode } from '../lib/invitationCode.js';

// Un identifiant MongoDB = 24 caractères hexadécimaux
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MAX_ATTEMPTS = 5;

// POST /api/games — créer une partie
export async function createGame(req, res) {
  const { mapId, maxPlayers } = req.body ?? {};

  if (typeof mapId !== 'string' || !OBJECT_ID.test(mapId)) {
    return res.status(422).send({
      message: 'mapId est obligatoire et doit être un identifiant valide'
    });
  }
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
    return res
      .status(422)
      .send({ message: 'maxPlayers doit être un entier entre 2 et 4' });
  }

  // La map doit exister
  const map = await GameMap.findById(mapId).exec();
  if (!map) {
    return res.status(404).send({ message: "La map n'existe pas" });
  }

  // L'hôte est l'utilisateur connecté, jamais une valeur envoyée par le client
  const hostId = req.currentUser._id;

  // Le code d'invitation doit être unique : en cas de collision (très rare),
  // on en génère un autre.
  let game = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && !game; attempt++) {
    try {
      game = await Game.create({
        map: map._id,
        host: hostId,
        invitationCode: generateInvitationCode(),
        maxPlayers,
        participations: [{ user: hostId }]
      });
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
  if (!game) {
    throw new Error("Impossible de générer un code d'invitation unique");
  }

  res.status(201).location(`/api/games/${game._id}`).send(game);
}
