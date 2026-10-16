import { describe, expect, it } from "vitest";

import { boardLooksCrisis, HOTLINES, looksCrisis, looksCrisisCard } from "@/lib/crisis";

describe("looksCrisis（人が書いたお題）", () => {
  it("死にたい・消えたい・自傷などで出す", () => {
    expect(looksCrisis("死にたい")).toBe(true);
    expect(looksCrisis("もう消えたい夜")).toBe(true);
    expect(looksCrisis("リスカがやめられない")).toBe(true);
    expect(looksCrisis("首吊りのニュース")).toBe(true);
  });

  it("「首を」だけの遊びの語や大げさな言い回しでは出さない", () => {
    expect(looksCrisis("首を寝違えた")).toBe(false);
    expect(looksCrisis("首を傾げる子猫")).toBe(false);
    expect(looksCrisis("死ぬほど眠い")).toBe(false);
    expect(looksCrisis("好きな季節")).toBe(false);
  });
});

describe("looksCrisisCard（AI のカード）", () => {
  it("言葉だけで重いと決められる語で出す", () => {
    expect(looksCrisisCard("生きるのがつらい日")).toBe(true);
    expect(looksCrisisCard("自傷のきっかけ")).toBe(true);
  });

  it("本番や遊びで出る語では出さない", () => {
    expect(looksCrisisCard("ボスに殴られた話")).toBe(false);
    expect(looksCrisisCard("崖から飛び降りる")).toBe(false);
    expect(looksCrisisCard("理不尽すぎて首を振ったエピソード")).toBe(false);
    expect(looksCrisisCard("雷が土壌へ届け込む栄養の窒素")).toBe(false);
  });
});

describe("boardLooksCrisis", () => {
  const node = (label: string, parentId: string | null) => ({ data: { label, parentId } });

  it("最初のお題は広い判定、カードは狭い判定で見る", () => {
    expect(boardLooksCrisis([node("親に殴られた", null)])).toBe(true);
    expect(boardLooksCrisis([node("ゲームの思い出", null), node("ボスに殴られた話", "root")])).toBe(false);
    expect(boardLooksCrisis([node("眠れない夜", null), node("消えたいと思う瞬間", "root")])).toBe(true);
  });
});

describe("HOTLINES", () => {
  it("電話の窓口と、まもろうよ こころへのリンクがある", () => {
    expect(HOTLINES.filter((line) => line.tel).length).toBeGreaterThanOrEqual(4);
    expect(HOTLINES.at(-1)?.url).toContain("mamorouyokokoro");
  });
});
