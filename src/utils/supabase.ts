import { createClient, SupabaseClient } from '@supabase/supabase-js';

// TODO: Замените на ваши реальные значения из Supabase проекта
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Создаем клиент только если есть credentials, иначе создаем mock клиент
let supabase: SupabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. App will work without Supabase integration. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable Supabase features.');
  
  // Создаем mock клиент с пустыми значениями, чтобы не ломать приложение
  // В реальности это будет работать только для чтения, но не для записи
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  ) as any;
  
  // Переопределяем методы, чтобы они не падали
  supabase.from = () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    update: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    delete: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
  } as any);
  
  supabase.channel = () => ({
    on: () => ({ subscribe: () => {} } as any),
    subscribe: () => ({} as any),
  } as any);
  
  supabase.rpc = () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Устанавливает контекст пользователя для RLS политик
 * Вызывайте эту функцию перед запросами к таблицам с RLS
 */
export async function setUserContext(userId: string): Promise<void> {
  if (!supabaseUrl || !supabaseAnonKey) {
    return; // Игнорируем если Supabase не настроен
  }
  
  try {
    await supabase.rpc('set_user_context', { p_user_id: userId });
  } catch (error) {
    // Игнорируем ошибки если функция не существует (миграция не применена)
    console.warn('[Supabase] Failed to set user context:', error);
  }
}

export { supabase };

// Типы для таблицы inbox_videos
export interface InboxVideo {
  id: string;
  title: string;
  preview_url: string;
  url: string;
  status: 'pending' | 'on_canvas';
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  taken_at?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}
