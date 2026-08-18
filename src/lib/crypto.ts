/**
 * Zero-knowledge encryption for AshVault.
 *
 * The whole security model of this app rests on one idea: the server must never
 * be able to read a secret. We achieve that by doing all encryption/decryption
 * with the Web Crypto API (AES-256-GCM) and keeping the key OUT of every request
 * to the server. The key rides in the URL fragment (`https://…/s/<id>#<key>`),
 * which browsers never send over the wire. The server only ever stores and
 * returns ciphertext + IV.
 *
 * This module is isomorphic: `globalThis.crypto.subtle`, `TextEncoder`,
 * `btoa`/`atob` all exist in modern browsers and in Node 18+ — so the exact same
 * code encrypts in the sender's browser and is unit-tested under Node.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_BYTES = 12; // 96-bit IV is the recommended size for GCM.

export interface SealedSecret {
  /** base64url AES-GCM ciphertext (includes the auth tag). */
  ciphertext: string;
  /** base64url initialisation vector. */
  iv: string;
}

// --- base64url helpers (URL-fragment safe, no padding) ---------------------

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array {
  let b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// --- key lifecycle ---------------------------------------------------------

/** Generate a fresh, extractable AES-256-GCM key. */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable so we can put it in the URL fragment
    ["encrypt", "decrypt"],
  );
}

/** Export a key to a base64url string suitable for a URL fragment. */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toBase64Url(new Uint8Array(raw));
}

/** Re-import a key from its base64url fragment representation. */
export async function importKey(fragment: string): Promise<CryptoKey> {
  const raw = fromBase64Url(fragment);
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: ALGORITHM }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// --- primitive encrypt / decrypt -------------------------------------------

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<SealedSecret> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv } as AesGcmParams,
    key,
    encoded as BufferSource,
  );
  return {
    ciphertext: toBase64Url(new Uint8Array(ciphertext)),
    iv: toBase64Url(iv),
  };
}

export async function decrypt(
  sealed: SealedSecret,
  key: CryptoKey,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64Url(sealed.iv) } as AesGcmParams,
    key,
    fromBase64Url(sealed.ciphertext) as BufferSource,
  );
  return new TextDecoder().decode(plaintext);
}

// --- high-level helpers used by the UI -------------------------------------

export interface SealedWithKey extends SealedSecret {
  /** base64url key fragment — belongs in the URL fragment, never in a request. */
  keyFragment: string;
}

/**
 * Encrypt `plaintext` under a brand-new key and return everything needed:
 * the ciphertext + IV (to POST to the server) and the key fragment (to append
 * to the share URL as `#<keyFragment>`).
 */
export async function sealSecret(plaintext: string): Promise<SealedWithKey> {
  const key = await generateKey();
  const sealed = await encrypt(plaintext, key);
  const keyFragment = await exportKey(key);
  return { ...sealed, keyFragment };
}

/** Decrypt a secret fetched from the server using the key from the fragment. */
export async function openSecret(
  sealed: SealedSecret,
  keyFragment: string,
): Promise<string> {
  const key = await importKey(keyFragment);
  return decrypt(sealed, key);
}
