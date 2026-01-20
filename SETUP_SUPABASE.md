# Пошаговая инструкция: Создание проекта Supabase

## Шаг 1: Создание проекта в Supabase

1. Перейдите на [https://supabase.com](https://supabase.com)
2. Нажмите **"Start your project"** или **"Sign in"** (если уже зарегистрированы)
3. Войдите через GitHub (рекомендуется) или создайте аккаунт
4. Нажмите **"New Project"**
5. Заполните форму:
   - **Name**: `telegram-content-crm` (или любое другое имя)
   - **Database Password**: создайте надежный пароль (сохраните его!)
   - **Region**: выберите ближайший регион (например, `West US` или `Europe West`)
   - **Pricing Plan**: выберите **Free** (для начала)
6. Нажмите **"Create new project"**
7. Подождите 2-3 минуты, пока проект создается

## Шаг 2: Получение переменных окружения

1. После создания проекта перейдите в **Settings** (иконка шестеренки слева)
2. Выберите **API** в меню
3. Найдите секцию **Project API keys**
4. Скопируйте следующие значения:
   - **Project URL** (например: `https://xxxxx.supabase.co`) → это `VITE_SUPABASE_URL`
   - **anon public** key (длинная строка) → это `VITE_SUPABASE_ANON_KEY`

## Шаг 3: Создание таблицы `inbox_videos`

1. В левом меню выберите **SQL Editor**
2. Нажмите **"New query"**
3. Вставьте следующий SQL код:

```sql
-- Создание таблицы inbox_videos
CREATE TABLE inbox_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'on_canvas')),
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  taken_at TIMESTAMPTZ,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включаем Real-time подписки для таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_videos;

-- Создаем индексы для быстрого поиска
CREATE INDEX idx_inbox_videos_status ON inbox_videos(status);
CREATE INDEX idx_inbox_videos_created_at ON inbox_videos(created_at DESC);

-- Включаем Row Level Security (RLS)
ALTER TABLE inbox_videos ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать видео со статусом 'pending'
CREATE POLICY "Allow read pending videos"
  ON inbox_videos FOR SELECT
  USING (status = 'pending');

-- Политика: все могут обновлять статус на 'on_canvas'
CREATE POLICY "Allow update status"
  ON inbox_videos FOR UPDATE
  USING (true)
  WITH CHECK (status = 'on_canvas');

-- Политика: все могут вставлять новые видео
CREATE POLICY "Allow insert videos"
  ON inbox_videos FOR INSERT
  WITH CHECK (true);
```

4. Нажмите **"Run"** или `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
5. Должно появиться сообщение об успешном выполнении

## Шаг 4: Настройка переменных окружения в проекте

1. В терминале выполните:

```bash
cd /Users/sergeyzolotykh/telegram-content-crm
cp .env.example .env
```

2. Откройте файл `.env` в редакторе
3. Замените значения на те, что скопировали из Supabase:

```env
VITE_SUPABASE_URL=https://ваш-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=ваш-anon-key-здесь
```

4. Сохраните файл

## Шаг 5: Проверка работы

1. Перезапустите dev сервер:

```bash
npm run dev
```

2. Откройте консоль браузера (F12)
3. Предупреждение "Supabase credentials not found" должно исчезнуть
4. Приложение должно подключиться к Supabase

## Шаг 6: Тестирование (опционально)

Можете протестировать добавление видео через Supabase Dashboard:

1. Перейдите в **Table Editor** → **inbox_videos**
2. Нажмите **"Insert row"**
3. Заполните:
   - `title`: "Test Video"
   - `preview_url`: "https://example.com/preview.jpg"
   - `url`: "https://instagram.com/reel/test123"
   - `status`: "pending"
4. Нажмите **"Save"**
5. Видео должно появиться в приложении автоматически (благодаря real-time подписке)

## Готово! 🎉

Теперь ваше приложение подключено к Supabase и готово к работе!
