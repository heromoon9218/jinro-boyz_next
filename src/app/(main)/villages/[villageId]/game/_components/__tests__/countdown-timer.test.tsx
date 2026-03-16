// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { mockUseMutation, mockMutate, mockMutationOptions } = vi.hoisted(() => ({
  mockUseMutation: vi.fn(),
  mockMutate: vi.fn(),
  mockMutationOptions: vi.fn(() => ({})),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mockUseMutation,
}));

vi.mock("@/lib/trpc/react", () => ({
  useTRPC: () => ({
    game: {
      triggerProceed: {
        mutationOptions: mockMutationOptions,
      },
    },
  }),
}));

import { CountdownTimer } from "../countdown-timer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00.000Z"));
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("同じ締切では triggerProceed を一度しか呼ばない", () => {
    render(
      <CountdownTimer
        nextUpdateTime={new Date("2026-03-16T12:00:01.000Z")}
        villageId="village-1"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({ villageId: "village-1" });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  test("次の締切に変わると再度 triggerProceed できる", () => {
    const view = render(
      <CountdownTimer
        nextUpdateTime={new Date("2026-03-16T12:00:01.000Z")}
        villageId="village-1"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockMutate).toHaveBeenCalledTimes(1);

    view.rerender(
      <CountdownTimer
        nextUpdateTime={new Date("2026-03-16T12:00:02.000Z")}
        villageId="village-1"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockMutate).toHaveBeenCalledTimes(2);
  });

  test("nextUpdateTime が null に変わると待機表示に戻る", () => {
    const view = render(
      <CountdownTimer
        nextUpdateTime={new Date("2026-03-16T12:00:05.000Z")}
        villageId="village-1"
      />,
    );

    expect(screen.getByText("00:05")).toBeTruthy();

    view.rerender(
      <CountdownTimer
        nextUpdateTime={null}
        villageId="village-1"
      />,
    );

    expect(screen.getByText("--:--")).toBeTruthy();
  });
});
