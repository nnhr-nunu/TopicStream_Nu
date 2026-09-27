// 使い方の画像（public/guide/*.webp）を撮り直す。
// 開発サーバーを起動した状態で: node scripts/capture-guide.mjs [http://127.0.0.1:43173]
// 追加のパッケージは使わず、Edge / Chrome をヘッドレスで起動して DevTools プロトコルで操作する。
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:43173").replace(/\/$/, "");
const OUT = path.resolve("public/guide");
const WIDTH = 1200;
const HEIGHT = 750;
const PORT = 9333;

const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const browserPath = process.env.BROWSER_PATH ?? BROWSERS.find((item) => existsSync(item));
if (!browserPath) throw new Error("Edge / Chrome が見つかりません（BROWSER_PATH で指定できます）");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(path.join(tmpdir(), "ts-capture-"));
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--hide-scrollbars",
    "--lang=ja-JP",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function pageSocketUrl() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((item) => item.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* 起動待ち */
    }
    await sleep(200);
  }
  throw new Error("ブラウザに接続できません");
}

const socket = new WebSocket(await pageSocketUrl());
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
function send(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) =>
    pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result))),
  );
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? expression);
  return result.result.value;
}
async function waitFor(expression, timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression).catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`待ちきれませんでした: ${expression}`);
}
/** 文を含むカードの中心（画面上の座標） */
async function cardCenter(text) {
  return evaluate(`(() => {
    const chip = [...document.querySelectorAll('.topic-chip')].find((el) => el.textContent.includes(${JSON.stringify(text)}));
    if (!chip) return null;
    const r = chip.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
}
/** 文を含むカードの枠 */
async function cardRect(text) {
  return evaluate(`(() => {
    const chip = [...document.querySelectorAll('.topic-chip')].find((el) => el.textContent.includes(${JSON.stringify(text)}));
    const r = chip.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })()`);
}
async function mouse(type, x, y, extra = {}) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
}
async function click(x, y) {
  await mouse("mouseMoved", x, y, { button: "none" });
  await mouse("mousePressed", x, y);
  await mouse("mouseReleased", x, y);
}
async function pressKey(key) {
  // 入力欄にフォーカスが残っているとショートカットが効かないので外してから押す
  await evaluate(`document.activeElement instanceof HTMLElement && document.activeElement.blur(); true`);
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true })); true`);
}
/** カーソルを外してメニューを閉じ、全体を画面に合わせる */
async function settle() {
  await mouse("mouseMoved", 5, 5, { button: "none" });
  await sleep(700);
  await pressKey("0");
  await sleep(900);
}
async function shot(name) {
  // 画面の外に出るトースト・開発用の表示は写さない
  await evaluate(`document.documentElement.classList.add('ts-capture')`);
  await sleep(350);
  const { data } = await send("Page.captureScreenshot", { format: "webp", quality: 82 });
  writeFileSync(path.join(OUT, `${name}.webp`), Buffer.from(data, "base64"));
  console.log(`saved ${name}.webp`);
}
const HIDE_CSS = `
  .ts-capture nextjs-portal, .ts-capture [data-sonner-toaster], .ts-capture .privacy-notice { display: none !important; }
  .ts-capture * { caret-color: transparent !important; }
  .ts-capture .topic-sheet, .ts-capture .topic-sheet-backdrop { animation: none !important; }
`;

