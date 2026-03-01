import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays login form with all fields", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ログイン" })
    ).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.locator('input[name="email"]').fill("invalid-email");
    await page.locator('input[name="password"]').fill("password123");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(
      page.getByText("有効なメールアドレスを入力してください")
    ).toBeVisible();
  });

  test("shows validation error for short password", async ({ page }) => {
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("short");
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(
      page.getByText("パスワードは8文字以上で入力してください")
    ).toBeVisible();
  });

  test("navigates to signup page via link", async ({ page }) => {
    await page.getByRole("link", { name: "サインアップ" }).click();
    await expect(page).toHaveURL("/signup");
  });
});

test.describe("Signup page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("displays signup form with all fields", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "サインアップ" })
    ).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(
      page.locator('input[name="confirmPassword"]')
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "アカウントを作成" })
    ).toBeVisible();
  });

  test("shows validation error for short username", async ({ page }) => {
    await page.locator('input[name="username"]').fill("a");
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('input[name="confirmPassword"]').fill("password123");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("ユーザー名は2文字以上で入力してください")
    ).toBeVisible();
  });

  test("shows validation error for invalid username characters", async ({
    page,
  }) => {
    await page.locator('input[name="username"]').fill("user name!");
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('input[name="confirmPassword"]').fill("password123");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("英数字とアンダースコアのみ使用できます")
    ).toBeVisible();
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.locator('input[name="username"]').fill("valid_user");
    await page.locator('input[name="email"]').fill("not-an-email");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('input[name="confirmPassword"]').fill("password123");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("有効なメールアドレスを入力してください")
    ).toBeVisible();
  });

  test("shows validation error for short password", async ({ page }) => {
    await page.locator('input[name="username"]').fill("valid_user");
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("short");
    await page.locator('input[name="confirmPassword"]').fill("short");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(
      page.getByText("パスワードは8文字以上で入力してください")
    ).toBeVisible();
  });

  test("shows validation error for mismatched passwords", async ({ page }) => {
    await page.locator('input[name="username"]').fill("valid_user");
    await page.locator('input[name="email"]').fill("test@example.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('input[name="confirmPassword"]').fill("different456");
    await page.getByRole("button", { name: "アカウントを作成" }).click();

    await expect(page.getByText("パスワードが一致しません")).toBeVisible();
  });

  test("navigates to login page via link", async ({ page }) => {
    await page.getByRole("link", { name: "ログイン" }).click();
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Auth redirects", () => {
  test("unauthenticated user accessing /profile is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user accessing /settings is redirected to /login", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
