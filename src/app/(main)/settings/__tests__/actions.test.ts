import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGetUser, mockUpdateUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        updateUser: mockUpdateUser,
      },
    }),
  ),
}));

import { updateEmail } from "../actions";

describe("updateEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-123" } },
    });
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  test("無効なメールアドレス時はエラーを返す", async () => {
    const result = await updateEmail("invalid-email");
    expect(result).toEqual({
      error: "有効なメールアドレスを入力してください",
    });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("空文字時はエラーを返す", async () => {
    const result = await updateEmail("");
    expect(result).toEqual({
      error: "有効なメールアドレスを入力してください",
    });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  test("未ログイン時はエラーを返す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await updateEmail("new@example.com");

    expect(result).toEqual({ error: "ログインが必要です" });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("Supabase updateUser 失敗時はエラーを返す", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Email already in use" },
    });

    const result = await updateEmail("taken@example.com");

    expect(result).toEqual({ error: "Email already in use" });
  });

  test("成功時は Supabase updateUser のみ呼び、エラーなしで返す", async () => {
    const newEmail = "new@example.com";
    const result = await updateEmail(newEmail);

    expect(result).toEqual({});
    expect(mockUpdateUser).toHaveBeenCalledWith({ email: newEmail });
  });
});
