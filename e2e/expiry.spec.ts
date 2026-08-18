import { test, expect } from "@playwright/test";
import { createSecret, expireSecret, readSecretRow } from "./helpers";

test.describe("time-boxed expiry", () => {
  test("an expired secret can no longer be read", async ({ request }) => {
    const { id } = await createSecret(request, "will-expire", {
      ttlMinutes: 10,
    });

    // Age it past its expiry.
    await expireSecret(id);

    // Status reports it as gone (HTTP 410 Gone — it existed but is destroyed).
    const status = await request.get(`/api/secrets/${id}`);
    expect(status.status()).toBe(410);
    expect((await status.json()).status).toBe("expired");

    // Attempting to reveal it is refused, never returning ciphertext.
    const reveal = await request.post(`/api/secrets/${id}/reveal`);
    expect(reveal.status()).toBe(410);
    const body = await reveal.json();
    expect(body.ciphertext).toBeUndefined();

    // The expired ciphertext is swept (nulled) so it can't be recovered.
    const row = await readSecretRow(id);
    expect(row?.ciphertext).toBeNull();
  });

  test("a nonexistent secret is a 404", async ({ request }) => {
    const status = await request.get(`/api/secrets/does-not-exist-xyz`);
    expect(status.status()).toBe(404);

    const reveal = await request.post(`/api/secrets/does-not-exist-xyz/reveal`);
    expect(reveal.status()).toBe(404);
  });
});
