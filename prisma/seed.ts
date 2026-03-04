import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// .env.local を優先読み込み
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

// ============================================================
// Config
// ============================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DIRECT_URL!;

const SHARED_PASSWORD = "password123";

const USERS = [
  { username: "たろう", email: "taro@example.com" },
  { username: "はなこ", email: "hanako@example.com" },
  { username: "ゆうき", email: "yuuki@example.com" },
  { username: "さくら", email: "sakura@example.com" },
  { username: "れん", email: "ren@example.com" },
  { username: "あおい", email: "aoi@example.com" },
  { username: "ひなた", email: "hinata@example.com" },
  { username: "そら", email: "sora@example.com" },
] as const;

// ============================================================
// Helpers
// ============================================================

const pool = new Pool({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function cleanDatabase() {
  console.log("🧹 Cleaning database...");
  // Delete in dependency order
  await prisma.post.deleteMany();
  await prisma.record.deleteMany();
  await prisma.result.deleteMany();
  await prisma.room.deleteMany();
  await prisma.blacklistUser.deleteMany();
  await prisma.player.deleteMany();
  await prisma.village.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
}

async function cleanSupabaseAuth() {
  console.log("🧹 Cleaning Supabase Auth users...");
  const { data } = await supabase.auth.admin.listUsers();
  if (!data?.users) return;

  for (const user of data.users) {
    if (user.email?.endsWith("@example.com")) {
      await supabase.auth.admin.deleteUser(user.id);
    }
  }
}

// ============================================================
// Main seed
// ============================================================

async function main() {
  console.log("🌱 Seeding database...\n");

  await cleanDatabase();
  await cleanSupabaseAuth();

  // ----------------------------------------------------------
  // 1. Create Supabase Auth users + Prisma User/Profile
  // ----------------------------------------------------------
  console.log("👤 Creating users...");

  const dbUsers: Array<{ id: string; authId: string; username: string; email: string }> = [];

  for (const u of USERS) {
    const { data: authData, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: SHARED_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create auth user ${u.email}: ${error.message}`);

    const dbUser = await prisma.user.create({
      data: {
        authId: authData.user.id,
        username: u.username,
        email: u.email,
        profile: { create: { comment: `${u.username}です。よろしく！` } },
      },
    });

    dbUsers.push({ id: dbUser.id, authId: authData.user.id, username: u.username, email: u.email });
    console.log(`  ✓ ${u.username} (${u.email})`);
  }

  const [taro, hanako, yuuki, sakura, ren, aoi, hinata, sora] = dbUsers;

  // ----------------------------------------------------------
  // 2. Village A: NOT_STARTED (募集中)
  // ----------------------------------------------------------
  console.log("\n🏘️ Creating Village A (NOT_STARTED)...");

  const villageA = await prisma.village.create({
    data: {
      name: "テスト村・募集中",
      playerNum: 8,
      discussionTime: 300,
      day: 0,
      status: "NOT_STARTED",
      userId: taro.id,
      players: {
        create: [
          { username: taro.username, userId: taro.id },
          { username: hanako.username, userId: hanako.id },
          { username: yuuki.username, userId: yuuki.id },
        ],
      },
    },
  });
  console.log(`  ✓ ${villageA.name} (players: 3/${villageA.playerNum})`);

  // ----------------------------------------------------------
  // 3. Village B: IN_PLAY (ゲーム中, Day 2)
  // ----------------------------------------------------------
  console.log("\n🏘️ Creating Village B (IN_PLAY)...");

  type RoleType = "VILLAGER" | "WEREWOLF" | "FORTUNE_TELLER" | "BODYGUARD" | "MADMAN";
  type StatusType = "ALIVE" | "DEAD";

  const villageBRoles: Array<{
    user: typeof taro;
    role: RoleType;
    status: StatusType;
  }> = [
    { user: taro, role: "VILLAGER", status: "ALIVE" },
    { user: hanako, role: "FORTUNE_TELLER", status: "ALIVE" },
    { user: yuuki, role: "WEREWOLF", status: "ALIVE" },
    { user: sakura, role: "BODYGUARD", status: "ALIVE" },
    { user: ren, role: "VILLAGER", status: "ALIVE" },
    { user: aoi, role: "WEREWOLF", status: "ALIVE" },
    { user: hinata, role: "MADMAN", status: "DEAD" }, // Day 1 で処刑
    { user: sora, role: "VILLAGER", status: "ALIVE" },
  ];

  const villageB = await prisma.village.create({
    data: {
      name: "テスト村・ゲーム中",
      playerNum: 8,
      discussionTime: 300,
      day: 2,
      status: "IN_PLAY",
      userId: taro.id,
      startAt: new Date(Date.now() - 3600_000), // 1 hour ago
    },
  });

  // Create players
  const villageBPlayers: Array<{ id: string; username: string; role: RoleType; status: StatusType }> = [];

  for (const p of villageBRoles) {
    const player = await prisma.player.create({
      data: {
        username: p.user.username,
        role: p.role,
        status: p.status,
        userId: p.user.id,
        villageId: villageB.id,
      },
    });
    villageBPlayers.push({ id: player.id, username: p.user.username, role: p.role, status: p.status });
  }

  const [pTaro, pHanako, pYuuki, pSakura, pRen, pAoi, pHinata, pSora] = villageBPlayers;

  // Rooms
  const [roomBMain, roomBWolf, roomBDead] = await Promise.all([
    prisma.room.create({ data: { type: "MAIN", villageId: villageB.id } }),
    prisma.room.create({ data: { type: "WOLF", villageId: villageB.id } }),
    prisma.room.create({ data: { type: "DEAD", villageId: villageB.id } }),
  ]);

  // Day 1 Records (全員分: 投票 + 占い + 護衛 + 襲撃)
  console.log("  📋 Creating Day 1 records...");

  // 全員の投票: ひなた(狂人) に票が集中
  const day1VoteTargets = [
    { player: pTaro, target: pHinata },
    { player: pHanako, target: pHinata },
    { player: pYuuki, target: pTaro },
    { player: pSakura, target: pHinata },
    { player: pRen, target: pHinata },
    { player: pAoi, target: pHinata },
    { player: pHinata, target: pTaro },
    { player: pSora, target: pHinata },
  ];

  for (const { player, target } of day1VoteTargets) {
    const data: Record<string, unknown> = {
      day: 1,
      playerId: player.id,
      villageId: villageB.id,
      voteTargetId: target.id,
    };

    // 占い師(はなこ): ゆうき を占う
    if (player.id === pHanako.id) {
      data.divineTargetId = pYuuki.id;
    }
    // 騎士(さくら): たろう を護衛
    if (player.id === pSakura.id) {
      data.guardTargetId = pTaro.id;
    }
    // 人狼(ゆうき): たろう を襲撃
    if (player.id === pYuuki.id) {
      data.attackTargetId = pTaro.id;
    }
    // 人狼(あおい): たろう を襲撃
    if (player.id === pAoi.id) {
      data.attackTargetId = pTaro.id;
    }

    await prisma.record.create({ data: data as never });
  }

  // Day 1 Result: ひなた処刑、襲撃は護衛成功で無し
  await prisma.result.create({
    data: {
      day: 1,
      villageId: villageB.id,
      votedPlayerId: pHinata.id,
      attackedPlayerId: null, // 護衛成功
      divinedPlayerId: pYuuki.id,
      guardedPlayerId: pTaro.id,
    },
  });

  // Day 2 Records (進行中 — アクション未実行なので Record だけ空で作成)
  console.log("  📋 Creating Day 2 records (empty, in progress)...");

  const alivePlayers = villageBPlayers.filter((p) => p.status === "ALIVE");
  for (const player of alivePlayers) {
    await prisma.record.create({
      data: {
        day: 2,
        playerId: player.id,
        villageId: villageB.id,
      },
    });
  }

  // Posts in rooms
  console.log("  💬 Creating posts...");

  // MAIN room posts — Day 1
  const mainPostsDay1 = [
    { playerId: pTaro.id, content: "みんなよろしく！まずは自由に話そう", day: 1 },
    { playerId: pHanako.id, content: "よろしくね〜。怪しい人いるかな？", day: 1 },
    { playerId: pYuuki.id, content: "まだ情報少ないし、慎重にいこう", day: 1 },
    { playerId: pHinata.id, content: "俺は村人だよ！信じて！", day: 1 },
    { playerId: pSora.id, content: "ひなたさんちょっと怪しくない？", day: 1 },
    { playerId: pRen.id, content: "同意。ひなたに投票する", day: 1 },
    { playerId: null, content: "投票の結果、ひなた が処刑されました。", day: 1, owner: "SYSTEM" as const },
    { playerId: null, content: "夜が明けました。襲撃された人はいませんでした。", day: 1, owner: "SYSTEM" as const },
  ];

  for (const post of mainPostsDay1) {
    await prisma.post.create({
      data: {
        content: post.content,
        day: post.day,
        owner: post.owner ?? "PLAYER",
        playerId: post.playerId,
        roomId: roomBMain.id,
      },
    });
  }

  // MAIN room posts — Day 2
  const mainPostsDay2 = [
    { playerId: pTaro.id, content: "護衛成功したみたいだね。占い結果はどう？", day: 2 },
    { playerId: pHanako.id, content: "昨日ゆうきを占ったら人狼でした！", day: 2 },
    { playerId: pYuuki.id, content: "それは嘘だ！はなこが怪しい", day: 2 },
  ];

  for (const post of mainPostsDay2) {
    await prisma.post.create({
      data: {
        content: post.content,
        day: post.day,
        owner: "PLAYER",
        playerId: post.playerId,
        roomId: roomBMain.id,
      },
    });
  }

  // WOLF room posts
  const wolfPosts = [
    { playerId: pYuuki.id, content: "たろうを襲撃しよう", day: 1 },
    { playerId: pAoi.id, content: "了解。たろうに合わせる", day: 1 },
    { playerId: pYuuki.id, content: "護衛されたか…次は誰を狙う？", day: 2 },
    { playerId: pAoi.id, content: "はなこが占い師っぽいから先に消そう", day: 2 },
  ];

  for (const post of wolfPosts) {
    await prisma.post.create({
      data: {
        content: post.content,
        day: post.day,
        owner: "PLAYER",
        playerId: post.playerId,
        roomId: roomBWolf.id,
      },
    });
  }

  // DEAD room posts
  await prisma.post.create({
    data: {
      content: "処刑されちゃった…みんながんばれ〜",
      day: 1,
      owner: "PLAYER",
      playerId: pHinata.id,
      roomId: roomBDead.id,
    },
  });

  console.log(`  ✓ ${villageB.name} (players: 8/8, day: 2)`);

  // ----------------------------------------------------------
  // 4. Village C: ENDED (終了)
  // ----------------------------------------------------------
  console.log("\n🏘️ Creating Village C (ENDED)...");

  type RoleCType = "VILLAGER" | "WEREWOLF" | "FORTUNE_TELLER";

  const villageCRoles: Array<{
    user: typeof taro;
    role: RoleCType;
    status: StatusType;
  }> = [
    { user: taro, role: "VILLAGER", status: "ALIVE" },
    { user: hanako, role: "FORTUNE_TELLER", status: "ALIVE" },
    { user: yuuki, role: "WEREWOLF", status: "DEAD" }, // Day 2 で処刑
    { user: sakura, role: "VILLAGER", status: "DEAD" }, // Day 1 で襲撃
    { user: ren, role: "VILLAGER", status: "ALIVE" },
  ];

  const villageC = await prisma.village.create({
    data: {
      name: "テスト村・終了",
      playerNum: 5,
      discussionTime: 180,
      day: 2,
      status: "ENDED",
      winner: "HUMANS",
      userId: taro.id,
      startAt: new Date(Date.now() - 7200_000), // 2 hours ago
    },
  });

  const villageCPlayers: Array<{ id: string; username: string; role: RoleCType; status: StatusType }> = [];

  for (const p of villageCRoles) {
    const player = await prisma.player.create({
      data: {
        username: p.user.username,
        role: p.role,
        status: p.status,
        userId: p.user.id,
        villageId: villageC.id,
      },
    });
    villageCPlayers.push({ id: player.id, username: p.user.username, role: p.role, status: p.status });
  }

  const [pcTaro, pcHanako, pcYuuki, pcSakura, pcRen] = villageCPlayers;

  // Rooms
  const [roomCMain, roomCWolf, roomCDead] = await Promise.all([
    prisma.room.create({ data: { type: "MAIN", villageId: villageC.id } }),
    prisma.room.create({ data: { type: "WOLF", villageId: villageC.id } }),
    prisma.room.create({ data: { type: "DEAD", villageId: villageC.id } }),
  ]);

  // Day 1 Records
  const day1CVoteTargets = [
    { player: pcTaro, target: pcRen },
    { player: pcHanako, target: pcYuuki },
    { player: pcYuuki, target: pcTaro },
    { player: pcSakura, target: pcYuuki },
    { player: pcRen, target: pcYuuki },
  ];

  for (const { player, target } of day1CVoteTargets) {
    const data: Record<string, unknown> = {
      day: 1,
      playerId: player.id,
      villageId: villageC.id,
      voteTargetId: target.id,
    };

    // 占い師(はなこ): ゆうき を占う
    if (player.id === pcHanako.id) {
      data.divineTargetId = pcYuuki.id;
    }
    // 人狼(ゆうき): さくら を襲撃
    if (player.id === pcYuuki.id) {
      data.attackTargetId = pcSakura.id;
    }

    await prisma.record.create({ data: data as never });
  }

  // Day 1 Result: 投票でゆうき処刑はDay1ではまだ (多数決でゆうきだが、ストーリー上Day1はさくらが襲撃される)
  // 修正: Day 1 は誰も処刑せず（初日処刑なし or ストーリーに合わせて調整）
  // ストーリー: Day 1 投票はゆうきが最多票だが実際は処刑される。さくらが襲撃される。
  // → Day 1: さくら襲撃死 + ゆうき処刑? → 5人→3人は早すぎる
  // → Day 1: 投票分散で処刑なし or ゆうき以外に投票 → さくら襲撃死
  // シンプルに: Day 1 投票でれん処刑（ミスリード）、さくら襲撃死
  // いや、計画に合わせて Day 2 で終了。Day 1: さくら襲撃死。Day 2: ゆうき処刑で人狼全滅→HUMANS勝利

  // Day 1 Result: 投票は分散（処刑なし扱い or 再投票）→ さくら襲撃死
  // 簡略化: Day 1 は誰か処刑 + さくら襲撃死。ここでは「ゆうき」以外を処刑して、Day2でゆうきを処刑して勝利
  // → でもそうすると5人→3人→2人でゲーム状態がおかしい
  // 最もシンプル: Day 1 投票なし（初日は投票スキップ）、さくら襲撃死。Day 2 ゆうき処刑→人狼全滅→勝利

  await prisma.result.create({
    data: {
      day: 1,
      villageId: villageC.id,
      votedPlayerId: null, // 初日投票なし
      attackedPlayerId: pcSakura.id,
      divinedPlayerId: pcYuuki.id,
      guardedPlayerId: null,
    },
  });

  // Day 2 Records
  // 生存者: たろう, はなこ, ゆうき, れん (さくらは Day 1 で死亡)
  const day2CVoteTargets = [
    { player: pcTaro, target: pcYuuki },
    { player: pcHanako, target: pcYuuki },
    { player: pcYuuki, target: pcTaro },
    { player: pcRen, target: pcYuuki },
  ];

  for (const { player, target } of day2CVoteTargets) {
    const data: Record<string, unknown> = {
      day: 2,
      playerId: player.id,
      villageId: villageC.id,
      voteTargetId: target.id,
    };

    // 占い師(はなこ): Day 2 は占い済みのためスキップ可 or 別の人を占う
    if (player.id === pcHanako.id) {
      data.divineTargetId = pcRen.id;
    }
    // 人狼(ゆうき): たろう を襲撃（しかし処刑で先に死ぬので実行されない）
    if (player.id === pcYuuki.id) {
      data.attackTargetId = pcTaro.id;
    }

    await prisma.record.create({ data: data as never });
  }

  // Day 2 Result: ゆうき処刑→人狼全滅→HUMANS勝利
  await prisma.result.create({
    data: {
      day: 2,
      villageId: villageC.id,
      votedPlayerId: pcYuuki.id,
      attackedPlayerId: null, // 人狼処刑済みのため襲撃なし
      divinedPlayerId: pcRen.id,
      guardedPlayerId: null,
    },
  });

  // Posts for Village C
  const cMainPosts = [
    { playerId: pcTaro.id, content: "少人数だけどがんばろう！", day: 1 },
    { playerId: pcHanako.id, content: "初日だし情報集めよう", day: 1 },
    { playerId: null, content: "夜が明けました。さくら が襲撃されました。", day: 1, owner: "SYSTEM" as const },
    { playerId: pcHanako.id, content: "昨日ゆうきを占ったら人狼だった！", day: 2 },
    { playerId: pcTaro.id, content: "ゆうきに投票しよう", day: 2 },
    { playerId: pcRen.id, content: "同意！", day: 2 },
    { playerId: null, content: "投票の結果、ゆうき が処刑されました。", day: 2, owner: "SYSTEM" as const },
    { playerId: null, content: "人狼が全滅しました。村人陣営の勝利です！", day: 2, owner: "SYSTEM" as const },
  ];

  for (const post of cMainPosts) {
    await prisma.post.create({
      data: {
        content: post.content,
        day: post.day,
        owner: post.owner ?? "PLAYER",
        playerId: post.playerId,
        roomId: roomCMain.id,
      },
    });
  }

  // Wolf room
  await prisma.post.create({
    data: {
      content: "さくらを襲撃する",
      day: 1,
      owner: "PLAYER",
      playerId: pcYuuki.id,
      roomId: roomCWolf.id,
    },
  });

  // Dead room
  await prisma.post.create({
    data: {
      content: "やられた〜",
      day: 1,
      owner: "PLAYER",
      playerId: pcSakura.id,
      roomId: roomCDead.id,
    },
  });

  console.log(`  ✓ ${villageC.name} (players: 5/5, winner: HUMANS)`);

  // ----------------------------------------------------------
  // Done
  // ----------------------------------------------------------
  console.log("\n✅ Seed completed successfully!");
  console.log(`   Users: ${dbUsers.length}`);
  console.log(`   Villages: 3 (NOT_STARTED, IN_PLAY, ENDED)`);
  console.log(`\n   Login: taro@example.com / ${SHARED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
