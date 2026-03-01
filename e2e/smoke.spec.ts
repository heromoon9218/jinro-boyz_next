import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("home page displays title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("人狼BOYZ")).toBeVisible();
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL("/login");
  });

  test("signup page is accessible", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL("/signup");
  });

  test("unauthenticated user is redirected from /villages to /login", async ({
    page,
  }) => {
    await page.goto("/villages");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user is redirected from /profile to /login", async ({
    page,
  }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });
});
