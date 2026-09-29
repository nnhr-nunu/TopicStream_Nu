import { asStringList, createLiveBus } from "@/lib/live-bus";

const bus = createLiveBus<string[]>("topicstream-nu-pulse", asStringList);

export function emitPulse(codes: string[]) {
  if (codes.length === 0) return;
  bus.emit(codes);
}

export function subscribePulse(onCodes: (codes: string[]) => void): () => void {
  return bus.subscribe(onCodes);
}
