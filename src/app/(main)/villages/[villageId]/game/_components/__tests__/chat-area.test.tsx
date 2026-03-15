// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockUseInfiniteQuery,
  mockUseMutation,
  mockSetActiveRoomType,
  mockUseRealtimePosts,
  mockFetchNextPage,
  infiniteQueryState,
} = vi.hoisted(() => ({
  mockUseInfiniteQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockSetActiveRoomType: vi.fn(),
  mockUseRealtimePosts: vi.fn(),
  mockFetchNextPage: vi.fn(),
  infiniteQueryState: {
    data: null as {
      pages: Array<{
        items: Array<{
          id: string;
          content: string;
          owner: "SYSTEM" | "PLAYER";
          player: { id: string; username: string } | null;
          createdAt: Date;
        }>;
        nextCursor: { createdAt: string; id: string } | null;
      }>;
    } | null,
    isLoading: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: mockUseInfiniteQuery,
  useMutation: mockUseMutation,
}));

vi.mock("@/lib/trpc/react", () => ({
  useTRPC: () => ({
    game: {
      messages: {
        infiniteQueryOptions: vi.fn(() => ({})),
      },
      sendMessage: {
        mutationOptions: vi.fn(() => ({})),
      },
    },
  }),
}));

vi.mock("@/lib/hooks/use-realtime-posts", () => ({
  useRealtimePosts: mockUseRealtimePosts,
}));

vi.mock("@/stores/game-store", () => ({
  useGameStore: () => ({
    activeRoomType: "MAIN",
    setActiveRoomType: mockSetActiveRoomType,
  }),
}));

vi.mock("../chat-message", () => ({
  ChatMessage: ({
    content,
  }: {
    content: string;
    owner: "SYSTEM" | "PLAYER";
    player: { id: string; username: string } | null;
    createdAt: Date;
  }) => <div>{content}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => (
    <div data-value={value} onClick={() => onValueChange(value)}>
      {children}
    </div>
  ),
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <button data-value={value}>{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

import { ChatArea, RoomChat } from "../chat-area";

function createMessage(id: string, content: string) {
  return {
    id,
    content,
    owner: "SYSTEM" as const,
    player: null,
    createdAt: new Date(`2026-03-15T00:00:0${id}.000Z`),
  };
}

function setInfiniteQueryResult({
  pages,
  hasNextPage = false,
  isFetchingNextPage = false,
}: {
  pages: Array<{
    items: Array<ReturnType<typeof createMessage>>;
    nextCursor: { createdAt: string; id: string } | null;
  }>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}) {
  infiniteQueryState.data = { pages };
  infiniteQueryState.isLoading = false;
  infiniteQueryState.hasNextPage = hasNextPage;
  infiniteQueryState.isFetchingNextPage = isFetchingNextPage;
  infiniteQueryState.fetchNextPage = mockFetchNextPage;
}

function getScrollContainer() {
  const element = screen.getByTestId("chat-scroll-container");
  if (!(element instanceof HTMLDivElement)) {
    throw new Error("scroll container not found");
  }
  return element;
}

function setScrollMetrics(
  el: HTMLDivElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop?: number },
) {
  let currentScrollHeight = metrics.scrollHeight;
  let currentClientHeight = metrics.clientHeight;
  let currentScrollTop = metrics.scrollTop ?? 0;

  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => currentScrollHeight,
    set: (value: number) => {
      currentScrollHeight = value;
    },
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => currentClientHeight,
    set: (value: number) => {
      currentClientHeight = value;
    },
  });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      const maxScrollTop = Math.max(0, currentScrollHeight - currentClientHeight);
      currentScrollTop = Math.min(Math.max(0, value), maxScrollTop);
    },
  });

  return {
    get scrollTop() {
      return currentScrollTop;
    },
    set scrollTop(value: number) {
      currentScrollTop = value;
    },
    set scrollHeight(value: number) {
      currentScrollHeight = value;
    },
  };
}

function renderRoomChat(roomId: string) {
  return render(
    <RoomChat
      roomId={roomId}
      roomType="MAIN"
      myRole="VILLAGER"
      myStatus="ALIVE"
      isEnded={false}
    />,
  );
}

