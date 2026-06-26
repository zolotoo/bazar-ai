# ИИ-хуки через векторы — как это устроено и как повторить

Документ объясняет «на пальцах» и технически, как в RiRi работают **ИИ-хуки**:
поиск похожих вирусных хуков через векторы (эмбеддинги) + доработка нейросетью.
В конце — пошаговая инструкция, чтобы повторить такую же фичу с нуля.

---

## 1. Объяснение «для 5-летнего» 🧸

Представь коробку с тысячами карточек. На каждой — первая фраза («хук») из вирусного
видео (100k+ просмотров). Нужно найти карточки, **похожие на твою тему**.

Компьютер не понимает слова напрямую. Поэтому каждую фразу превращаем в **набор из 1024
чисел** — это **вектор** (эмбеддинг). Похожие по смыслу фразы получают похожие числа,
даже если слова разные.

Дальше игра «горячо-холодно»:
1. Ты пишешь сценарий/тему.
2. Превращаем твой текст в такой же набор чисел.
3. База меряет «расстояние» до всех карточек и берёт 20 ближайших по смыслу.
4. Умный ИИ выбирает 10 лучших, переписывает под твою тему и объясняет, почему цепляет.

Суть: **числа вместо слов → ближайшие соседи → ИИ дорабатывает**. Это паттерн **RAG**
(Retrieval-Augmented Generation: сначала поиск, потом генерация).

---

## 2. Какие сервисы и модели используются

| Роль | Сервис / модель | Зачем |
|------|-----------------|-------|
| Эмбеддинги (текст → вектор) | **Jina** `jina-embeddings-v3`, 1024 измерения | Превратить хук/запрос в вектор |
| Хранилище векторов | **Supabase Postgres + pgvector** | Хранить векторы и искать ближайшие |
| Извлечение хуков из видео | **Gemini 2.5 Flash** (через OpenRouter) | Разобрать транскрипцию на hook/body/cta |
| Доработка хуков под юзера | **Claude 3.7 Sonnet** (через OpenRouter) | Выбрать топ-10, адаптировать, объяснить |

Ключевая деталь Jina: у запроса и у документа **разные `task`**:
- при индексации видео → `task: 'retrieval.passage'`
- при поиске по запросу юзера → `task: 'retrieval.query'`

---

## 3. Где что лежит в коде

```
api/scriptwriter.js                       # вся серверная логика хуков (jinaEmbed, matchViralHooks, handleGenerateAiHook)
lib/openRouter.js                         # клиент OpenRouter + список моделей (MODELS)
src/components/VideoDetailPage.tsx         # UI: кнопка «ИИ-хуки» и вывод результатов
src/constants/tokenCosts.ts               # стоимость в монетах (ai_hook: 5)

supabase/functions/
  populate-video-hooks/index.ts            # фоновая индексация: видео → hook → вектор
  populate-script-parts/index.ts           # видео → body + cta → векторы
  populate-video-skeletons/index.ts        # видео → структурный «скелет» → вектор

supabase/migrations/
  add_ai_hooks_column.sql                  # saved_videos.ai_hooks JSONB (кэш результатов)
  create_video_skeletons_table.sql         # таблица скелетов + HNSW индекс
  create_match_viral_parts_function.sql    # RPC поиска по hook/body/cta
  create_match_skeletons_function.sql      # RPC поиска по скелетам
  match_full_videos_v2_via_hooks.sql       # RPC: целое видео по хуку
```

Таблица векторов: **`video_embeddings`**
(`video_id`, `part_type` = `hook|body|cta`, `content`, `embedding VECTOR(1024)`,
`niche`, `view_count`, `tier`, `url`, `owner_username`, …).

---

## 4. Поток данных (end-to-end)

### A. Офлайн: наполнение базы (один раз / по расписанию)

```
Вирусное видео (≥50k просмотров, есть транскрипция)
   │
   ├─► Gemini Flash: извлечь хук + определить нишу
   │       prompt → {"hook": "...", "niche": "fitness"}
   │
   ├─► Jina embed (task=retrieval.passage) → вектор[1024]
   │
   └─► INSERT в video_embeddings (part_type='hook', embedding, niche, view_count, url, ...)
```

### B. Онлайн: пользователь жмёт «ИИ-хуки»

```
Текст юзера (сценарий / транскрипция)
   │
   ├─[1]─► Jina embed (task=retrieval.query) → вектор[1024]
   │
   ├─[2]─► RPC match_viral_parts(query_embedding, part_type='hook', min_views=100000)
   │          поиск ближайших по косинусу: 1 - (embedding <=> query) → top-20
   │
   ├─[3]─► Claude Sonnet: из 20 выбрать 10 лучших, адаптировать, объяснить
   │          → JSON [{original, adapted, explanation, views, niche, url, owner_username}]
   │
   └─[4]─► отдать 10 хуков в UI (+ можно закэшировать в saved_videos.ai_hooks)
```

---

## 5. Ключевые куски кода

### Эмбеддинг запроса (`api/scriptwriter.js`)
```js
async function jinaEmbed(text) {
  const res = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${JINA_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      input: [text],
      task: 'retrieval.query',   // для поиска; при индексации — retrieval.passage
    }),
  });
  const data = await res.json();
  return data?.data?.[0]?.embedding ?? null;   // массив из 1024 чисел
}
```

