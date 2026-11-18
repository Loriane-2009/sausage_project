import { GRID_SIZE, OBSTACLES_BY_DIFFICULTY } from "../constant.js";

// Lance une erreur si les obstacles sont invalides, ne fait rien sinon
export function validateObstacles(obstacles, difficulty) {
  if (!Object.hasOwn(OBSTACLES_BY_DIFFICULTY, difficulty)) {
    throw new Error(`Difficulté inconnue : ${difficulty}`);
  }
  const expected = OBSTACLES_BY_DIFFICULTY[difficulty];

  // 1. Le bon nombre d'obstacles
  if (!Array.isArray(obstacles) || obstacles.length !== expected) {
    throw new Error(
      `La difficulté ${difficulty} exige exactement ${expected} obstacles`,
    );
  }

  // 2. Tous dans la grille
  for (const { x, y } of obstacles) {
    const inGrid =
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < GRID_SIZE &&
      y >= 0 &&
      y < GRID_SIZE;
    if (!inGrid) {
      throw new Error(
        `L'obstacle (${x}, ${y}) est en dehors de la grille ${GRID_SIZE}x${GRID_SIZE}`,
      );
    }
  }

  // 3. Aucun en double
  const seen = new Set();
  for (const { x, y } of obstacles) {
    const key = `${x},${y}`;
    if (seen.has(key)) {
      throw new Error(`Obstacle en double en (${x}, ${y})`);
    }
    seen.add(key);
  }
}
