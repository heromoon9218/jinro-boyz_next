import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuthUserId = "auth-user-123";

const { mockGetUser, mockUpdateUser, mockUserUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockUserUpdate: vi.fn(),
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

vi.mock("@/server/db", () => ({
  db: {
    user: {
      update: mockUserUpdate,
    },
  },
}));

import { updateEmail } from "../actions";

describe("updateEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockAuthUserId } },
    });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockUserUpdate.mockResolvedValue({});
  });

  test("無効なメールアドレス時はエラーを返す", async () => {
    const result = await updateEmail("invalid-email");
    expect(result).toEqual({
      error: "有効なメールアドレスを入力してください",
    });
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
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
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  test("Supabase updateUser 失敗時はエラーを返す", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "Email already in use" },
    });

    const result = await updateEmail("taken@example.com");

    expect(result).toEqual({ error: "Email already in use" });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  test("成功時は Supabase と Prisma の両方を更新し、エラーなしで返す", async () => {
    const newEmail = "new@example.com";
    const result = await updateEmail(newEmail);

    expect(result).toEqual({});
    expect(mockUpdateUser).toHaveBeenCalledWith({ email: newEmail });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { authId: mockAuthUserId },
      data: { email: newEmail },
    });
  });

  test("Prisma update 失敗時はエラーを返す", async () => {
    mockUserUpdate.mockRejectedValue(new Error("Database connection failed"));

    const result = await updateEmail("new@example.com");

    expect(result).toEqual({
      error:
        "メールアドレスの更新中にエラーが発生しました。しばらく経ってから再度お試しください。",
    });
  });
});
