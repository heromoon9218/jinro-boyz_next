import { test, expect, type Page } from "@playwright/test";

/**
 * Seed data prerequisite (`npx prisma db seed`):
 * - "テスト村・終了" (ENDED, HUMANS win, day 2, 5 players, showVoteTarget=false)
 *   - Day 1: 投票なし, さくら襲撃, ゆうき占い(人狼)
 *   - Day 2: ゆうき処刑(人狼), 処刑でゲーム終了(夜なし)
 * - Users: taro@example.com (村人, 勝利) / password123
 */

// ── Helpers ──

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL(/\/villages/, { timeout: 15000 });
}

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

// ── 結果パネル ──

test.describe("ゲーム結果パネル", () => {
  test("ENDED村のゲーム画面に「結果」タブが表示される", async ({ page }) => {
    const villageId = await getVillageId(page, "テスト村・終了", "終了済み");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・終了")).toBeVisible({
      timeout: 15000,
    });

    await expect(
      page.getByRole("button", { name: "結果" }),
    ).toBeVisible();
  });

  test("「結果」タブクリックで日別結果が表示される", async ({ page }) => {
    const villageId = await getVillageId(page, "テスト村・終了", "終了済み");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・終了")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "結果" }).click();

    // 結果一覧ヘッダー
    await expect(page.getByText("結果一覧")).toBeVisible({ timeout: 10000 });

    // Day 2: ゆうき処刑（人狼）
    await expect(page.getByText("2日目")).toBeVisible();
    await expect(page.getByText("ゆうき").first()).toBeVisible();
    await expect(page.getByText("人狼").first()).toBeVisible();
  });

  test("処刑でゲーム終了した最終日に夜フェーズ結果が表示されない", async ({
    page,
  }) => {
    const villageId = await getVillageId(page, "テスト村・終了", "終了済み");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・終了")).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole("button", { name: "結果" }).click();
    await expect(page.getByText("結果一覧")).toBeVisible({ timeout: 10000 });

    // Day 2 のカード内に「襲撃」が表示されないことを確認
    // Day 1 には「襲撃」が表示される（さくらが襲撃された）
    const day1Card = page.locator("div").filter({ hasText: "1日目" }).first();
    await expect(day1Card.getByText("襲撃:")).toBeVisible();

    // Day 2 のカードでは「襲撃:」が存在しない（処刑でゲーム終了 = 夜なし）
    const resultsPanel = page.locator("div").filter({ hasText: "結果一覧" }).first();
    const day2Cards = resultsPanel.locator("div.rounded-md").filter({ hasText: "2日目" });
    await expect(day2Cards.getByText("襲撃:")).not.toBeVisible();
  });

  test("ルームタブに切り替えると結果パネルが閉じる", async ({ page }) => {
    const villageId = await getVillageId(page, "テスト村・終了", "終了済み");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・終了")).toBeVisible({
      timeout: 15000,
    });

    // 結果タブを開く
    await page.getByRole("button", { name: "結果" }).click();
    await expect(page.getByText("結果一覧")).toBeVisible({ timeout: 10000 });

    // メインルームに切り替え
    await page.getByRole("button", { name: "メイン" }).click();

    // 結果パネルが閉じてチャットが表示される
    await expect(page.getByText("結果一覧")).not.toBeVisible();
    await expect(page.getByText("少人数だけどがんばろう！")).toBeVisible();
  });

  test("IN_PLAY村のゲーム画面に「結果」タブが表示されない", async ({
    page,
  }) => {
    const villageId = await getVillageId(page, "テスト村・ゲーム中");
    await page.goto(`/villages/${villageId}/game`);

    await expect(page.getByText("テスト村・ゲーム中")).toBeVisible({
      timeout: 15000,
    });

    await expect(
      page.getByRole("button", { name: "結果" }),
    ).not.toBeVisible();
  });
});

// ── プロフィール戦績 ──

test.describe("プロフィール戦績", () => {
  test("ログインユーザーのプロフィールに戦績テーブルが表示される", async ({
    page,
  }) => {
    await login(page, "taro@example.com", "password123");
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "プロフィール" })).toBeVisible({
      timeout: 15000,
    });

    // 戦績ヘッダー
    await expect(page.getByRole("heading", { name: "戦績" })).toBeVisible({
      timeout: 10000,
    });

    // テーブルヘッダー
    await expect(page.getByText("役職")).toBeVisible();
    await expect(page.getByText("勝利数")).toBeVisible();
    await expect(page.getByText("対戦数")).toBeVisible();
    await expect(page.getByText("勝率")).toBeVisible();

    // 合計行
    await expect(page.getByText("合計")).toBeVisible();
  });

  test("戦績テーブルに全役職が表示される", async ({ page }) => {
    await login(page, "taro@example.com", "password123");
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "戦績" })).toBeVisible({
      timeout: 10000,
    });

    // 全役職名が表示される
    await expect(page.getByText("村人")).toBeVisible();
    await expect(page.getByText("人狼")).toBeVisible();
    await expect(page.getByText("占い師")).toBeVisible();
    await expect(page.getByText("霊媒師")).toBeVisible();
    await expect(page.getByText("騎士")).toBeVisible();
    await expect(page.getByText("狂人")).toBeVisible();
  });
});
