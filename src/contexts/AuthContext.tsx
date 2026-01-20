import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '../utils/supabase';

export interface User {
  id: string;
  telegram_username: string;
  first_name?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  sendingCode: boolean;
  verifying: boolean;
  error: string | null;
  codeSent: boolean;
  sendCode: (username: string) => Promise<boolean>;
  verifyCode: (code: string) => Promise<boolean>;
  resetAuth: () => void;
  logout: () => void;
  getUserId: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'bazar-ai-user';
const BOT_TOKEN = '8367186792:AAHLr687MVkXV_DBwAYUaR0U74U-h0qbi6g';

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Синхронно читаем пользователя из localStorage при загрузке модуля
const getInitialUser = (): User | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    console.log('[Auth] Initial localStorage check:', stored ? 'found user' : 'no user');
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('[Auth] Parsed user:', parsed);
      return parsed;
    }
  } catch (e) {
    console.error('[Auth] Error reading localStorage:', e);
    localStorage.removeItem(STORAGE_KEY);
  }
  return null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Инициализируем синхронно, чтобы избежать мигания
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [loading, setLoading] = useState(false); // Уже не нужен loading, т.к. читаем синхронно
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  // Логируем состояние при каждом рендере
  useEffect(() => {
    console.log('[Auth] Current user state:', user);
    console.log('[Auth] isAuthenticated:', !!user);
  }, [user]);

  // Отправка кода в Telegram
  const sendCode = useCallback(async (username: string) => {
    setSendingCode(true);
    setError(null);
    
    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    
    if (!cleanUsername) {
      setError('Введите username');
      setSendingCode(false);
      return false;
    }

    try {
      const code = generateCode();
      
      // Сохраняем код в Supabase
      const { error: dbError } = await supabase
        .from('auth_codes')
        .insert({
          telegram_username: cleanUsername,
          code: code,
        });

      if (dbError) {
        console.error('DB error:', dbError);
        setError('Ошибка сохранения кода');
        setSendingCode(false);
        return false;
      }

      // Получаем chat_id через getUpdates
      const updatesResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`
      );
      const updatesData = await updatesResponse.json();
      
      let chatId: number | null = null;
      
      if (updatesData.ok && updatesData.result) {
        for (const update of updatesData.result) {
          const from = update.message?.from;
          if (from?.username?.toLowerCase() === cleanUsername) {
            chatId = from.id;
            break;
          }
        }
      }

      if (!chatId) {
        setError(`Сначала напишите /start боту @bazarai_bot`);
        setSendingCode(false);
        return false;
      }

      // Отправляем код
      const message = `🔐 Ваш код для входа в Bazar AI:\n\n<b>${code}</b>\n\nКод действителен 10 минут.`;
      const sendResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      );

      const sendData = await sendResponse.json();
      
      if (!sendData.ok) {
        setError('Не удалось отправить код. Напишите /start боту @bazarai_bot');
        setSendingCode(false);
        return false;
      }

      setPendingUsername(cleanUsername);
      setCodeSent(true);
      setSendingCode(false);
      return true;
    } catch (err) {
      console.error('Send code error:', err);
      setError('Ошибка отправки кода');
      setSendingCode(false);
      return false;
    }
  }, []);

  // Проверка кода
  const verifyCode = useCallback(async (code: string) => {
    if (!pendingUsername) {
      setError('Сначала запросите код');
      return false;
    }

    setVerifying(true);
    setError(null);

    try {
      // Проверяем код в базе
      const { data, error: dbError } = await supabase
        .from('auth_codes')
        .select('*')
        .eq('telegram_username', pendingUsername)
        .eq('code', code.trim())
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbError || !data || data.length === 0) {
        setError('Неверный или истёкший код');
        setVerifying(false);
        return false;
      }

      // Помечаем код как использованный
      await supabase
        .from('auth_codes')
        .update({ used: true })
        .eq('id', data[0].id);

      // Создаём пользователя
      const userData: User = {
        id: `tg-${pendingUsername}`,
        telegram_username: pendingUsername,
        created_at: new Date().toISOString(),
      };

      // Сохраняем локально
      console.log('[Auth] Saving user to localStorage:', userData);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      
      // Проверяем что сохранилось
      const saved = localStorage.getItem(STORAGE_KEY);
      console.log('[Auth] Verified saved data:', saved);
      
      setUser(userData);
      console.log('[Auth] User state updated');

      // Сохраняем в Supabase
      await supabase
        .from('users')
        .upsert({
          telegram_username: pendingUsername,
          last_login: new Date().toISOString(),
        }, {
          onConflict: 'telegram_username'
        });

      setVerifying(false);
      setCodeSent(false);
      setPendingUsername(null);
      return true;
    } catch (err) {
      console.error('Verify error:', err);
      setError('Ошибка проверки кода');
      setVerifying(false);
      return false;
    }
  }, [pendingUsername]);

  // Сброс состояния
  const resetAuth = useCallback(() => {
    setCodeSent(false);
    setPendingUsername(null);
    setError(null);
  }, []);

  // Выход
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setCodeSent(false);
    setPendingUsername(null);
  }, []);

  // Получение ID пользователя
  const getUserId = useCallback(() => {
    return user?.id || null;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      sendingCode,
      verifying,
      error,
      codeSent,
      sendCode,
      verifyCode,
      resetAuth,
      logout,
      getUserId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
