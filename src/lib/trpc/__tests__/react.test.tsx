// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type AuthChangeCallback = (event: string, session: unknown) => void;

const { mockOnAuthStateChange, mockUnsubscribe } = vi.hoisted(() => ({
  mockOnAuthStateChange: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}));

import { TRPCReactProvider } from "../react";

describe("TRPCReactProvider 認証キャッシュクリア", () => {
  let authChangeCallback: AuthChangeCallback;
  let clearSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSpy = vi.spyOn(QueryClient.prototype, "clear");
    mockOnAuthStateChange.mockImplementation((cb: AuthChangeCallback) => {
      authChangeCallback = cb;
      return {
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      };
    });
  });

  afterEach(() => {
    clearSpy.mockRestore();
  });

  test("マウント時に onAuthStateChange を購読する", () => {
    render(
      <TRPCReactProvider>
        <div />
      </TRPCReactProvider>,
    );
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));
  });

  test("SIGNED_OUT イベント時にキャッシュをクリアする", () => {
    render(
      <TRPCReactProvider>
        <div />
      </TRPCReactProvider>,
    );

    act(() => {
      authChangeCallback("INITIAL_SESSION", { user: { id: "existing" } });
    });

    act(() => {
      authChangeCallback("SIGNED_OUT", null);
    });

    expect(clearSpy).toHaveBeenCalled();
  });

  test("SIGNED_IN イベント時にキャッシュをクリアする", () => {
    render(
      <TRPCReactProvider>
        <div />
      </TRPCReactProvider>,
    );

    act(() => {
      authChangeCallback("INITIAL_SESSION", { user: { id: "existing" } });
    });

    act(() => {
      authChangeCallback("SIGNED_IN", { user: { id: "new-user" } });
    });

    expect(clearSpy).toHaveBeenCalled();
  });

  test("TOKEN_REFRESHED イベント時にはキャッシュをクリアしない", () => {
    render(
      <TRPCReactProvider>
        <div />
      </TRPCReactProvider>,
    );

    act(() => {
      authChangeCallback("TOKEN_REFRESHED", null);
    });

    expect(clearSpy).not.toHaveBeenCalled();
  });

  test("INITIAL_SESSION イベント時にはキャッシュをクリアしない", () => {
    render(
      <TRPCReactProvider>
        <div />
      </TRPCReactProvider>,
    );

    act(() => {
      authChangeCallback("INITIAL_SESSION", { user: { id: "existing" } });
    });

    expect(clearSpy).not.toHaveBeenCalled();
  });

  test("アンマウント時に subscription を解除する", () => {
    const { unmount } = render(
      <TRPCReactProvider>
        <div />
      </TRPCReactProvider>,
    );

    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
