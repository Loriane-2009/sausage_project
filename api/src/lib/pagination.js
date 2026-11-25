import createError from 'http-errors';

export const MAX_PAGE_SIZE = 50;

// Lit un entier positif dans l'URL. Renvoie null si la valeur est invalide.
function parsePositiveInt(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  return Number(value);
}

export function parsePagination(query) {
  const page = parsePositiveInt(query.page, 1);
  const pageSize = parsePositiveInt(query.pageSize, 10);
  if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
    throw createError(
      422,
      `page et pageSize doivent être des entiers positifs (pageSize max ${MAX_PAGE_SIZE})`
    );
  }
  return { page, pageSize };
}
