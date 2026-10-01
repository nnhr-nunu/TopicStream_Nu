/**
 * ショートカットを効かせない場面の判定（盤面のショートカット・拡大縮小で共用）。
 */

/** 文字を打っている所（入力欄・選択・編集できる要素） */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** ダイアログ・シート・メニューが開いている間は、裏の盤面を操作しない */
export function modalOpen(target: EventTarget | null): boolean {
  if (target instanceof HTMLElement && target.closest('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) {
    return true;
  }
  return Boolean(document.querySelector('[data-slot="dialog-content"], [data-slot="sheet-content"]'));
}

/**
 * 押したキーの文字（小文字）。日本語入力がオンのまま盤面で押すと key が "Process" になるので、
 * 文字を打つ場所でなければキーの位置（KeyE）から読む
 */
export function shortcutKey(event: KeyboardEvent): string {
  if (event.key === "Process" && /^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  return event.key.toLowerCase();
}
