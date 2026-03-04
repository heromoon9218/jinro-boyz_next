import dotenv from "dotenv";
import path from "path";
import { defineConfig, env } from "prisma/config";

// .env.local を優先読み込み（ローカルSupabase接続情報）
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config(); // .env のフォールバック（既存の値は上書きしない）

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
