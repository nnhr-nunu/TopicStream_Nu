/** 連絡先・URL・@ハンドルなど、個人につながりそうな文字列。図鑑には入れない */
const PERSONAL_PATTERN =
  /(https?:\/\/|www\.|[\w.+-]+@[\w-]+\.|@[A-Za-z0-9_]{3,}|\d{2,4}-\d{2,4}-\d{3,4}|\d{10,}|〒\s*\d{3}-?\d{4})/;

export function looksPersonal(text: string): boolean {
  return PERSONAL_PATTERN.test(text.normalize("NFKC"));
}
