/** Проверяет, что текст в основном на кириллице (русский). */
export function isRussian(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const cyrillic = (trimmed.match(/[\u0400-\u04FF]/g) || []).length;
  const letters = (trimmed.match(/\p{L}/gu) || []).length;
  return letters > 0 && cyrillic / letters >= 0.5;
}
