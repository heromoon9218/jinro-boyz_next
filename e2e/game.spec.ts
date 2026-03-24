import { test, expect, type Page } from "@playwright/test";

/**
 * Seed data prerequisite (`npx prisma db seed`):
 * - "テスト村・ゲーム中" (IN_PLAY, day 2, 8 players, posts in MAIN/WOLF/DEAD)
 * - "テスト村・終了" (ENDED, HUMANS win, 5 players)
 * - "テスト村・募集中" (NOT_STARTED)
 * - Users: taro@example.com (村人), yuuki@example.com (人狼) etc. / password123
 */

// ── Helpers ──

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/villages/, { timeout: 15000 });
}

/**
 * Navigate to village list, find a village by name, click it,
 * and return the villageId extracted from the URL.
 * Pass `tab` to switch tab before searching (e.g. "終了済み").
 */
async function getVillageId(
  page: Page,
  villageName: string,
  tab?: string,
): Promise<string> {
  await page.goto("/villages");
  await expect(page.getByRole("heading", { name: "村一覧" })).toBeVisible();

  if (tab) {
    await page.getByRole("tab", { name: tab }).click();
  }

  const link = page.getByRole("link").filter({ hasText: villageName });
  await link.first().click();
  await page.waitForURL(/\/villages\/[^/]+$/);

  const match = page.url().match(/\/villages\/([^/]+)$/);
  if (!match) throw new Error(`Could not extract villageId from ${page.url()}`);
  return match[1];
}

// ── ゲーム画面遷移 ──

test.describe("ゲーム画面遷移", () => {
  test("IN_PLAY村のゲーム画面が表示される", async ({ page }) => {
    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    // Game header
    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("2日目")).toBeVisible();

    // MAIN room tab
    await expect(
      page.getByRole("button", { name: "メイン" }),
    ).toBeVisible();

    // Player list
    await expect(page.getByText("たろう").first()).toBeVisible();
  });

  test("ENDED村のゲーム画面でエピローグと勝利バッジが表示される", async ({
    page,
  }) => {
    const villageId = await getVillageId(page, "テスト村・終了", "終了済み");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・終了")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("エピローグ")).toBeVisible();
    await expect(page.getByText("村人勝利")).toBeVisible();

    // All rooms accessible after game ends
    await expect(
      page.getByRole("button", { name: "メイン" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "人狼" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "霊界" }),
    ).toBeVisible();
  });

  test("NOT_STARTED村のgameページにアクセスすると村詳細にリダイレクト", async ({
    page,
  }) => {
    const villageId = await getVillageId(page, "テスト村・募集中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page).toHaveURL(new RegExp(`/villages/${villageId}$`), {
      timeout: 10000,
    });
  });

  test("存在しない村のgameページにアクセスすると/villagesにリダイレクト", async ({
    page,
  }) => {
    await page.goto("/villages/nonexistent-village-id/game");
    await expect(page).toHaveURL(/\/villages$/, { timeout: 10000 });
  });
});

// ── チャット表示・ルーム切替 ──

test.describe("チャット表示", () => {
  test("IN_PLAY村のMAINルームにシード済みのチャットが表示される", async ({
    page,
  }) => {
    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    // Day 1 posts
    await expect(
      page.getByText("みんなよろしく！まずは自由に話そう"),
    ).toBeVisible();
    // Day 2 posts
    await expect(
      page.getByText("護衛成功したみたいだね。占い結果はどう？"),
    ).toBeVisible();
  });

  test("ENDED村でルーム切替ができる", async ({ page }) => {
    const villageId = await getVillageId(page, "テスト村・終了", "終了済み");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・終了")).toBeVisible({
      timeout: 15000,
    });

    // MAIN room content
    await expect(page.getByText("少人数だけどがんばろう！")).toBeVisible();

    // Switch to wolf room
    await page.getByRole("button", { name: "人狼" }).click();
    await expect(page.getByText("さくらを襲撃する")).toBeVisible();

    // Switch to dead room
    await page.getByRole("button", { name: "霊界" }).click();
    await expect(page.getByText("やられた〜")).toBeVisible();

    // Switch back to main
    await page.getByRole("button", { name: "メイン" }).click();
    await expect(page.getByText("少人数だけどがんばろう！")).toBeVisible();
  });

  test("未認証ユーザーにはチャット入力欄と役職バッジが表示されない", async ({
    page,
  }) => {
    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    // Wait for game data to fully load (player list renders after tRPC response)
    await expect(
      page.getByRole("button", { name: "メイン" }),
    ).toBeVisible();
    await expect(page.getByText("たろう").first()).toBeVisible();

    // No chat input for unauthenticated user
    await expect(page.locator("textarea")).not.toBeVisible();
    // No role badge
    await expect(page.getByText("あなたの役職:")).not.toBeVisible();
  });
});

// ── チャット送受信（認証済み） ──

test.describe("チャット送受信（認証済み）", () => {
  test("生存プレイヤーがMAINルームでメッセージを送信できる", async ({
    page,
  }) => {
    await login(page, "taro@example.com", "password123");

    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    // Role badge visible for participant
    await expect(page.getByText("あなたの役職:")).toBeVisible();

    // Chat input visible for alive player
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();

    // Send a message
    const testMessage = `E2Eテスト送信 ${Date.now()}`;
    await textarea.fill(testMessage);
    await page.getByRole("button", { name: "送信" }).click();

    // Message appears in chat
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 10000 });

    // Input should be cleared after send
    await expect(textarea).toHaveValue("", { timeout: 10000 });
  });

  test("送信ボタンは空メッセージ時に無効化される", async ({ page }) => {
    await login(page, "taro@example.com", "password123");

    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    const sendButton = page.getByRole("button", { name: "送信" });
    await expect(sendButton).toBeDisabled();

    // Type something → button becomes enabled
    await page.locator("textarea").fill("テスト");
    await expect(sendButton).toBeEnabled();

    // Clear → button becomes disabled again
    await page.locator("textarea").fill("");
    await expect(sendButton).toBeDisabled();
  });

  test("人狼プレイヤーには人狼ルームタブが表示される", async ({ page }) => {
    await login(page, "yuuki@example.com", "password123");

    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    // Wolf room tab visible for werewolf
    const wolfTab = page.getByRole("button", { name: "人狼" });
    await expect(wolfTab).toBeVisible();

    // Can switch and see wolf chat
    await wolfTab.click();
    await expect(page.getByText("たろうを襲撃しよう")).toBeVisible();
  });

  test("村人プレイヤーには人狼ルームタブが表示されない", async ({ page }) => {
    await login(page, "taro@example.com", "password123");

    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    // Wait for game data to fully load
    await expect(
      page.getByRole("button", { name: "メイン" }),
    ).toBeVisible();
    await expect(page.getByText("あなたの役職:")).toBeVisible();

    // Wolf room tab NOT visible for villager
    await expect(
      page.getByRole("button", { name: "人狼" }),
    ).not.toBeVisible();
  });
});
