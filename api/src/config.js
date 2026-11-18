// Configuration centrale de l'API.
// Les variables d'environnement sont lues ici, et nulle part ailleurs.

export const port = process.env.PORT ?? 3000;

export const databaseUrl =
  process.env.DATABASE_URL ?? 'mongodb://127.0.0.1/sausage';

// Secret qui signe les JWT : obligatoire, l'API refuse de démarrer sans lui
export const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('La variable JWT_SECRET est manquante (voir .env.example)');
}

// Durée de validité d'un token
export const jwtExpiresIn = '7d';