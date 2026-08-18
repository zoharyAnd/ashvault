import { test, expect } from "@playwright/test";
import { createSecret, readSecretRow } from "./helpers";
import { openSecret } from "../src/lib/crypto";

test.describe("one-time access", () => {
  test("a link truly dies after a single read", async ({ request }) => {
    const { id, keyFragment } = await createSecret(request, "one-shot-secret");

    // Status check does NOT consume the view.
    const status1 = await request.get(`/api/secrets/${id}`);
    expect(status1.status()).toBe(200);
    expect((await status1.json()).status).toBe("available");

    // First reveal succeeds and decrypts back to the original plaintext.
    const reveal1 = await request.post(`/api/secrets/${id}/reveal`);
    expect(reveal1.status()).toBe(200);
    const payload = await reveal1.json();
    const plaintext = await openSecret(
      { ciphertext: payload.ciphertext, iv: payload.iv },
      keyFragment,
    );
    expect(plaintext).toBe("one-shot-secret");

    // Second reveal is gone forever.
    const reveal2 = await request.post(`/api/secrets/${id}/reveal`);
    expect(reveal2.status()).toBe(410);
    expect((await reveal2.json()).status).toBe("gone");

    // And the ciphertext has been shredded from the database.
    const row = await readSecretRow(id);
    expect(row?.ciphertext).toBeNull();
    expect(Number(row?.view_count)).toBe(1);
    expect(row?.burned_at).not.toBeNull();
  });

  test("concurrent reveals: only one wins the race", async ({ request }) => {
    const { id } = await createSecret(request, "contested-secret");

    // Fire two reveals simultaneously for the single available view.
    const [a, b] = await Promise.all([
      request.post(`/api/secrets/${id}/reveal`),
      request.post(`/api/secrets/${id}/reveal`),
    ]);

    const statuses = [a.status(), b.status()].sort();
    // Exactly one 200 (winner) and one 410 (loser) — never two winners.
    expect(statuses).toEqual([200, 410]);
  });

  test("a multi-view link allows exactly N reads", async ({ request }) => {
    const { id } = await createSecret(request, "three-times", { maxViews: 3 });

    for (let i = 0; i < 3; i++) {
      const res = await request.post(`/api/secrets/${id}/reveal`);
      expect(res.status()).toBe(200);
    }
    // The 4th read is gone.
    const overflow = await request.post(`/api/secrets/${id}/reveal`);
    expect(overflow.status()).toBe(410);
  });
});
