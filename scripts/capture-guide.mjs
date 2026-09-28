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
/** 画面は 2 倍の細かさで描き、要所を 16:10 で切り抜く（切り抜いた分だけ大きく見せても粗くならない） */
const DPR = 2;

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
/** 解説の AI の返事（キーが無くても撮れるよう、ここで返す） */
const EXPLAIN_SAMPLES = {
  花火大会:
    "夏の夜に河川敷や海岸で大量の打ち上げ花火を上げる催し。江戸時代の両国の川開きが起源とされ、浴衣で出かける夏の風物詩として定着している。",
  宿題は最終日:
    "夏休みの宿題を休みの最終日にまとめて片付けること。計画を後回しにしがちな子どもの定番の失敗談として、大人になってからもよく語られる。",
  日焼けの跡:
    "日光に当たった部分だけ肌が黒くなり、服や水着の形がくっきり残った状態。夏にどれだけ外で遊んだかの目安として話題にされることが多い。",
  プールの匂い:
    "学校や市民プールで感じる、消毒用の塩素の独特な匂い。夏休みや水泳の授業の記憶と強く結びつき、匂いで当時を思い出す人も多い。",
  大人の夏休み:
    "社会人が取る夏季休暇や、大人になってから過ごす夏の休み。子どもの頃より短い一方、旅行や趣味に自分のお金と裁量で使えるのが特徴である。",
  虫取り:
    "網や虫かごを持って野山や公園で昆虫を捕まえる遊び。カブトムシやセミが定番で、夏休みの自由研究の題材にもよく選ばれる。",
  ラジオ体操:
    "ラジオ放送に合わせて行う国民的な体操。夏休みには地域で朝に集まって行い、参加するとカードに判を押してもらう習慣がある。",
  夏祭りの屋台:
    "夏祭りの会場に並ぶ仮設の店。焼きそば・かき氷・金魚すくい・射的などが定番で、祭りの雰囲気を作る存在である。",
  自由研究:
    "夏休みの宿題の一つで、児童・生徒が自分でテーマを決めて調べ、結果をまとめる課題。観察・実験・工作など形式は自由で、休み明けに校内で展示されることも多い。",
};
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Fetch.requestPaused") {
    const { requestId, request } = message.params;
    const label = JSON.parse(request.postData ?? "{}").label ?? "";
    const text = EXPLAIN_SAMPLES[label] ?? "";
    const body = JSON.stringify({ text, source: "gemini", query: label });
    void send("Fetch.fulfillRequest", {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }],
      body: Buffer.from(body).toString("base64"),
    });
    return;
  }
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
/**
 * 見てほしい所の枠（式が返す要素をまとめた範囲）に余白を足し、16:10 に広げる。
 * 小さく切りすぎると文字が大きくなりすぎるので、幅は minWidth より狭くしない
 */
