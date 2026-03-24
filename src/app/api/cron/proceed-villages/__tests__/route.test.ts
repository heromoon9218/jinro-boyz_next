import { describe, expect, test, vi, beforeEach } from "vitest";

// モックを最初に定義
vi.mock("@/server/db", () => ({
  db: {
    village: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/game/proceed-day", () => ({
  proceedDay: vi.fn(),
}));

// モックのインポート
import { db } from "@/server/db";
import { proceedDay } from "@/server/game/proceed-day";
import { GET } from "../route";

const mockFindMany = vi.mocked(db.village.findMany);
const mockProceedDay = vi.mocked(proceedDay);

describe("GET /api/cron/proceed-villages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  const makeRequest = (authHeader?: string) =>
    new Request("http://localhost/api/cron/proceed-villages", {
      headers: authHeader ? { authorization: authHeader } : {},
    });

  describe("認証", () => {
    test("authorization ヘッダーがない場合は 401 を返す", async () => {
      const req = makeRequest();
      const res = await GET(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    test("authorization ヘッダーが不正な場合は 401 を返す", async () => {
      const req = makeRequest("Bearer wrong-secret");
      const res = await GET(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });

    test("CRON_SECRET が一致する場合は認証を通過する", async () => {
      mockFindMany.mockResolvedValue([]);
      const req = makeRequest("Bearer test-secret");
      const res = await GET(req);
      expect(res.status).toBe(200);
    });
  });

  describe("村の取得", () => {
    test("IN_PLAY かつ nextUpdateTime <= now の村を取得する", async () => {
      mockFindMany.mockResolvedValue([]);
      const req = makeRequest("Bearer test-secret");
      await GET(req);

      expect(mockFindMany).toHaveBeenCalledOnce();
      const callArg = mockFindMany.mock.calls[0][0];
      expect(callArg?.where?.status).toBe("IN_PLAY");
      expect(callArg?.where?.nextUpdateTime).toHaveProperty("lte");
    });

    test("取得した村に対して proceedDay を呼び出す", async () => {
      mockFindMany.mockResolvedValue([
        { id: "village-1" },
        { id: "village-2" },
      ] as Awaited<ReturnType<typeof db.village.findMany>>);
      mockProceedDay.mockResolvedValue(undefined as never);

      const req = makeRequest("Bearer test-secret");
      await GET(req);

      expect(mockProceedDay).toHaveBeenCalledTimes(2);
      expect(mockProceedDay).toHaveBeenCalledWith("village-1");
      expect(mockProceedDay).toHaveBeenCalledWith("village-2");
    });
  });

  describe("レスポンス", () => {
    test("正常に処理された場合、ok: true で結果を返す", async () => {
      mockFindMany.mockResolvedValue([
        { id: "village-1" },
      ] as Awaited<ReturnType<typeof db.village.findMany>>);
      mockProceedDay.mockResolvedValue(undefined as never);

      const req = makeRequest("Bearer test-secret");
      const res = await GET(req);
      const body = await res.json();

      expect(body.processed).toBe(1);
      expect(body.results).toEqual([{ villageId: "village-1", ok: true }]);
    });

    test("対象の村が0件の場合、processed: 0 を返す", async () => {
      mockFindMany.mockResolvedValue([]);

      const req = makeRequest("Bearer test-secret");
      const res = await GET(req);
      const body = await res.json();

      expect(body.processed).toBe(0);
      expect(body.results).toEqual([]);
    });

    test("proceedDay が失敗した場合、ok: false かつ error を含む結果を返す", async () => {
      mockFindMany.mockResolvedValue([
        { id: "village-1" },
      ] as Awaited<ReturnType<typeof db.village.findMany>>);
      mockProceedDay.mockRejectedValue(new Error("DB接続エラー"));

      const req = makeRequest("Bearer test-secret");
      const res = await GET(req);
      const body = await res.json();

      expect(body.processed).toBe(1);
      expect(body.results).toEqual([
        { villageId: "village-1", ok: false, error: "DB接続エラー" },
      ]);
    });

    test("一部の村で proceedDay が失敗しても他の村は処理される", async () => {
      mockFindMany.mockResolvedValue([
        { id: "village-1" },
        { id: "village-2" },
      ] as Awaited<ReturnType<typeof db.village.findMany>>);
      mockProceedDay
        .mockRejectedValueOnce(new Error("エラー発生"))
        .mockResolvedValueOnce(undefined as never);

      const req = makeRequest("Bearer test-secret");
      const res = await GET(req);
      const body = await res.json();

      expect(body.processed).toBe(2);
      expect(body.results[0]).toEqual({
        villageId: "village-1",
        ok: false,
        error: "エラー発生",
      });
      expect(body.results[1]).toEqual({ villageId: "village-2", ok: true });
    });

    test("proceedDay が Error 以外をスローした場合、error に Unknown error が入る", async () => {
      mockFindMany.mockResolvedValue([
        { id: "village-1" },
      ] as Awaited<ReturnType<typeof db.village.findMany>>);
      mockProceedDay.mockRejectedValue("文字列エラー");

      const req = makeRequest("Bearer test-secret");
      const res = await GET(req);
      const body = await res.json();

      expect(body.results[0]).toEqual({
        villageId: "village-1",
        ok: false,
        error: "Unknown error",
      });
    });
  });
});
