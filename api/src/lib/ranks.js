/**
 * Le meilleur score est 1er, les égalités ont le même rang (50, 50, 30 → 1, 1, 3).
 * @param {Array<{ user: string, score: number }>} participations
 * @returns {Array} les participations avec un champ `rank` en plus
 */
export function computeRanks(participations) {
  return participations.map(participation => {
    const betterPlayers = participations.filter(
      other => other.score > participation.score
    );
    return { ...participation, rank: betterPlayers.length + 1 };
  });
}