### Вызов векторного поиска (RPC)
```js
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_viral_parts`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query_embedding: embedding,   // вектор[1024]
    filter_part_type: 'hook',
    match_count: 20,
    filter_niche: null,
    min_view_count: 100000,
  }),
});
const viralHooks = await res.json();
```

### SQL-функция поиска (косинусное расстояние, оператор `<=>`)
```sql
CREATE OR REPLACE FUNCTION match_viral_parts(
  query_embedding vector(1024),
  filter_part_type text,
  match_count int DEFAULT 5,
  filter_niche text DEFAULT NULL,
  min_view_count int DEFAULT 50000
)
RETURNS TABLE (id uuid, content text, niche text, view_count int,
               url text, owner_username text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT ve.id, ve.content, ve.niche, ve.view_count, ve.url, ve.owner_username,
         1 - (ve.embedding <=> query_embedding) AS similarity   -- 1 = идентично
  FROM video_embeddings ve
  WHERE ve.part_type = filter_part_type
    AND COALESCE(ve.view_count, 0) >= COALESCE(min_view_count, 0)
    AND (filter_niche IS NULL OR ve.niche = filter_niche)
  ORDER BY ve.embedding <=> query_embedding   -- меньше расстояние = ближе
  LIMIT match_count;
$$;
```

### Доработка нейросетью (упрощённо)
```js
const userText = `У тебя сценарий пользователя и 20 реальных вирусных хуков, подобранных
семантически. Выбери 10 лучших, адаптируй под сценарий, объясни почему цепляет.
Верни JSON: {"hooks":[{"original","adapted","explanation","views","niche","url","owner_username"}]}`;

const { text } = await callOpenRouter({
  apiKey: OPENROUTER_API_KEY,
  model: MODELS.CLAUDE_SONNET_35,   // 'anthropic/claude-3.7-sonnet'
  messages: [{ role: 'user', content: userText }],
  temperature: 0.5,
  response_format: { type: 'json_object' },
});
```

### Стоимость (`src/constants/tokenCosts.ts`)
```ts
ai_hook: 5,   // Jina embed + Claude Sonnet → топ-10 хуков
```

---

## 6. Инструкция: как повторить с нуля

### Шаг 0. Ключи (env)
```
JINA_API_KEY=...
OPENROUTER_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Шаг 1. Включить pgvector и создать таблицу
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE video_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid,
  part_type text,                 -- 'hook' | 'body' | 'cta'
  content text,
  embedding vector(1024),         -- размерность под Jina v3
  niche text,
  view_count int,
  tier text,
  url text,
  owner_username text,
  created_at timestamptz DEFAULT now()
);

-- индекс для быстрого поиска ближайших по косинусу
CREATE INDEX idx_video_embeddings_hnsw
  ON video_embeddings USING hnsw (embedding vector_cosine_ops);
```

### Шаг 2. Создать RPC-функцию поиска
Скопировать `match_viral_parts` из раздела 5 (или из
`supabase/migrations/create_match_viral_parts_function.sql`).

> Важно: размерность вектора в таблице, в функции и у модели эмбеддингов
> должна совпадать (здесь везде **1024**).

### Шаг 3. Наполнить базу (индексация)
Для каждого вирусного видео с транскрипцией:
1. Gemini Flash → извлечь хук + нишу (промпт см. `populate-video-hooks/index.ts`).
2. Jina embed с `task: 'retrieval.passage'` → вектор.
3. `INSERT` строки в `video_embeddings` (`embedding` хранить как JSON-массив чисел).

Можно вынести в Supabase Edge Function и запускать по расписанию / батчами.

### Шаг 4. Эндпоинт «ИИ-хуки» (онлайн)
1. Принять текст пользователя.
2. `jinaEmbed(text)` с `task: 'retrieval.query'` → вектор.
3. POST на `/rest/v1/rpc/match_viral_parts` с `query_embedding`, `filter_part_type='hook'`,
   `min_view_count`, `match_count: 20`.
4. Сформировать промпт со списком найденных хуков → вызвать Claude Sonnet (JSON-ответ).
5. Вернуть массив хуков в UI. (Опционально: списать монеты и закэшировать в `ai_hooks`.)

### Шаг 5. UI
Кнопка «ИИ-хуки» → лоадер → список карточек: оригинал, адаптация, объяснение,
просмотры, ниша, ссылка на видео, кнопка «копировать».

---

## 7. Частые грабли

- **Несовпадение размерности** вектора (модель vs колонка vs функция) → ошибка вставки/поиска.
- **Перепутан `task`** у Jina (`query` vs `passage`) → заметно хуже релевантность.
- **Нет HNSW-индекса** → поиск работает, но медленно на больших объёмах.
- **`embedding` как строка**: при вставке через REST передавать JSON-массив, при поиске —
  именно `vector(1024)`-совместимый формат.
- **`<=>` это расстояние, а не похожесть**: сортировать `ORDER BY <=> ASC`,
  а `similarity = 1 - (<=>)`.
- **Фильтры до сортировки** (`view_count`, `niche`) сужают выборку — следи, чтобы не
  оставалось меньше `match_count` строк.

---

## 8. Схема одной картинкой

```
ИНДЕКСАЦИЯ (офлайн):
  видео → Gemini(хук+ниша) → Jina[passage] → vector → video_embeddings

ПОИСК (онлайн):
  текст юзера → Jina[query] → vector
                                 │
                                 ▼
                 match_viral_parts (косинус, top-20)
                                 │
                                 ▼
                 Claude Sonnet (выбрать 10 + адаптировать + объяснить)
                                 │
                                 ▼
                            10 хуков в UI
```
