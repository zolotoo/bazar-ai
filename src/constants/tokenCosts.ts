/**
 * Стоимость действий в токенах.
 * 1 токен = 0,1 ₽ трат на API (RapidAPI, Gemini).
 * AssemblyAI не учитывается (бесплатный тариф).
 */

export type TokenAction =
  | 'search'
  | 'link_add'
  | 'radar_add_profile'
  | 'radar_refresh_all'
  | 'add_carousel'
  | 'load_video'
  | 'translate'
  | 'generate_script'
  | 'refine_prompt'
  | 'chat_with_prompt'
  | 'calculate_viral'
  | 'transcribe_video'
  | 'transcribe_carousel'
  | 'train_style' // Обучить стиль по примерам (Gemini)
  | 'add_to_folder'; // 0 — сохранение в БД без API

/** Базовые стоимости в токенах */
const TOKEN_COSTS: Record<Exclude<TokenAction, 'radar_refresh_all'>, number> = {
  search: 10,           // 2–6 RapidAPI запросов, ~1 ₽
  link_add: 2,          // 1–2 RapidAPI
  radar_add_profile: 5, // 2 RapidAPI user-reels
  add_carousel: 2,      // 1 RapidAPI reel-info
  load_video: 2,        // 1 RapidAPI download-video
  translate: 1,         // 1 Gemini
  generate_script: 5,   // 1–2 Gemini
  refine_prompt: 5,     // 1 Gemini
  chat_with_prompt: 5,  // 1 Gemini
  calculate_viral: 2,  // 1 RapidAPI user-reels
  transcribe_video: 2,  // 1 RapidAPI (AssemblyAI бесплатно)
  transcribe_carousel: 2, // 1 Gemini
  train_style: 5, // 1 Gemini (анализ примеров)
  add_to_folder: 0,
};

/** Токенов за один профиль при «Обновить все» в радаре */
export const RADAR_REFRESH_TOKENS_PER_PROFILE = 5;

/**
 * Получить стоимость действия в токенах.
 * @param action — тип действия
 * @param profilesCount — для radar_refresh_all: количество профилей
 */
export function getTokenCost(
  action: TokenAction,
  profilesCount?: number
): number {
  if (action === 'radar_refresh_all') {
    const n = profilesCount ?? 0;
    return n * RADAR_REFRESH_TOKENS_PER_PROFILE;
  }
  return TOKEN_COSTS[action] ?? 0;
}
