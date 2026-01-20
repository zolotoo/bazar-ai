# Supabase Setup Guide

## Быстрая настройка через GitHub

### 1. Получите переменные окружения из Supabase

1. Перейдите на [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект (или создайте новый)
3. Перейдите в **Settings** → **API**
4. Скопируйте следующие значения:
   - **Project URL** → это `VITE_SUPABASE_URL`
   - **anon/public key** → это `VITE_SUPABASE_ANON_KEY`

### 2. Создайте файл `.env` в корне проекта

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Затем откройте `.env` и замените значения на ваши:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Важно:** Файл `.env` не должен попадать в git (он уже добавлен в `.gitignore`)

### 3. Настройка таблицы `inbox_videos`

Выполните следующий SQL в Supabase SQL Editor:

```sql
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

-- Включаем Real-time подписки
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_videos;

-- Создаем индекс для быстрого поиска по статусу
CREATE INDEX idx_inbox_videos_status ON inbox_videos(status);
CREATE INDEX idx_inbox_videos_created_at ON inbox_videos(created_at DESC);
```

### 4. Настройка Row Level Security (RLS)

Для безопасности настройте RLS политики:

```sql
-- Включаем RLS
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

### 5. Настройка для GitHub Actions / Деплоя

Если вы деплоите через GitHub Actions, добавьте секреты в репозиторий:

1. Перейдите в **Settings** → **Secrets and variables** → **Actions**
2. Добавьте следующие секреты:
   - `VITE_SUPABASE_URL` - URL вашего Supabase проекта
   - `VITE_SUPABASE_ANON_KEY` - anon key из Supabase

Затем в GitHub Actions используйте их:

```yaml
- name: Build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: npm run build
```

### 6. Проверка работы

После настройки:

1. Перезапустите dev сервер: `npm run dev`
2. Предупреждение "Supabase credentials not found" должно исчезнуть
3. Приложение должно подключаться к Supabase и получать данные в реальном времени

## Использование

### Добавление видео в таблицу

Видео добавляются в таблицу `inbox_videos` через Telegram бота или через API.

Пример добавления через Supabase API:

```typescript
const { data, error } = await supabase
  .from('inbox_videos')
  .insert({
    title: 'Название видео',
    preview_url: 'https://example.com/preview.jpg',
    url: 'https://instagram.com/reel/abc123',
    status: 'pending',
  });
```

Приложение автоматически подписывается на изменения через `useInboxVideos` хук и обновляет UI в реальном времени.
