import { measureTextWidth } from "@/lib/node-box";

export function fitLabelFontSize(
  text: string,
  maxWidth: number,
  maxHeight: number,
  maxSize: number,
  minSize = 9,
): number {
  const label = text.trim() || "話題";
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    const lineHeight = size * 1.2;
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    let lines = 1;
    let current = 0;
    let fits = true;
    for (const char of label) {
      const extra = measureTextWidth(char, size);
      if (current > 0 && current + extra > maxWidth) {
        lines += 1;
        current = extra;
        if (lines > maxLines) {
          fits = false;
          break;
        }
      } else {
        current += extra;
      }
    }
    if (fits) return size;
  }
  return minSize;
}
