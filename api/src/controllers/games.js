import GameMap from "../models/GameMap.js";
import Game from "../models/game.js";
import { generateInvitationCode } from "../lib/invitationCode.js";
import createError from "http-errors";

// Un identifiant MongoDB = 24 caractères hexadécimaux
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const MAX_ATTEMPTS = 5;

// POST /api/games — créer une partie
export async function createGame(req, res) {
  const { mapId, maxPlayers } = req.body ?? {};

  if (typeof mapId !== "string" || !OBJECT_ID.test(mapId)) {
    return res.status(422).send({
      message: "mapId est obligatoire et doit être un identifiant valide",
    });
  }
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 4) {
    return res
      .status(422)
      .send({ message: "maxPlayers doit être un entier entre 2 et 4" });
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
        participations: [{ user: hostId }],
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
export async function getGame(req, res) {
  const { id } = req.params;

  // Un id mal formé = une partie qui n'existe pas
  if (!OBJECT_ID.test(id)) {
    throw createError(404, "Partie introuvable");
  }

  // ?include=map permet de récupérer la map complète au lieu de son id
  let query = Game.findById(id);
  if (req.query.include === "map") {
    query = query.populate("map");
  }
  const game = await query;

  if (!game) {
    throw createError(404, "Partie introuvable");
  }

  // Seuls les participants et les admins peuvent voir la partie
  const isParticipant = game.participations.some((p) =>
    p.user.equals(req.currentUser._id),
  );
  if (!isParticipant && req.currentUser.role !== "admin") {
    throw createError(403, "Tu n'as pas accès à cette partie");
  }

  res.send(game);
}
export async function updateGame(req, res) {
  const { id } = req.params;

  if (!OBJECT_ID.test(id)) {
    throw createError(404, "Partie introuvable");
  }

  const game = await Game.findById(id);
  if (!game) {
    throw createError(404, "Partie introuvable");
  }

  // Seul l'hôte peut changer le statut
  if (!game.host.equals(req.currentUser._id)) {
    throw createError(403, "Seul l'hôte peut lancer la partie");
  }

  // Le seul changement autorisé : passer à "playing"
  if (req.body?.status !== "playing") {
    throw createError(422, 'Le statut doit être "playing"');
  }

  // On ne peut lancer qu'une partie en attente
  if (game.status !== "waiting") {
    throw createError(409, "La partie a déjà été lancée");
  }

  game.status = "playing";
  await game.save();

  res.send(game);
}
export async function deleteGame(req, res) {
  const { id } = req.params;

  if (!OBJECT_ID.test(id)) {
    throw createError(404, "Partie introuvable");
  }

  const game = await Game.findById(id);
  if (!game) {
    throw createError(404, "Partie introuvable");
  }

  const isHost = game.host.equals(req.currentUser._id);
  const isAdmin = req.currentUser.role === "admin";

  // Seuls l'hôte et les admins peuvent supprimer
  if (!isHost && !isAdmin) {
    throw createError(403, "Tu ne peux pas supprimer cette partie");
  }

  // Un hôte ne peut supprimer qu'une partie encore en attente
  if (!isAdmin && game.status !== "waiting") {
    throw createError(409, "Impossible de supprimer une partie déjà lancée");
  }

  await game.deleteOne();

  res.status(204).send();
}
const MAX_PAGE_SIZE = 50;

// Lit un entier positif dans l'URL. Renvoie null si la valeur est invalide.
function parsePositiveInt(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  return Number(value);
}

export async function listGames(req, res) {
  const { userId, invitationCode, status } = req.query;

  const page = parsePositiveInt(req.query.page, 1);
  const pageSize = parsePositiveInt(req.query.pageSize, 10);
  if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
    throw createError(
      422,
      `page et pageSize doivent être des entiers positifs (pageSize max ${MAX_PAGE_SIZE})`,
    );
  }

  // Recherche par code d'invitation : infos minimales, partie en attente seulement
  if (invitationCode !== undefined) {
    if (typeof invitationCode !== "string" || invitationCode === "") {
      throw createError(422, "Code d'invitation invalide");
    }
    const found = await Game.find({
      invitationCode: invitationCode.toUpperCase(),
      status: "waiting",
    }).populate("map");

    const data = found.map((game) => ({
      id: game.id,
      difficulty: game.map?.difficulty,
      playerCount: game.participations.length,
      maxPlayers: game.maxPlayers,
    }));
    return res.send({ page, pageSize, total: data.length, data });
  }

  const filter = {};

  if (status !== undefined) {
    const allowed = Game.schema.path("status").enumValues;
    if (typeof status !== "string" || !allowed.includes(status)) {
      throw createError(422, `Statut invalide (${allowed.join(", ")})`);
    }
    filter.status = status;
  }

  const isAdmin = req.currentUser.role === "admin";
  let targetUserId;
  if (userId !== undefined) {
    if (typeof userId !== "string" || !OBJECT_ID.test(userId)) {
      throw createError(422, "userId invalide");
    }
    // On ne peut voir que son propre historique, sauf si on est admin
    if (!isAdmin && userId !== req.currentUser.id) {
      throw createError(403, "Tu ne peux voir que tes propres parties");
    }
    targetUserId = userId;
  } else if (!isAdmin) {
    // Sans filtre, un utilisateur normal voit seulement ses parties
    targetUserId = req.currentUser.id;
  }
  if (targetUserId) {
    filter["participations.user"] = targetUserId;
  }

  const [data, total] = await Promise.all([
    Game.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Game.countDocuments(filter),
  ]);

  res.send({ page, pageSize, total, data });
}
