import createError from 'http-errors';
import { parsePagination } from '../lib/pagination.js';
import Game from '../models/game.js';
import GameMap from '../models/GameMap.js';

const WRITABLE_FIELDS = ['name', 'difficulty', 'obstacles'];

// On ne garde que les champs autorisés (on ignore tout le reste du body)
function pickFields(body) {
  const fields = {};
  for (const key of WRITABLE_FIELDS) {
    if (body?.[key] !== undefined) {
      fields[key] = body[key];
    }
  }
  return fields;
}

// Une map déjà utilisée par une partie ne peut plus être modifiée ni supprimée
async function assertNotUsed(map) {
  if (await Game.exists({ map: map._id })) {
    throw createError(409, 'Cette map est déjà utilisée par une partie');
  }
}

async function findMapOr404(id) {
  const map = await GameMap.findById(id);
  if (!map) {
    throw createError(404, 'Map introuvable');
  }
  return map;
}

export async function createMap(req, res) {
  const map = await GameMap.create(pickFields(req.body));
  res.status(201).location(`/api/maps/${map.id}`).send(map);
}

export async function listMaps(req, res) {
  const { page, pageSize } = parsePagination(req.query);
  const filter = {};

  const { difficulty } = req.query;
  if (difficulty !== undefined) {
    const allowed = GameMap.schema.path('difficulty').enumValues;
    if (typeof difficulty !== 'string' || !allowed.includes(difficulty)) {
      throw createError(422, `Difficulté invalide (${allowed.join(', ')})`);
    }
    filter.difficulty = difficulty;
  }

  const [data, total] = await Promise.all([
    GameMap.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    GameMap.countDocuments(filter)
  ]);

  res.send({ page, pageSize, total, data });
}

export async function getMap(req, res) {
  res.send(await findMapOr404(req.params.id));
}

export async function updateMap(req, res) {
  const map = await findMapOr404(req.params.id);

  const changes = pickFields(req.body);
  if (Object.keys(changes).length === 0) {
    throw createError(422, 'Aucun champ à modifier');
  }

  await assertNotUsed(map);

  // save() déclenche la validation du modèle, dont celle des obstacles
  map.set(changes);
  await map.save();

  res.send(map);
}

export async function deleteMap(req, res) {
  const map = await findMapOr404(req.params.id);
  await assertNotUsed(map);
  await map.deleteOne();
  res.status(204).send();
}
