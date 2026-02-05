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

const SESSION_KEY = 'riri-session';
const BOT_TOKEN = '8183756206:AAGo-jl6BMBfAzejVt1MNVUD5TQPegxQOhc';

// Гибридное хранение: cookie + localStorage для надёжности
const saveSession = (token: string) => {
  setCookie(SESSION_KEY, token, 30);
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch (e) {
    console.log('[Auth] localStorage not available');
  }
};

const getSession = (): string | null => {
  // Сначала пробуем cookie
  let token = getCookie(SESSION_KEY);
  if (token) return token;
  
  // Fallback на localStorage
  try {
    token = localStorage.getItem(SESSION_KEY);
    if (token) {
      // Восстанавливаем cookie из localStorage
      setCookie(SESSION_KEY, token, 30);
      return token;
    }
  } catch (e) {
    console.log('[Auth] localStorage not available');
  }
  
  return null;
};

const clearSession = () => {
  deleteCookie(SESSION_KEY);
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.log('[Auth] localStorage not available');
  }
};

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateSessionToken = () => {
  return crypto.randomUUID() + '-' + Date.now();
};

// Cookie helpers - без Secure для совместимости с localhost
const setCookie = (name: string, value: string, days: number = 30) => {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  // Не используем Secure для localhost, SameSite=Lax для кросс-сайт совместимости
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const secureFlag = isLocalhost ? '' : '; Secure';
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax${secureFlag}`;
  console.log('[Auth] Cookie set:', name, 'value length:', value.length);
};

const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  const value = match ? match[2] : null;
  console.log('[Auth] Cookie get:', name, value ? 'found' : 'not found');
  return value;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  console.log('[Auth] Cookie deleted:', name);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  const SESSION_CHECK_TIMEOUT_MS = 6000;

  // Проверяем сессию при загрузке
  useEffect(() => {
    const checkSession = async () => {
      const sessionToken = getSession();
      console.log('[Auth] Checking session:', sessionToken ? sessionToken.slice(0, 20) + '...' : 'not found');
      
      if (!sessionToken) {
        console.log('[Auth] No session token, showing login');
        setLoading(false);
        return;
      }

      try {
        const sessionPromise = supabase
          .from('sessions')
          .select('token, telegram_username, expires_at, created_at')
          .eq('token', sessionToken)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), SESSION_CHECK_TIMEOUT_MS)
        );

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);

        console.log('[Auth] Session check result:', { data, error });

        if (error) {
          console.log('[Auth] Session query error:', error.message);
          clearSession();
          setLoading(false);
          return;
        }

        if (!data) {
          console.log('[Auth] Session not found or expired');
          clearSession();
          setLoading(false);
          return;
        }

        console.log('[Auth] Session valid for user:', data.telegram_username);
        
        // Обновляем last_active (не ждём ответа)
        supabase
          .from('sessions')
          .update({ last_active: new Date().toISOString() })
          .eq('token', sessionToken)
          .then(() => console.log('[Auth] Updated last_active'));

        setUser({
          id: `tg-${data.telegram_username}`,
          telegram_username: data.telegram_username,
          created_at: data.created_at,
        });
      } catch (err) {
        console.error('[Auth] Session check error:', err);
        if (err instanceof Error && err.message === 'Session check timeout') {
          console.warn('[Auth] Session check timed out — обновите страницу');
        }
        clearSession();
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  // Отправка кода в Telegram
  const sendCode = useCallback(async (username: string) => {
    setSendingCode(true);
    setError(null);
    
    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    
    if (!cleanUsername) {
      setError('Я не знаю, как тебя зовут! Напиши свой username в поле выше');
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
        setError('Упс, что-то пошло не так при сохранении. Попробуй ещё раз');
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
        setError('Я не могу отправить тебе сообщение :(\nНапиши мне @ririai_bot - /start\nИ нажми кнопку «Получить код» заново');
        setSendingCode(false);
        return false;
      }

      // Отправляем код
      const message = `🔐 Привет! Вот твой код для входа:\n\n<b>${code}</b>\n\nОн действует 10 минут.`;
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
        setError('Я не могу отправить тебе сообщение :(\nНапиши мне @ririai_bot - /start\nИ нажми кнопку «Получить код» заново');
        setSendingCode(false);
        return false;
      }

      setPendingUsername(cleanUsername);
      setCodeSent(true);
      setSendingCode(false);
      return true;
    } catch (err) {
      console.error('Send code error:', err);
      setError('Упс, не получилось отправить :( Попробуй ещё раз');
      setSendingCode(false);
      return false;
    }
  }, []);

  // Проверка кода
  const verifyCode = useCallback(async (code: string) => {
    if (!pendingUsername) {
      setError('Сначала нажми «Получить код» — я отправлю его тебе в тг');
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
        setError('Этот код не подходит или уже истёк. Запроси новый код и попробуй снова');
        setVerifying(false);
        return false;
      }

      // Помечаем код как использованный
      await supabase
        .from('auth_codes')
        .update({ used: true })
        .eq('id', data[0].id);

      // Создаём/обновляем пользователя в Supabase
      await supabase
        .from('users')
        .upsert({
          telegram_username: pendingUsername,
          last_login: new Date().toISOString(),
        }, {
          onConflict: 'telegram_username'
        });

      // Создаём сессию
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
      
      await supabase
        .from('sessions')
        .insert({
          token: sessionToken,
          telegram_username: pendingUsername,
          expires_at: expiresAt.toISOString(),
          user_agent: navigator.userAgent,
        });

      // Сохраняем токен
      saveSession(sessionToken);
      console.log('[Auth] Session created and saved');

      // Устанавливаем пользователя
      const userData: User = {
        id: `tg-${pendingUsername}`,
        telegram_username: pendingUsername,
        created_at: new Date().toISOString(),
      };
      
      setUser(userData);

      setVerifying(false);
      setCodeSent(false);
      setPendingUsername(null);
      return true;
    } catch (err) {
      console.error('Verify error:', err);
      setError('Что-то пошло не так при проверке. Попробуй ещё раз');
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
  const logout = useCallback(async () => {
    const sessionToken = getSession();
    
    // Удаляем сессию из Supabase
    if (sessionToken) {
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken);
    }
    
    // Очищаем локальное хранение
    clearSession();
    
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
