import { randomInt } from "node:crypto";

// Lettres et chiffres, sans les caractères qui se ressemblent (0/O, 1/I)
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

// Génère un code d'invitation aléatoire, par exemple "K7P2QX"
export function generateInvitationCode(length = CODE_LENGTH) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}
