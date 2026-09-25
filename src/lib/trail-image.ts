import { layoutBoard, prefsFromSettings } from "@/lib/layout";
import { CENTER_CELL_INDEX, cellCode } from "@/lib/mandala-ids";
import { estimateLocalBox, MANDALA_CHIP_H, MANDALA_CHIP_W } from "@/lib/node-box";
import { buildTopicTrail, type TopicTrail, type TrailNode } from "@/lib/topic-trail";
import type { Board, GenerationLayout, TNode } from "@/lib/types";

/**
 * X に添付する「話題の軌跡」の画像を canvas で描く（ブラウザ専用）。
 * - trail: 選んだ話題だけを、左から右へ広げた順にたどる木
 * - map:   盤面そのまま（マンダラート／放射）。広げた話題には番号を付ける
 * 画面の見た目ではなく、いつ誰が見ても同じ明るい配色・標準の文字サイズで描く。
 */
export type TrailImageMode = "trail" | "map";

const PAD = 56;
const HEADER = 118;
const FOOTER = 66;
const MIN_W = 1200;
const MIN_H = 675;
/** 出力画像の長い辺の上限（X は大きすぎる画像を縮めるので、それ以上は無駄） */
const MAX_SIDE = 3200;

const BG = "#f7f6f1";
const INK = "#1f2a24";
const MUTED = "#6b746e";
const HEART = "#e0457b";
const NOW_FILL = "#f2d38a";
const NOW_INK = "#5a4312";

/** globals.css の .topic-node[data-family] と同じ色相 */
const FAMILY_HUES = [155, 220, 90, 180, 280, 145, 50, 250];

function oklch(l: number, c: number, h: number, alpha = 1): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const [r, g, bl] = linear.map((value) => {
    const v = Math.max(0, Math.min(1, value));
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  });
  return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

function family(index: number) {
  const hue = FAMILY_HUES[((index % FAMILY_HUES.length) + FAMILY_HUES.length) % FAMILY_HUES.length]!;
  return {
    strong: oklch(0.9, 0.055, hue),
    soft: oklch(0.965, 0.02, hue),
    line: oklch(0.54, 0.09, hue),
    lineSoft: oklch(0.54, 0.09, hue, 0.45),
  };
}

const PRIMARY = oklch(0.55, 0.1, 155);

function fontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