async function focusOn(elementsExpression, { pad = 28, minWidth = 560 } = {}) {
  await captureMode();
  const box = await evaluate(`(() => {
    // 画面の外にはみ出した分は数えない
    const rects = (${elementsExpression})
      .filter(Boolean)
      .map((el) => el.getBoundingClientRect())
      .map((r) => ({ left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(innerWidth, r.right), bottom: Math.min(innerHeight, r.bottom) }))
      .filter((r) => r.right > r.left && r.bottom > r.top);
    if (!rects.length) return null;
    return {
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      right: Math.max(...rects.map((r) => r.right)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
  })()`);
  if (!box) throw new Error(`切り抜く所が見つかりません: ${elementsExpression}`);
  const ratio = WIDTH / HEIGHT;
  let width = Math.max(minWidth, box.right - box.left + pad * 2, (box.bottom - box.top + pad * 2) * ratio);
  width = Math.min(width, WIDTH);
  const height = width / ratio;
  const clamp = (value, size, max) => Math.max(0, Math.min(max - size, value));
  const x = clamp((box.left + box.right) / 2 - width / 2, width, WIDTH);
  const y = clamp((box.top + box.bottom) / 2 - height / 2, height, HEIGHT);
  return { x, y, width, height };
}
/** 画面の外に出るトースト・開発用の表示を隠し、出てくる途中の動きも止める（読み込み時に付けているが念のため） */
async function captureMode() {
  await evaluate(`document.documentElement.classList.add('ts-capture')`);
  // ヘッドレスでは撮るまで描画が進まず、盤面の寄せ・引きの動きが撮った瞬間に進んでしまう。
  // 何度か空撮りして動きを終わらせてから測る・撮る
  for (let i = 0; i < 4; i += 1) {
    await send("Page.captureScreenshot", { format: "jpeg", quality: 1 });
    await sleep(250);
  }
}
async function shot(name, region) {
  await captureMode();
  const area = region ?? { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  const { data } = await send("Page.captureScreenshot", {
    format: "webp",
    quality: 82,
    // scale を 1 以外にすると、撮ったあとも盤面の拡大率がずれたままになるので等倍で撮る
    clip: { ...area, scale: 1 },
  });
  writeFileSync(path.join(OUT, `${name}.webp`), Buffer.from(data, "base64"));
  console.log(`saved ${name}.webp`);
}
const HIDE_CSS = `
  .ts-capture nextjs-portal, .ts-capture [data-sonner-toaster], .ts-capture .privacy-notice { display: none !important; }
  .ts-capture * { caret-color: transparent !important; }
  .ts-capture .topic-sheet, .ts-capture .topic-sheet-backdrop { animation: none !important; }
  .ts-capture .ts-open-memo .topic-memo-tag-full { display: block !important; }
  .ts-capture .react-flow__node:has(.ts-open-memo) { z-index: 1000 !important; }
`;

try {
  mkdirSync(OUT, { recursive: true });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/explain*", requestStage: "Request" }] });
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: DPR, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    // ヘッドレスでは指の端末（pointer: coarse）を真似できないので、スマホのメニューを撮るときだけ差し替える
    source: `if (sessionStorage.getItem('ts-capture-coarse') === '1') {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => (/pointer:\\s*coarse/.test(query) ? original('(min-width: 0px)') : original(query));
    }
    // 撮る直前に隠すと盤面の大きさが変わって合わせ直されるので、最初から隠しておく
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = ${JSON.stringify(HIDE_CSS)};
      document.head.append(style);
      document.documentElement.classList.add('ts-capture');
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
  await shot(
    "start",
    await focusOn(`[document.querySelector('h1'), document.querySelector('input[aria-label="開始キーワード"]'), ...[...document.querySelectorAll('p')].filter((el) => el.textContent === '人気のお題から始める').map((el) => el.nextElementSibling)]`),
  );

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
  // 押したカードと、そこから広がった 8 つ
  await shot(
    "expand",
    await focusOn(`[...document.querySelectorAll('.topic-chip')].filter((el) => el.textContent.includes(${JSON.stringify(firstKeyword)}) || /^2[A-I]/.test(el.textContent.trim()))`),
  );

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
  await shot(
    "combine",
    await focusOn(`[...document.querySelectorAll('.topic-chip')].filter((el) => [${JSON.stringify(fromLabel)}, ${JSON.stringify(toLabel)}].some((label) => el.textContent.includes(label)))`, { pad: 60 }),
  );
  await mouse("mouseReleased", to.x, to.y + 10);
  await sleep(3000);

  // ⑥ 解説を付箋に貼る（メニューの「解説」→ 付箋の全文を開いて見せる）
  await settle();
  // 見本のあるカードのうち、画面の真ん中に近いもの（端だと全文が画面の外にはみ出す）。
  // 「+」やドラッグで寄せると撮る瞬間に元へ戻ってしまうので、全体に合わせたまま切り抜く
  const explainLabel = await evaluate(`(() => {
    const samples = ${JSON.stringify(Object.keys(EXPLAIN_SAMPLES))};
    const distance = (el) => {
      const r = el.getBoundingClientRect();
      return Math.hypot(r.x + r.width / 2 - ${WIDTH / 2}, r.y + r.height / 2 - ${HEIGHT / 2});
    };
    const hits = [...document.querySelectorAll('.topic-label')].filter((el) => samples.includes(el.textContent));
    hits.sort((a, b) => distance(a) - distance(b));
    return hits[0]?.textContent ?? null;
  })()`);
  if (!explainLabel) throw new Error("解説の見本に合うカードがありません（EXPLAIN_SAMPLES に足してください）");
  const explainNode = `[...document.querySelectorAll('.react-flow__node')].find((el) => el.querySelector('.topic-label')?.textContent === ${JSON.stringify(explainLabel)})`;
  await evaluate(`${explainNode}.querySelector('[aria-label="解説を付箋に貼る"]').click(); true`);
  await waitFor(`!!${explainNode}.querySelector('.topic-memo-tag')`, 10_000);
  // 付箋が付いたあと盤面が少し動くので、止まってから測る
  await mouse("mouseMoved", 5, 5, { button: "none" });
  await sleep(2500);
  // 付箋の全文（ふだんはカーソルを乗せると出る）を開いた状態にする
  await evaluate(`${explainNode}.querySelector('.topic-memo-tag').classList.add('ts-open-memo'); true`);
  const explainParts = `[${explainNode}.querySelector('.topic-chip'), ${explainNode}.querySelector('.topic-memo-tag-full')]`;
  await shot("explain", await focusOn(explainParts, { pad: 32, minWidth: 480 }));
  await evaluate(`${explainNode}.querySelector('.topic-memo-tag').classList.remove('ts-open-memo'); true`);
  await settle();

  // ⑤ 具体的: 見えている（掛け合わせでできた）カードを具体化する。
  // ヘッドレスではタップが取りこぼされやすいので、カードのメニューの「具体化」を押す（タップと同じ動き）
  await mouse("mouseMoved", 5, 5, { button: "none" });
  await sleep(700);
  const chipCount = `document.querySelectorAll('.topic-chip:not(.topic-chip-skeleton)').length`;
  // 掛け合わせの 8 つが出そろってから数える
  await waitFor(`!document.querySelector('.topic-chip-skeleton, .topic-chip-busy')`);
  await sleep(500);
  const before = await evaluate(chipCount);
  await evaluate(`(() => {
    const node = [...document.querySelectorAll('.react-flow__node')].find((el) => {
      const chip = el.querySelector('.topic-chip-keyword');
      const r = chip?.getBoundingClientRect();
      return r && !chip.querySelector('.topic-opened') && r.left > 280 && r.right < 1100 && r.top > 140 && r.bottom < 620;
    });
    node.querySelector('[aria-label^="具体化"]').click();
    return true;
  })()`);
  await waitFor(`${chipCount} >= ${before + 8} && !document.querySelector('.topic-chip-skeleton, .topic-chip-busy')`);
  // 写すときは「具体的」に切り替えた状態にする（タップで具体化するモード）
  await evaluate(`[...document.querySelectorAll('.mode-dock-option')].find((el) => el.textContent.includes('具体的'))?.click(); true`);
  await sleep(2600);
  await mouse("mouseMoved", 5, 5, { button: "none" });
  await sleep(800);
  // 出た 8 つと元のカード（いちばん新しい段の番号でまとめる）
  const detailCards = `(() => {
    const groupOf = (el) => Number(el.querySelector('.topic-id')?.firstChild?.textContent.match(/^([0-9]+)[A-I]$/)?.[1] ?? 0);
    const chips = [...document.querySelectorAll('.topic-chip')];
    const group = Math.max(...chips.map(groupOf));
    return chips.filter((el) => groupOf(el) === group);
  })()`;
  // 出た答えのところに寄ったまま、8 つと元のカードを切り抜く
  await shot("detail", await focusOn(detailCards, { minWidth: 480 }));
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
  await shot(
    "menu",
    // メニューを中心に、上に少し盤面が見えるくらい
    await focusOn(`[document.querySelector('.topic-sheet-head'), document.querySelector('.topic-sheet-grid')]`, { minWidth: 660 }),
  );
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
