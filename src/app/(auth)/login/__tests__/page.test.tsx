// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockLogin } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  login: mockLogin,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import LoginPage from "../page";

describe("LoginPage キャッシュクリア", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  test("フォーム送信時に queryClient.clear() を呼んでから login() を呼ぶ", async () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    render(
      <QueryClientProvider client={queryClient}>
        <LoginPage />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    expect(clearSpy).toHaveBeenCalledTimes(1);

    // clear が login より先に呼ばれたことを確認
    const clearOrder = clearSpy.mock.invocationCallOrder[0];
    const loginOrder = mockLogin.mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(loginOrder);
  });
});
