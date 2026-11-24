import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateInvitationCode,
  CODE_ALPHABET,
  CODE_LENGTH,
} from "../../src/lib/invitationCode.js";

describe("generateInvitationCode", () => {
  it("génère un code de 6 caractères par défaut", () => {
    assert.equal(generateInvitationCode().length, CODE_LENGTH);
  });

  it("respecte la longueur demandée", () => {
    assert.equal(generateInvitationCode(10).length, 10);
  });

  it("utilise uniquement les caractères autorisés", () => {
    for (let i = 0; i < 200; i++) {
      for (const char of generateInvitationCode()) {
        assert.ok(CODE_ALPHABET.includes(char), `caractère interdit : ${char}`);
      }
    }
  });

  it("ne contient ni 0, ni O, ni 1, ni I", () => {
    assert.doesNotMatch(CODE_ALPHABET, /[01OI]/);
  });
});
