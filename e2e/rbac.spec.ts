import { test, expect } from "@playwright/test";
import { login, createSecret, USERS } from "./helpers";

test.describe("auth & RBAC boundaries", () => {
  test("an anonymous visitor is redirected from the dashboard to login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a signed-in non-admin cannot reach the admin panel", async ({
    page,
  }) => {
    await login(page, USERS.bob);
    await page.goto("/admin");
    // Middleware bounces non-admins back to their dashboard.
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("an admin can reach the admin panel", async ({ page }) => {
    await login(page, USERS.admin);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(
      page.getByRole("heading", { name: "System health" }),
    ).toBeVisible();
  });

  test("user A cannot read user B's audit log", async ({ browser }) => {
    // Alice creates a secret (owned by her) and it gets opened once.
    const aliceCtx = await browser.newContext();
    const alicePage = await aliceCtx.newPage();
    await login(alicePage, USERS.alice);
    const { id } = await createSecret(alicePage.request, "alice-only");
    await alicePage.request.post(`/api/secrets/${id}/reveal`);

    // Alice can see her own audit log.
    const ownResp = await alicePage.goto(`/dashboard/secrets/${id}`);
    expect(ownResp?.status()).toBe(200);
    await expect(
      alicePage.getByRole("heading", { name: "Audit log" }),
    ).toBeVisible();

    // Bob cannot — the ownership check turns it into a 404, never her data.
    const bobCtx = await browser.newContext();
    const bobPage = await bobCtx.newPage();
    await login(bobPage, USERS.bob);
    const bobResp = await bobPage.goto(`/dashboard/secrets/${id}`);
    expect(bobResp?.status()).toBe(404);

    await aliceCtx.close();
    await bobCtx.close();
  });
});
