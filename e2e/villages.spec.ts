import { test, expect } from "@playwright/test";

test.describe("村一覧ページ", () => {
  test("村一覧ページが表示される", async ({ page }) => {
    await page.goto("/villages");
    await expect(page.getByRole("heading", { name: "村一覧" })).toBeVisible();
  });

  test("フィルタタブの切替が動作する", async ({ page }) => {
    await page.goto("/villages");
    const activeTab = page.getByRole("tab", { name: "募集中・進行中" });
    const endedTab = page.getByRole("tab", { name: "終了済み" });

    await expect(activeTab).toHaveAttribute("data-state", "active");
    await endedTab.click();
    await expect(endedTab).toHaveAttribute("data-state", "active");
    await expect(activeTab).toHaveAttribute("data-state", "inactive");
  });

  test("未ログイン時に村作成ボタンが非表示", async ({ page }) => {
    await page.goto("/villages");
    // 初期ロード完了を待つ
    await expect(page.getByRole("heading", { name: "村一覧" })).toBeVisible();
    await expect(page.getByRole("button", { name: "村を作成" })).not.toBeVisible();
  });
});

test.describe("村詳細ページ", () => {
  test("存在しない村にアクセスするとエラーが表示される", async ({ page }) => {
    await page.goto("/villages/nonexistent-id");
    // tRPCエラーまたは「村が見つかりません」メッセージが表示される
    await expect(
      page.getByText("村が見つかりません").or(page.getByText("NOT_FOUND")),
    ).toBeVisible({ timeout: 10000 });
  });
});
