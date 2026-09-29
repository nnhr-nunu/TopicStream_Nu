import { describe, expect, it } from "vitest";

import { isPublicSafe, looksAbusive, looksPersonal } from "@/lib/public-text";

describe("looksPersonal", () => {
  it("連絡先・URL・@ID は個人につながるとみなす", () => {
    expect(looksPersonal("https://example.com")).toBe(true);
    expect(looksPersonal("090-1234-5678")).toBe(true);
    expect(looksPersonal("連絡は@someone_ まで")).toBe(true);
    expect(looksPersonal("〒150-0001")).toBe(true);
  });

  it("住所の書き方も個人につながるとみなす", () => {
    expect(looksPersonal("渋谷区神南1-2-3に住んでる人")).toBe(true);
    expect(looksPersonal("3丁目5番の家")).toBe(true);
    expect(looksPersonal("123番地の話")).toBe(true);
    expect(looksPersonal("2番5号のアパート")).toBe(true);
  });

  it("ID の書き方も個人につながるとみなす", () => {
    expect(looksPersonal("ID: taro_1234")).toBe(true);
    expect(looksPersonal("ユーザー名はhanako99")).toBe(true);
    expect(looksPersonal("mike#1234 に連絡")).toBe(true);
  });

  it("数字やサービス名を含むだけの話題は通す", () => {
    expect(looksPersonal("100均の神")).toBe(false);
    expect(looksPersonal("2024年のベスト")).toBe(false);
    expect(looksPersonal("三丁目の夕日")).toBe(false);
    expect(looksPersonal("404号室の怖い話")).toBe(false);
    expect(looksPersonal("LINEスタンプの使い方")).toBe(false);
    expect(looksPersonal("LINE MUSIC の話")).toBe(false);
  });
});

describe("looksAbusive", () => {
  it("他人に向けた暴言・脅しは止める", () => {
    for (const text of ["あいつ死ね", "死ねよ", "タヒね", "殺すぞ", "ぶっ殺す", "殺してやる", "消えろ", "自殺しろ", "死 ね"]) {
      expect(looksAbusive(text), text).toBe(true);
    }
  });

  it("晒し・特定・凸の呼びかけは止める", () => {
    for (const text of ["住所を晒す", "本名晒そう", "本名特定しよう", "特定班集合", "電凸しよう", "晒し上げ"]) {
      expect(looksAbusive(text), text).toBe(true);
    }
  });

  it("よく知られた差別語は止める", () => {
    for (const text of ["キチガイ", "ガイジ", "支那人", "チョン公"]) {
      expect(looksAbusive(text), text).toBe(true);
    }
  });

  it("重い悩み・名前の出ない愚痴は止めない（お悩み相談で普通に出る）", () => {
    for (const text of [
      "死にたい",
      "消えたい",
      "死にたいと思う夜",
      "自殺したいほどつらい",
      "リストカットがやめられない",
      "いじめられている",
      "親に殴られる",
      "元カレがクズだった",
      "上司が無能すぎる",
      "死ねない理由",
      "死ねばいいのにと思ってしまう",
      "SNSで晒された",
      "個人情報を特定された",
    ]) {
      expect(looksAbusive(text), text).toBe(false);
    }
  });

  it("同じ文字を含むだけのふつうの語は止めない", () => {
    for (const text of [
      "殺人事件のミステリー",
      "推理小説のトリック",
      "シネマ",
      "支那そば",
      "ちょんまげ",
      "土人形",
      "郷土料理",
      "凸凹コンビ",
      "布団を日光に晒す",
      "外人から見た日本",
      "かたわらに置く本",
      "原因を特定する",
      // 本番の図鑑にある配信・ゲームの言葉
      "完凸までの総額",
      "凸待ちの思い出",
      "初見殺しのギミック",
      "ガチャ爆死",
    ]) {
      expect(looksAbusive(text), text).toBe(false);
    }
  });
});

describe("isPublicSafe", () => {
  it("個人情報も攻撃する言葉も無いものだけ公開してよい", () => {
    expect(isPublicSafe("休日の過ごし方")).toBe(true);
    expect(isPublicSafe("死にたい")).toBe(true);
    expect(isPublicSafe("090-1234-5678")).toBe(false);
    expect(isPublicSafe("あいつ死ね")).toBe(false);
  });
});
