import { useEffect, useState } from 'react';

export function useTelegram() {
  const [webApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      
      // Disable pull-to-refresh
      document.body.style.overscrollBehaviorY = 'none';
      
      setWebApp(tg);
    }
  }, []);

  return webApp;
}
