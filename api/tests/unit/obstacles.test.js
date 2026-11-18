import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateObstacles } from "../../src/lib/obstacles.js";
import { GRID_SIZE } from "../../src/constant.js";

describe("validateObstacles", () => {
  it("accepte des obstacles valides", () => {
    assert.doesNotThrow(() =>
      validateObstacles(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        "easy",
      ),
    );
  });

  it("refuse un nombre incorrect d’obstacles", () => {
    assert.throws(
      () => validateObstacles([{ x: 0, y: 0 }], "easy"),
      /exactement 2 obstacles/,
    );
  });

  it("refuse un obstacle hors de la grille", () => {
    assert.throws(
      () =>
        validateObstacles(
          [
            { x: 0, y: 0 },
            { x: GRID_SIZE, y: 1 },
          ],
          "easy",
        ),
      /en dehors de la grille/,
    );
  });

  it("refuse des obstacles en double", () => {
    assert.throws(
      () =>
        validateObstacles(
          [
            { x: 3, y: 3 },
            { x: 3, y: 3 },
          ],
          "easy",
        ),
      /en double/,
    );
  });

  it("refuse une difficulté inconnue", () => {
    assert.throws(
      () => validateObstacles([], "impossible"),
      /Difficulté inconnue/,
    );
  });
});
