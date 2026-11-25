import createError from 'http-errors';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Un id mal formé dans l'URL = une ressource qui n'existe pas
export function validateObjectId(req, res, next, id) {
  if (!OBJECT_ID.test(id)) {
    return next(createError(404, 'Ressource introuvable'));
  }
  next();
}
