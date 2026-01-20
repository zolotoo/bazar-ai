import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
  created_at: string;
}

const STORAGE_KEY = 'bazar-ai-user';
const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'bazarai_bot';

// Проверяем, настроен ли Supabase
const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return !!(url && key && url !== 'https://placeholder.supabase.co');
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Загрузка пользователя из localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Обработка данных от Telegram Login Widget
  const handleTelegramAuth = useCallback(async (telegramUser: TelegramUser) => {
    try {
      const userData: User = {
        id: `tg-${telegramUser.id}`,
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        photo_url: telegramUser.photo_url,
        created_at: new Date().toISOString(),
      };

      // Сохраняем локально
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      setUser(userData);

      // Если Supabase настроен, сохраняем и там
      if (isSupabaseConfigured()) {
        try {
          await supabase
            .from('users')
            .upsert({
              telegram_id: telegramUser.id,
              username: telegramUser.username,
              first_name: telegramUser.first_name,
              last_name: telegramUser.last_name,
              photo_url: telegramUser.photo_url,
              auth_date: telegramUser.auth_date,
              last_login: new Date().toISOString(),
            }, {
              onConflict: 'telegram_id'
            });
        } catch (err) {
          console.error('Error saving user to Supabase:', err);
        }
      }

      return userData;
    } catch (err) {
      console.error('Auth error:', err);
      throw err;
    }
  }, []);

  // Выход
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  // Получение ID пользователя для запросов
  const getUserId = useCallback(() => {
    return user?.id || null;
  }, [user]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    handleTelegramAuth,
    logout,
    getUserId,
    botUsername: BOT_USERNAME,
  };
}

// Глобальная функция для Telegram Widget callback
declare global {
  interface Window {
    onTelegramAuth: (user: TelegramUser) => void;
  }
}