function font(size: number, weight: number | string, familyName: string) {
  return `${weight} ${size}px ${familyName}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 1文字ずつ折り返し、maxLines に収まるまで文字を小さくする。収まらなければ末尾を … にする */
function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  minSize: number,
  weight: number,
  familyName: string,
): { size: number; lines: string[] } {
  const wrap = (size: number) => {
    ctx.font = font(size, weight, familyName);
    const lines: string[] = [];
    let current = "";
    for (const char of text) {
      if (current && ctx.measureText(current + char).width > maxWidth) {
        lines.push(current);
        current = char.trim() ? char : "";
      } else {
        current += char;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  for (let size = maxSize; size >= minSize; size -= 1) {
    const lines = wrap(size);
    if (lines.length <= maxLines) return { size, lines };
  }
  const lines = wrap(minSize).slice(0, maxLines);
  let last = lines[maxLines - 1] ?? "";
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = [...last].slice(0, -1).join("");
  lines[maxLines - 1] = `${last}…`;
  return { size: minSize, lines };
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  maxLines: number,
  maxSize: number,
  weight: number,
  familyName: string,
) {
  const { size, lines } = fitLines(ctx, text, maxWidth, maxLines, maxSize, 10, weight, familyName);
  const lineHeight = size * 1.28;
  ctx.font = font(size, weight, familyName);
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const top = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, cx, top + index * lineHeight));
}

/** 広げた順の番号（カードの左上の角に重ねる丸） */
function drawStep(ctx: CanvasRenderingContext2D, step: number, x: number, y: number, color: string, familyName: string) {
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = BG;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = font(step >= 10 ? 12 : 14, 700, familyName);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(step), x, y + 0.5);
}

/** 右上の角に ♥ の数と NOW を並べる */
function drawBadges(
  ctx: CanvasRenderingContext2D,
  right: number,
  y: number,
  hearts: number,
  pinned: boolean,
  familyName: string,
) {
  let x = right;
  const pill = (text: string, fill: string, ink: string) => {
    ctx.font = font(12, 700, familyName);
    const w = ctx.measureText(text).width + 16;
    roundRect(ctx, x - w, y - 11, w, 22, 11);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x - w / 2, y + 0.5);
    x -= w + 6;
  };
  if (pinned) pill("NOW", NOW_FILL, NOW_INK);
  if (hearts > 0) pill(`♥ ${hearts > 999 ? "999+" : hearts}`, HEART, "#fff");
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle: string,
  familyName: string,
) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PRIMARY;
  ctx.font = font(15, 700, familyName);
  ctx.fillText(subtitle, PAD, PAD + 4);
  const { size, lines } = fitLines(ctx, title, width - PAD * 2, 1, 34, 18, 700, familyName);
  ctx.fillStyle = INK;
  ctx.font = font(size, 700, familyName);
  ctx.fillText(lines[0] ?? "", PAD, PAD + 46);

  ctx.font = font(15, 700, familyName);
  ctx.fillStyle = PRIMARY;
  ctx.fillText("TopicStream(ぬ)", PAD, height - PAD / 2 - 4);
  ctx.textAlign = "right";
  ctx.fillStyle = MUTED;
  ctx.font = font(14, 500, familyName);
  ctx.fillText("#TopicStreamぬ", width - PAD, height - PAD / 2 - 4);
}

type Placed<T> = { item: T; x: number; y: number; w: number; h: number };

function makeCanvas(contentW: number, contentH: number) {
  const width = Math.max(MIN_W, contentW + PAD * 2);
  const height = Math.max(MIN_H, contentH + HEADER + FOOTER + PAD);
  const ratio = Math.min(2, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.scale(ratio, ratio);
  // 中身が小さいときは真ん中に寄せる
  const offsetX = (width - contentW) / 2;
  const offsetY = HEADER + (height - HEADER - FOOTER - contentH) / 2;
  return { canvas, ctx, width, height, offsetX, offsetY };
}

// ---- 選んだ話題だけ（左→右の木） ----

const CARD_W = 236;
const CARD_H = 70;
const COL_GAP = 64;
const ROW_GAP = 20;

function drawTrail(trail: TopicTrail, title: string, familyName: string): HTMLCanvasElement {
  const placed: Placed<TrailNode>[] = [];
  const links: [Placed<TrailNode>, Placed<TrailNode>][] = [];
  let row = 0;
  let maxDepth = 0;
  const place = (node: TrailNode): Placed<TrailNode> => {
    maxDepth = Math.max(maxDepth, node.depth);
    const kids = node.children.map(place);
    const y = kids.length > 0 ? (kids[0]!.y + kids[kids.length - 1]!.y) / 2 : (row++) * (CARD_H + ROW_GAP);
    const self = { item: node, x: node.depth * (CARD_W + COL_GAP), y, w: CARD_W, h: CARD_H };
    placed.push(self);
    for (const kid of kids) links.push([self, kid]);
    return self;
  };
  trail.roots.forEach((root) => {
    place(root);
    row += 0.5;
  });
  const contentW = (maxDepth + 1) * CARD_W + maxDepth * COL_GAP;
  const contentH = Math.max(CARD_H, Math.ceil(row - 0.5) * (CARD_H + ROW_GAP) - ROW_GAP);

  const { canvas, ctx, width, height, offsetX, offsetY } = makeCanvas(contentW, contentH);
  drawFrame(ctx, width, height, title, `話題の軌跡 · ${trail.steps}回ひろげた`, familyName);
  ctx.translate(offsetX, offsetY);

  for (const [from, to] of links) {
    const x1 = from.x + from.w;
    const y1 = from.y + from.h / 2;
    const x2 = to.x;
    const y2 = to.y + to.h / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1 + COL_GAP / 2, y1, x2 - COL_GAP / 2, y2, x2, y2);
    ctx.lineWidth = to.item.step ? 3.5 : 2;
    ctx.strokeStyle = to.item.step ? family(to.item.familyIndex).line : family(to.item.familyIndex).lineSoft;
    ctx.stroke();
  }

  for (const { item, x, y, w, h } of placed) {
    const colors = family(item.familyIndex);
    const chosen = item.step !== null || item.depth === 0;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = chosen ? colors.strong : "#fff";
    ctx.fill();
    ctx.lineWidth = item.depth === 0 ? 3.5 : chosen ? 2.5 : 1.5;
    ctx.strokeStyle = chosen ? colors.line : colors.lineSoft;
    ctx.stroke();
    drawLabel(ctx, item.label, x + w / 2, y + h / 2 + 1, w - 32, 2, 20, chosen ? 700 : 500, familyName);
    if (item.step) drawStep(ctx, item.step, x + 2, y + 2, colors.line, familyName);
    drawBadges(ctx, x + w + 4, y, item.hearts, item.pinned, familyName);
  }
  return canvas;
}

// ---- 盤面そのまま ----

function drawMap(board: Board, layout: GenerationLayout, trail: TopicTrail, title: string, familyName: string) {
  const prefs = prefsFromSettings({ density: "comfortable", fontScale: 1, generationLayout: layout }, false, board.pinnedNodeId);
  const laid = layoutBoard(board, prefs);
  const nodes = laid.nodes.filter((node) => !node.data.placeholder);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const steps = new Map<string, number>();
  const walk = (node: TrailNode) => {
    if (node.step) steps.set(node.id, node.step);
    node.children.forEach(walk);
  };
  trail.roots.forEach(walk);

  const boxes: Placed<TNode>[] = nodes.map((node) => {
    if (layout === "mandala") {
      return {
        item: node,
        x: node.position.x - MANDALA_CHIP_W / 2,
        y: node.position.y - MANDALA_CHIP_H / 2,
        w: MANDALA_CHIP_W,
        h: MANDALA_CHIP_H,
      };
    }
    const box = estimateLocalBox({ ...node, data: { ...node.data, memo: "" } }, prefs);
    return {
      item: node,
      x: node.position.x + box.left,
      y: node.position.y + box.top,
      w: box.right - box.left,
      h: box.bottom - box.top,
    };
  });
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));

  const { canvas, ctx, width, height, offsetX, offsetY } = makeCanvas(maxX - minX, maxY - minY);
  drawFrame(
    ctx,
    width,
    height,
    title,
    `話題マップ · カード${nodes.length}枚${trail.steps > 0 ? ` · ${trail.steps}回ひろげた` : ""}`,
    familyName,
  );
  ctx.translate(offsetX - minX, offsetY - minY);

  const familyOf = (node: TNode) => node.data.familyIndex ?? node.data.depth;
  // 線: マンダラートは 3×3 の中央どうしだけ（画面と同じ）、放射はすべて
  for (const edge of laid.edges) {
    const from = byId.get(edge.source);
    const to = byId.get(edge.target);
    if (!from || !to) continue;
    if (layout === "mandala" && !(to.data.role === "source" || to.data.cellIndex === CENTER_CELL_INDEX)) continue;
    const dx = to.position.x - from.position.x;
    const dy = to.position.y - from.position.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = layout === "mandala" ? Math.min(64, length * 0.15) * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(from.position.x, from.position.y);
    ctx.quadraticCurveTo(
      (from.position.x + to.position.x) / 2 + (dy / length) * bend,
      (from.position.y + to.position.y) / 2 - (dx / length) * bend,
      to.position.x,
      to.position.y,
    );
    ctx.lineWidth = layout === "mandala" ? 3 : 2;
    ctx.strokeStyle = family(familyOf(to)).lineSoft;
    ctx.stroke();
  }

  for (const { item: node, x, y, w, h } of boxes) {
    const colors = family(familyOf(node));
    const isCenter = node.data.parentId === null || node.data.role === "source";
    const step = steps.get(node.id) ?? null;
    roundRect(ctx, x, y, w, h, layout === "mandala" ? 14 : h / 2);
    ctx.fillStyle = isCenter ? colors.strong : layout === "mandala" ? colors.soft : "#fff";
    ctx.fill();
    ctx.lineWidth = isCenter ? 3 : step ? 2.5 : 1;
    ctx.strokeStyle = isCenter || step ? colors.line : colors.lineSoft;
    ctx.stroke();

    const code =
      layout === "mandala" && typeof node.data.groupId === "number" && typeof node.data.cellIndex === "number"
        ? cellCode(node.data.groupId, node.data.cellIndex)
        : "";
    if (code) {
      ctx.font = font(11, 700, familyName);
      ctx.fillStyle = MUTED;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(code, x + w / 2, y + 7);
    }
    drawLabel(
      ctx,
      node.data.label.trim() || "話題",
      x + w / 2,
      y + h / 2 + (code ? 7 : 0),
      w - 24,
      layout === "mandala" ? 3 : 2,
      layout === "mandala" ? 16 : 15,
      isCenter || step ? 700 : 500,
      familyName,
    );
    if (step) drawStep(ctx, step, x + 2, y + 2, colors.line, familyName);
    drawBadges(
      ctx,
      x + w + 4,
      y,
      (node.data.heartCount ?? 0) + (node.data.frameHearts ?? 0),
      board.pinnedNodeId === node.id,
      familyName,
    );
  }
  return canvas;
}

export function boardLayoutOf(board: Board): GenerationLayout {
  return board.nodes.some((node) => typeof node.data.groupId === "number") ? "mandala" : "radial";
}

export async function renderTrailImage(board: Board, mode: TrailImageMode): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  const familyName = fontFamily();
  const trail = buildTopicTrail(board);
  const title = trail.roots[0]?.label ?? board.name;
  const canvas =
    mode === "trail"
      ? drawTrail(trail, title, familyName)
      : drawMap(board, boardLayoutOf(board), trail, title, familyName);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png");
  });
}
