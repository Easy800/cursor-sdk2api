import { describe, expect, test } from "vitest";
import { credentialFingerprint } from "../../src/digest.js";

describe("credential fingerprints", () => {
  test("are deterministic without exposing the credential", () => {
    const secret = "cursor-test-credential-alpha";
    const fingerprint = credentialFingerprint(secret);

    expect(fingerprint).toBe(credentialFingerprint(secret));
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain(secret);
  });

  test("separate credentials produce separate fingerprints", () => {
    expect(credentialFingerprint("cursor-test-credential-alpha")).not.toBe(
      credentialFingerprint("cursor-test-credential-beta"),
    );
  });
});
