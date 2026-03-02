// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockLogout } = vi.hoisted(() => ({
  mockLogout: vi.fn(),
}));

vi.mock("@/app/(auth)/actions", () => ({
  logout: mockLogout,
}));

import { LogoutButton } from "../logout-button";

describe("LogoutButton キャッシュクリア", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("クリック時に queryClient.clear() を呼んでから logout() を呼ぶ", () => {
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");

    render(
      <QueryClientProvider client={queryClient}>
        <LogoutButton />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);

    // clear が logout より先に呼ばれたことを確認
    const clearOrder = clearSpy.mock.invocationCallOrder[0];
    const logoutOrder = mockLogout.mock.invocationCallOrder[0];
    expect(clearOrder).toBeLessThan(logoutOrder);
  });
});
