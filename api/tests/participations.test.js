import { describe, it } from 'node:test';

describe('POST /api/games/:id/participations', () => {
  it.todo(
    'ajoute le joueur connecté à une partie en waiting avec le bon code (201)'
  );
  it.todo('refuse sans token (401)');
  it.todo("refuse un code d'invitation incorrect (403)");
  it.todo('refuse une partie inexistante (404)');
  it.todo('refuse une partie pleine (409)');
  it.todo('refuse une partie déjà lancée (409)');
  it.todo('refuse un joueur déjà inscrit (409)');
});

describe('DELETE /api/games/:id/participations/:userId', () => {
  it.todo('permet à un joueur de quitter la partie (204)');
  it.todo("permet à l'hôte d'exclure un joueur (204)");
  it.todo("supprime la partie quand l'hôte la quitte (204)");
  it.todo('refuse sans token (401)');
  it.todo("refuse qu'un joueur exclue quelqu'un d'autre (403)");
  it.todo('refuse une partie ou une participation inexistante (404)');
  it.todo("refuse si la partie n'est plus en waiting (409)");
});

describe('PATCH /api/games/:id/participations/:userId', () => {
  it.todo('enregistre le score du joueur connecté (200)');
  it.todo(
    'passe la partie en finished et calcule les rangs au dernier score (200)'
  );
  it.todo('refuse sans token (401)');
  it.todo("refuse d'enregistrer le score d'un autre joueur (403)");
  it.todo('refuse une partie ou une participation inexistante (404)');
  it.todo("refuse si la partie n'est pas en playing (409)");
  it.todo('refuse un score déjà envoyé (409)');
  it.todo('refuse un score manquant (422)');
  it.todo('refuse un score négatif ou non entier (422)');
});
