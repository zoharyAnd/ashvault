import { describe, it, expect } from "vitest";
import {
  sealSecret,
  openSecret,
  generateKey,
  exportKey,
  importKey,
  encrypt,
  decrypt,
  toBase64Url,
  fromBase64Url,
} from "./crypto";

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(Array.from(fromBase64Url(toBase64Url(bytes)))).toEqual(
      Array.from(bytes),
    );
  });

  it("produces URL-safe output (no +, /, or =)", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(64));
    const encoded = toBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

describe("sealSecret / openSecret (end-to-end)", () => {
  it("encrypts then decrypts back to the original plaintext", async () => {
    const message = "correct horse battery staple 🔐";
    const sealed = await sealSecret(message);

    // The sealed payload must not contain the plaintext anywhere.
    expect(sealed.ciphertext).not.toContain("horse");
    expect(sealed.ciphertext.length).toBeGreaterThan(0);

    const opened = await openSecret(
      { ciphertext: sealed.ciphertext, iv: sealed.iv },
      sealed.keyFragment,
    );
    expect(opened).toBe(message);
  });

  it("uses a unique IV per encryption (same key, different ciphertext)", async () => {
    const key = await generateKey();
    const a = await encrypt("same message", key);
    const b = await encrypt("same message", key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("fails to decrypt with the wrong key", async () => {
    const sealed = await sealSecret("top secret");
    const wrongKey = await exportKey(await generateKey());
    await expect(
      openSecret(
        { ciphertext: sealed.ciphertext, iv: sealed.iv },
        wrongKey,
      ),
    ).rejects.toBeDefined();
  });

  it("fails to decrypt if the ciphertext is tampered with (GCM auth)", async () => {
    const key = await generateKey();
    const sealed = await encrypt("integrity matters", key);
    // Flip a byte in the ciphertext.
    const bytes = fromBase64Url(sealed.ciphertext);
    bytes[0] ^= 0xff;
    const tampered = { ...sealed, ciphertext: toBase64Url(bytes) };
    await expect(decrypt(tampered, key)).rejects.toBeDefined();
  });

  it("key export/import is stable", async () => {
    const key = await generateKey();
    const fragment = await exportKey(key);
    const reimported = await importKey(fragment);
    const sealed = await encrypt("hello", key);
    expect(await decrypt(sealed, reimported)).toBe("hello");
  });
});
