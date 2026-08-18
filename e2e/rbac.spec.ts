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
    await login(page, USERS.user1);
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
    // User One creates a secret (owned by them) and it gets opened once.
    const user1Ctx = await browser.newContext();
    const user1Page = await user1Ctx.newPage();
    await login(user1Page, USERS.user1);
    const { id } = await createSecret(user1Page.request, "user1-only");
    await user1Page.request.post(`/api/secrets/${id}/reveal`);

    // User One can see their own audit log.
    const ownResp = await user1Page.goto(`/dashboard/secrets/${id}`);
    expect(ownResp?.status()).toBe(200);
    await expect(
      user1Page.getByRole("heading", { name: "Audit log" }),
    ).toBeVisible();

    // User Two cannot — the ownership check turns it into a 404, never their data.
    const user2Ctx = await browser.newContext();
    const user2Page = await user2Ctx.newPage();
    await login(user2Page, USERS.user2);
    const user2Resp = await user2Page.goto(`/dashboard/secrets/${id}`);
    expect(user2Resp?.status()).toBe(404);

    await user1Ctx.close();
    await user2Ctx.close();
  });
});
