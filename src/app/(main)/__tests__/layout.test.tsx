import { beforeEach, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockGetUser, mockFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock("../logout-button", () => ({
  LogoutButton: () => <span data-testid="logout-button">ログアウト</span>,
}));

import MainLayout from "../layout";

async function renderLayout() {
  const element = await MainLayout({ children: <div>children</div> });
  return renderToStaticMarkup(element);
}

describe("MainLayout ナビゲーション", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("authUser なしのとき、ログイン・サインアップリンクを表示する", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const html = await renderLayout();

    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain("ログイン");
    expect(html).toContain("新規登録");
    expect(html).not.toContain("ログアウト");
    expect(html).not.toContain('href="/profile"');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  test("authUser あり・username ありのとき、プロフィール・設定・username・ログアウトを表示する", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-123" } },
    });
    mockFindUnique.mockResolvedValue({ username: "testuser" });

    const html = await renderLayout();

    expect(html).toContain('href="/profile"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain("testuser");
    expect(html).toContain("ログアウト");
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain('href="/signup"');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { authId: "auth-123" },
      select: { username: true },
    });
  });

  test("authUser あり・username なしのとき、プロフィール・設定・ログアウトを表示し、username は表示しない", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-456" } },
    });
    mockFindUnique.mockResolvedValue(null);

    const html = await renderLayout();

    expect(html).toContain('href="/profile"');
    expect(html).toContain('href="/settings"');
    expect(html).toContain("ログアウト");
    expect(html).not.toContain('href="/login"');
    expect(html).not.toContain('href="/signup"');
    expect(html).not.toContain("testuser");
  });

  test("authUser あり・Prisma ユーザーなし（signup ロールバック失敗時）でもログアウトボタンを表示する", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "orphan-auth" } },
    });
    mockFindUnique.mockResolvedValue(null);

    const html = await renderLayout();

    expect(html).toContain("ログアウト");
    expect(html).toContain('href="/profile"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('href="/login"');
  });
});
