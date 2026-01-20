import { useEffect, useRef } from 'react';
import { TelegramUser } from '../hooks/useAuth';

interface TelegramLoginButtonProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  showUserPic?: boolean;
  lang?: string;
}

export function TelegramLoginButton({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius = 20,
  showUserPic = true,
  lang = 'ru',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Устанавливаем глобальный callback
    window.onTelegramAuth = onAuth;

    // Создаём скрипт Telegram Widget
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', cornerRadius.toString());
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    if (showUserPic) {
      script.setAttribute('data-userpic', 'true');
    }
    script.setAttribute('data-lang', lang);
    script.async = true;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [botName, onAuth, buttonSize, cornerRadius, showUserPic, lang]);

  return <div ref={containerRef} className="flex justify-center" />;
}