describe("ChatArea scroll behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseInfiniteQuery.mockImplementation(() => infiniteQueryState);
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    mockFetchNextPage.mockResolvedValue(undefined);
    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("1", "recent-1"), createMessage("2", "recent-2")],
          nextCursor: null,
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("上端読込で古いメッセージを prepend しても表示位置を維持する", async () => {
    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("2", "recent-2"), createMessage("3", "recent-3")],
          nextCursor: { createdAt: "2026-03-15T00:00:02.000Z", id: "2" },
        },
      ],
      hasNextPage: false,
    });

    const view = render(
      <ChatArea
        rooms={[{ id: "room-main", type: "MAIN" }]}
        myRole="VILLAGER"
        myStatus="ALIVE"
        isEnded={false}
      />,
    );

    const scrollEl = getScrollContainer();
    const metrics = setScrollMetrics(scrollEl, {
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 40,
    });

    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("2", "recent-2"), createMessage("3", "recent-3")],
          nextCursor: { createdAt: "2026-03-15T00:00:02.000Z", id: "2" },
        },
      ],
      hasNextPage: true,
    });

    await act(async () => {
      view.rerender(
        <ChatArea
          rooms={[{ id: "room-main", type: "MAIN" }]}
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    fireEvent.scroll(scrollEl);
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);

    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("2", "recent-2"), createMessage("3", "recent-3")],
          nextCursor: { createdAt: "2026-03-15T00:00:02.000Z", id: "2" },
        },
        {
          items: [createMessage("0", "older-0")],
          nextCursor: null,
        },
      ],
      hasNextPage: false,
    });
    metrics.scrollHeight = 650;

    await act(async () => {
      view.rerender(
        <ChatArea
          rooms={[{ id: "room-main", type: "MAIN" }]}
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    await waitFor(() => {
      expect(metrics.scrollTop).toBe(190);
    });
  });

  test("下端付近にいるときは新着メッセージで自動追従する", async () => {
    const view = render(
      <ChatArea
        rooms={[{ id: "room-main", type: "MAIN" }]}
        myRole="VILLAGER"
        myStatus="ALIVE"
        isEnded={false}
      />,
    );

    const scrollEl = getScrollContainer();
    const metrics = setScrollMetrics(scrollEl, {
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 260,
    });

    fireEvent.scroll(scrollEl);

    setInfiniteQueryResult({
      pages: [
        {
          items: [
            createMessage("1", "recent-1"),
            createMessage("2", "recent-2"),
            createMessage("3", "new-3"),
          ],
          nextCursor: null,
        },
      ],
    });
    metrics.scrollHeight = 560;

    await act(async () => {
      view.rerender(
        <ChatArea
          rooms={[{ id: "room-main", type: "MAIN" }]}
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    await waitFor(() => {
      expect(metrics.scrollTop).toBe(360);
    });
  });

  test("下端から離れているときは新着メッセージでも自動追従しない", async () => {
    const view = render(
      <ChatArea
        rooms={[{ id: "room-main", type: "MAIN" }]}
        myRole="VILLAGER"
        myStatus="ALIVE"
        isEnded={false}
      />,
    );

    const scrollEl = getScrollContainer();
    const metrics = setScrollMetrics(scrollEl, {
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 50,
    });

    fireEvent.scroll(scrollEl);

    setInfiniteQueryResult({
      pages: [
        {
          items: [
            createMessage("1", "recent-1"),
            createMessage("2", "recent-2"),
            createMessage("3", "new-3"),
          ],
          nextCursor: null,
        },
      ],
      hasNextPage: false,
    });
    metrics.scrollHeight = 560;

    await act(async () => {
      view.rerender(
        <ChatArea
          rooms={[{ id: "room-main", type: "MAIN" }]}
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    await waitFor(() => {
      expect(metrics.scrollTop).toBe(50);
    });
  });

  test("過去ログ読込が失敗しても次回スクロールで再試行できる", async () => {
    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("2", "recent-2"), createMessage("3", "recent-3")],
          nextCursor: { createdAt: "2026-03-15T00:00:02.000Z", id: "2" },
        },
      ],
      hasNextPage: false,
    });
    mockFetchNextPage
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(undefined);

    const view = render(
      <ChatArea
        rooms={[{ id: "room-main", type: "MAIN" }]}
        myRole="VILLAGER"
        myStatus="ALIVE"
        isEnded={false}
      />,
    );

    const scrollEl = getScrollContainer();
    setScrollMetrics(scrollEl, {
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 40,
    });

    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("2", "recent-2"), createMessage("3", "recent-3")],
          nextCursor: { createdAt: "2026-03-15T00:00:02.000Z", id: "2" },
        },
      ],
      hasNextPage: true,
    });

    await act(async () => {
      view.rerender(
        <ChatArea
          rooms={[{ id: "room-main", type: "MAIN" }]}
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    fireEvent.scroll(scrollEl);
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.scroll(scrollEl);

    expect(mockFetchNextPage).toHaveBeenCalledTimes(2);
  });

  test("roomId 切替時に同一インスタンスでもスクロール関連 state をリセットする", async () => {
    const view = renderRoomChat("room-main");

    const scrollEl = getScrollContainer();
    const metrics = setScrollMetrics(scrollEl, {
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 50,
    });

    fireEvent.scroll(scrollEl);
    expect(metrics.scrollTop).toBe(50);

    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("4", "room2-4"), createMessage("5", "room2-5")],
          nextCursor: null,
        },
      ],
    });

    metrics.scrollHeight = 600;
    metrics.scrollTop = 50;

    await act(async () => {
      view.rerender(
        <RoomChat
          roomId="room-next"
          roomType="MAIN"
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    await waitFor(() => {
      expect(metrics.scrollTop).toBe(400);
    });
  });

  test("高さが足りるときは自動取得せず、高さ不足になったら自動で過去ログを追加取得する", async () => {
    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("1", "recent-1")],
          nextCursor: { createdAt: "2026-03-15T00:00:01.000Z", id: "1" },
        },
      ],
      hasNextPage: false,
    });

    const view = renderRoomChat("room-main");
    const scrollEl = getScrollContainer();
    const metrics = setScrollMetrics(scrollEl, {
      scrollHeight: 500,
      clientHeight: 200,
      scrollTop: 0,
    });

    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("1", "recent-1")],
          nextCursor: { createdAt: "2026-03-15T00:00:01.000Z", id: "1" },
        },
      ],
      hasNextPage: true,
    });

    await act(async () => {
      view.rerender(
        <RoomChat
          roomId="room-main"
          roomType="MAIN"
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    expect(mockFetchNextPage).not.toHaveBeenCalled();

    metrics.scrollHeight = 200;
    setInfiniteQueryResult({
      pages: [
        {
          items: [createMessage("1", "recent-1"), createMessage("2", "recent-2")],
          nextCursor: { createdAt: "2026-03-15T00:00:02.000Z", id: "2" },
        },
      ],
      hasNextPage: true,
    });

    await act(async () => {
      view.rerender(
        <RoomChat
          roomId="room-main"
          roomType="MAIN"
          myRole="VILLAGER"
          myStatus="ALIVE"
          isEnded={false}
        />,
      );
    });

    await waitFor(() => {
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });
  });
});
