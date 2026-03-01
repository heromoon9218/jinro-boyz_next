import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockAuthUserId = "auth-user-123";

const {
  mockSignUp,
  mockSignOut,
  mockDeleteUser,
  mockFindUnique,
  mockCreate,
} = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockSignOut: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT:/villages");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        signUp: mockSignUp,
        signOut: mockSignOut,
      },
    }),
  ),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        deleteUser: mockDeleteUser,
      },
    },
  })),
}));

vi.mock("@/server/db", () => ({
  db: {
    user: {
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}));

import { signup } from "../actions";

const validFormData = {
  username: "testuser",
  email: "test@example.com",
  password: "password123",
  confirmPassword: "password123",
};

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: mockAuthUserId, identities: [{ provider: "email" }] },
      },
      error: null,
    });
    mockCreate.mockResolvedValue({});
  });

  test("バリデーション失敗時はエラーを返す", async () => {
    const result = await signup({
      ...validFormData,
      username: "a",
    });
    expect(result).toEqual({
      error: "ユーザー名は2文字以上で入力してください",
    });
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("username が既に存在する場合はエラーを返す", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing" });
    const result = await signup(validFormData);
    expect(result).toEqual({ error: "このユーザー名は既に使われています" });
    expect(mockSignUp).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("Supabase signUp 失敗時はエラーを返す", async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already registered" },
    });
    const result = await signup(validFormData);
    expect(result).toEqual({ error: "Email already registered" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("既存メールで signUp 時（identities 空配列）はエラーを返し、deleteUser を呼ばない", async () => {
    const existingAuthUserId = "existing-auth-user-456";
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: existingAuthUserId, identities: [] },
      },
      error: null,
    });

    const result = await signup(validFormData);

    expect(result).toEqual({
      error: "このメールアドレスは既に登録されています",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("成功時は redirect が呼ばれる（Prisma 作成成功）", async () => {
    await expect(signup(validFormData)).rejects.toThrow("NEXT_REDIRECT:/villages");
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        authId: mockAuthUserId,
        username: validFormData.username,
        email: validFormData.email,
        profile: { create: {} },
      },
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("Prisma 作成失敗時は Auth ユーザーを削除してロールバックし、エラーを返す", async () => {
    mockCreate.mockRejectedValue(new Error("Database connection failed"));
    mockDeleteUser.mockResolvedValue(undefined);

    const result = await signup(validFormData);

    expect(mockDeleteUser).toHaveBeenCalledWith(mockAuthUserId);
    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toEqual({
      error:
        "アカウントの作成中にエラーが発生しました。しばらく経ってから再度お試しください。",
    });
  });

  test("P2002 unique 制約違反時はユーザーフレンドリーなメッセージを返す", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "x.x.x" },
    );
    mockCreate.mockRejectedValue(prismaError);
    mockDeleteUser.mockResolvedValue(undefined);

    const result = await signup(validFormData);

    expect(mockDeleteUser).toHaveBeenCalledWith(mockAuthUserId);
    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toEqual({
      error:
        "このユーザー名またはメールアドレスは既に使われています。別のものをお試しください。",
    });
  });

  test("ロールバック（deleteUser）失敗時もエラーを返す（ユーザーは再登録可能な状態を維持）", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreate.mockRejectedValue(new Error("DB error"));
    mockDeleteUser.mockRejectedValue(new Error("Admin API failed"));

    const result = await signup(validFormData);

    expect(mockDeleteUser).toHaveBeenCalledWith(mockAuthUserId);
    expect(mockSignOut).toHaveBeenCalled();
    expect(result).toEqual({
      error:
        "アカウントの作成中にエラーが発生しました。しばらく経ってから再度お試しください。",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[signup] Failed to rollback auth user after Prisma error:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });
});