try {
  mkdirSync(OUT, { recursive: true });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    // ヘッドレスでは指の端末（pointer: coarse）を真似できないので、スマホのメニューを撮るときだけ差し替える
    source: `if (sessionStorage.getItem('ts-capture-coarse') === '1') {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => (/pointer:\\s*coarse/.test(query) ? original('(min-width: 0px)') : original(query));
    }
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(HIDE_CSS)};
      document.head.append(style);
    });`,
  });

  // まっさらな状態から（ヒントは見たことにしておく）
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`document.readyState === 'complete'`);
  await evaluate(`localStorage.clear(); localStorage.setItem('topicstream-nu:hint-hold-v1', '1'); true`);
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`!!document.querySelector('input[aria-label="開始キーワード"]')`);
  await sleep(800);

  // ① お題を入れる
  const input = await evaluate(`(() => { const r = document.querySelector('input[aria-label="開始キーワード"]').getBoundingClientRect(); return { x: r.x + 40, y: r.y + r.height / 2 }; })()`);
  await click(input.x, input.y);
  await send("Input.insertText", { text: "夏休みの思い出" });
  await sleep(300);
  await shot("start");

  // ② 広げる（最初の 8 つ → 1 枚タップしてもう 1 段）
  await evaluate(`[...document.querySelectorAll('button')].find((el) => el.textContent.trim().startsWith('始める'))?.click(); true`);
  await waitFor(`document.querySelectorAll('.topic-chip:not(.topic-chip-skeleton)').length >= 9`);
  await evaluate(`[...document.querySelectorAll('.mode-dock-option')].find((el) => el.textContent.includes('抽象展開'))?.click(); true`);
  await sleep(2200);
  const firstKeyword = await evaluate(`[...document.querySelectorAll('.topic-chip-keyword .topic-label')][2]?.textContent ?? ''`);
  const target = await cardCenter(firstKeyword);
  await click(target.x, target.y);
  await waitFor(`document.querySelectorAll('.topic-chip:not(.topic-chip-skeleton)').length >= 18`);
  await sleep(2600);
  await settle();
  await shot("expand");

  // ④ 重ねて掛け合わせ（ドラッグ中を撮る）
  const labels = await evaluate(`[...document.querySelectorAll('.topic-chip-keyword .topic-label')].map((el) => el.textContent)`);
  const [fromLabel, toLabel] = [labels[labels.length - 1], labels[labels.length - 3]];
  // 持ったカードが相手の文を隠さないよう、左下をつかんで相手の右上に重ねる
  const fromBox = await cardRect(fromLabel);
  const toBox = await cardRect(toLabel);
  const from = { x: fromBox.left + fromBox.width * 0.15, y: fromBox.top + fromBox.height * 0.8 };
  const to = { x: toBox.left + toBox.width * 0.85, y: toBox.top + toBox.height * 0.2 - 10 };
  await mouse("mouseMoved", from.x, from.y, { button: "none" });
  await mouse("mousePressed", from.x, from.y);
  for (let i = 1; i <= 12; i += 1) {
    await mouse("mouseMoved", from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12 + 10, { buttons: 1 });
    await sleep(30);
  }
  await sleep(300);
  await shot("combine");
  await mouse("mouseReleased", to.x, to.y + 10);
  await sleep(3000);

  // ⑤ 具体的: 切り替えてから、いま見えている（掛け合わせでできた）カードをタップ
  await evaluate(`[...document.querySelectorAll('.mode-dock-option')].find((el) => el.textContent.includes('具体的'))?.click(); true`);
  await mouse("mouseMoved", 5, 5, { button: "none" });
  await sleep(700);
  const detailTarget = await evaluate(`(() => {
    const chip = [...document.querySelectorAll('.topic-chip-keyword')].find((el) => {
      const r = el.getBoundingClientRect();
      return !el.querySelector('.topic-opened') && r.left > 280 && r.right < 1100 && r.top > 140 && r.bottom < 620;
    });
    const r = chip.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  // ヘッドレスではタップが取りこぼされることがあるので、出てこなければ押し直す
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await click(detailTarget.x, detailTarget.y);
    const started = await waitFor(`document.querySelectorAll('.topic-chip-detail, .topic-chip-skeleton').length > 0`, 2500)
      .then(() => true)
      .catch(() => false);
    if (started) break;
    await sleep(500);
  }
  await waitFor(`document.querySelectorAll('.topic-chip-detail').length >= 8`);
  await sleep(2600);
  // 出た答えのところに寄ったまま撮る（全体に合わせると文が小さくて読めない）
  await mouse("mouseMoved", 5, 5, { button: "none" });
  await sleep(800);
  await shot("detail");
  await evaluate(`[...document.querySelectorAll('.mode-dock-option')].find((el) => el.textContent.includes('抽象展開'))?.click(); true`);

  // ③ 長押しでメニュー（スマホの形: 下から出るメニュー）。指の端末として開き直し、続きからボードを開く
  await evaluate(`sessionStorage.setItem('ts-capture-coarse', '1'); true`);
  await send("Page.navigate", { url: `${BASE}/` });
  await waitFor(`[...document.querySelectorAll('*')].some((el) => el.textContent === '夏休みの思い出')`);
  await sleep(600);
  await evaluate(`(() => {
    const label = [...document.querySelectorAll('*')].find((el) => el.textContent === '夏休みの思い出' && !el.closest('header, nav'));
    (label.closest('button, a, [role="button"]') ?? label).click();
    return true;
  })()`);
  await waitFor(`document.querySelectorAll('.topic-chip').length >= 9`);
  await sleep(1500);
  await pressKey("0");
  await sleep(900);
  await evaluate(`(async () => {
    const chip = [...document.querySelectorAll('.topic-chip')].find((el) => el.textContent.includes(${JSON.stringify("__LABEL__")}));
    const r = chip.getBoundingClientRect();
    const ev = (type) => chip.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'touch', isPrimary: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev('pointerdown');
    await new Promise((resolve) => setTimeout(resolve, 650));
    ev('pointerup');
    return true;
  })()`.replace("__LABEL__", firstKeyword));
  await waitFor(`!!document.querySelector('.topic-sheet')`);
  await sleep(1500);
  await shot("menu");
  await evaluate(`document.querySelector('.topic-sheet-close')?.click(); sessionStorage.removeItem('ts-capture-coarse'); true`);
} catch (error) {
  // どこで止まったか見られるよう、そのときの画面を残す
  const { data } = await send("Page.captureScreenshot", { format: "png" }).catch(() => ({ data: "" }));
  if (data) writeFileSync(path.join(tmpdir(), "ts-capture-failed.png"), Buffer.from(data, "base64"));
  console.error(`止まったときの画面: ${path.join(tmpdir(), "ts-capture-failed.png")}`);
  throw error;
} finally {
  socket.close();
  browser.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
