import { describe, expect, test } from "vitest";
import {
  startMessage,
  voteResultMessage,
  noVoteMessage,
  morningMessage,
  gameEndMessage,
  wolfAttackSetMessage,
} from "../system-messages";

describe("startMessage", () => {
  test("人狼が1人の場合、メッセージに人数が含まれる", () => {
    const msg = startMessage(1);
    expect(msg).toContain("ゲームが開始されました。");
    expect(msg).toContain("人狼が1人");
  });

  test("人狼が3人の場合、メッセージに人数が含まれる", () => {
    const msg = startMessage(3);
    expect(msg).toContain("人狼が3人");
  });

  test("村人への呼びかけメッセージが含まれる", () => {
    const msg = startMessage(2);
    expect(msg).toContain("村人たちよ");
  });
});

describe("voteResultMessage", () => {
  const votes = [
    { voterName: "アリス", targetName: "ボブ" },
    { voterName: "チャーリー", targetName: "ボブ" },
    { voterName: "ボブ", targetName: "アリス" },
  ];

  describe("showVoteTarget=true の場合", () => {
    test("誰が誰に投票したかの詳細が表示される", () => {
      const msg = voteResultMessage(votes, "ボブ", true);
      expect(msg).toContain("アリス は ボブ に投票しました。");
      expect(msg).toContain("チャーリー は ボブ に投票しました。");
      expect(msg).toContain("ボブ は アリス に投票しました。");
    });

    test("処刑メッセージが含まれる", () => {
      const msg = voteResultMessage(votes, "ボブ", true);
      expect(msg).toContain("ボブ は村人たちの手によって処刑されました。");
    });
  });

  describe("showVoteTarget=false の場合", () => {
    test("得票数のみが表示される", () => {
      const msg = voteResultMessage(votes, "ボブ", false);
      expect(msg).toContain("ボブ は 2票でした。");
      expect(msg).toContain("アリス は 1票でした。");
    });

    test("誰が誰に投票したかの詳細は表示されない", () => {
      const msg = voteResultMessage(votes, "ボブ", false);
      expect(msg).not.toContain("に投票しました");
    });

    test("処刑メッセージが含まれる", () => {
      const msg = voteResultMessage(votes, "ボブ", false);
      expect(msg).toContain("ボブ は村人たちの手によって処刑されました。");
    });

    test("得票数が多い順に表示される", () => {
      const msg = voteResultMessage(votes, "ボブ", false);
      const bobPos = msg.indexOf("ボブ は 2票");
      const alicePos = msg.indexOf("アリス は 1票");
      expect(bobPos).toBeLessThan(alicePos);
    });
  });

  test("投票が1件の場合も処刑メッセージが含まれる", () => {
    const singleVote = [{ voterName: "アリス", targetName: "ボブ" }];
    const msg = voteResultMessage(singleVote, "ボブ", true);
    expect(msg).toContain("ボブ は村人たちの手によって処刑されました。");
  });
});

describe("noVoteMessage", () => {
  test("投票なしメッセージが含まれる", () => {
    const msg = noVoteMessage("デイブ");
    expect(msg).toContain("投票がありませんでした");
    expect(msg).toContain("ランダムで処刑対象が選ばれます");
  });

  test("処刑されたプレイヤー名が含まれる", () => {
    const msg = noVoteMessage("デイブ");
    expect(msg).toContain("デイブ は村人たちの手によって処刑されました。");
  });
});

describe("morningMessage", () => {
  test("犠牲者がいる場合、犠牲者の名前が含まれる", () => {
    const msg = morningMessage(2, "イブ");
    expect(msg).toContain("2日目の朝が来ました。");
    expect(msg).toContain("イブ が変わり果てた姿で見つかりました。");
  });

  test("犠牲者がいない場合（null）、誰も犠牲にならなかったメッセージが表示される", () => {
    const msg = morningMessage(3, null);
    expect(msg).toContain("3日目の朝が来ました。");
    expect(msg).toContain("昨晩は誰も犠牲にならなかったようだ。");
  });

  test("犠牲者がいない場合、犠牲者名は含まれない", () => {
    const msg = morningMessage(1, null);
    expect(msg).not.toContain("変わり果てた姿");
  });

  test("1日目の朝メッセージ（犠牲者あり）", () => {
    const msg = morningMessage(1, "フランク");
    expect(msg).toContain("1日目の朝が来ました。");
    expect(msg).toContain("フランク が変わり果てた姿で見つかりました。");
  });
});

describe("gameEndMessage", () => {
  const players = [
    { username: "アリス", role: "VILLAGER" },
    { username: "ボブ", role: "WEREWOLF" },
    { username: "チャーリー", role: "FORTUNE_TELLER" },
  ];

  test("村人陣営が勝利した場合、勝利メッセージに村人陣営と表示される", () => {
    const msg = gameEndMessage("HUMANS", players);
    expect(msg).toContain("ゲームが終了しました。");
    expect(msg).toContain("村人陣営の勝利です！");
  });

  test("人狼陣営が勝利した場合、勝利メッセージに人狼陣営と表示される", () => {
    const msg = gameEndMessage("WEREWOLVES", players);
    expect(msg).toContain("人狼陣営の勝利です！");
  });

  test("配役セクションが表示される", () => {
    const msg = gameEndMessage("HUMANS", players);
    expect(msg).toContain("【配役】");
  });

  test("各プレイヤーの役職が日本語で表示される", () => {
    const msg = gameEndMessage("HUMANS", players);
    expect(msg).toContain("アリス: 村人");
    expect(msg).toContain("ボブ: 人狼");
    expect(msg).toContain("チャーリー: 占い師");
  });

  test("未知の役職はそのまま表示される", () => {
    const playersWithUnknown = [{ username: "グレース", role: "UNKNOWN_ROLE" }];
    const msg = gameEndMessage("HUMANS", playersWithUnknown);
    expect(msg).toContain("グレース: UNKNOWN_ROLE");
  });

  test("プレイヤーが空の場合でも配役セクションが表示される", () => {
    const msg = gameEndMessage("WEREWOLVES", []);
    expect(msg).toContain("【配役】");
    expect(msg).toContain("人狼陣営の勝利です！");
  });
});

describe("wolfAttackSetMessage", () => {
  test("人狼名と対象名が含まれた襲撃セットメッセージを返す", () => {
    const msg = wolfAttackSetMessage("ボブ", "アリス");
    expect(msg).toBe("ボブ が アリス を襲撃対象にセットしました。");
  });

  test("異なるプレイヤー名でも正しいメッセージを返す", () => {
    const msg = wolfAttackSetMessage("人狼太郎", "村人花子");
    expect(msg).toContain("人狼太郎");
    expect(msg).toContain("村人花子");
    expect(msg).toContain("襲撃対象にセットしました");
  });
});
