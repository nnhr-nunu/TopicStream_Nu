import { cn } from "@/lib/utils";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** 使い方の流れ。画像は scripts/capture-guide.mjs で撮り直せる（public/guide/） */
export const USAGE_STEPS = [
  {
    image: "start",
    title: "① お題を入れて始める",
    body: "話したいことを1つ入れるか、おすすめのお題を選びます。",
  },
  {
    image: "expand",
    title: "② タップで 8 つに広がる",
    body: "気になるカードをタップすると、その周りに 3×3 で話題が広がります。",
  },
  {
    image: "menu",
    title: "③ 長押しでメニュー",
    body: "スマホは長押し、PC はカーソルを乗せると、ピン・具体的にする・作り直す・付箋などが出ます。",
  },
  {
    image: "combine",
    title: "④ 重ねて掛け合わせ",
    body: "カードを別のカードに重ねると、2つを組み合わせた話題ができます。スマホは長押ししたまま動かします。",
  },
  {
    image: "detail",
    title: "⑤ 抽象展開 / 具体的",
    body: "左下で切り替え。「具体的」にすると、タップで具体的な話題・答えが出ます。",
  },
] as const;

/** 横にスワイプして見る、使い方の画像 */
export function UsageGallery({ className }: { className?: string }) {
  return (
    <ol className={cn("usage-gallery", className)} aria-label="使い方の流れ">
      {USAGE_STEPS.map((step) => (
        <li key={step.image} className="usage-gallery-item">
          {/* eslint-disable-next-line @next/next/no-img-element -- 静的エクスポートでも同じパスで出すため */}
          <img
            src={`${base}/guide/${step.image}.webp`}
            alt={`${step.title}の画面`}
            width={1200}
            height={750}
            loading="lazy"
            decoding="async"
            className="usage-gallery-img"
          />
          <p className="usage-gallery-title">{step.title}</p>
          <p className="usage-gallery-body">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
