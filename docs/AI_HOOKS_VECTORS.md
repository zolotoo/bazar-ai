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

## 6. Детальная логика: как из видео рождается вектор хука

Файл: `supabase/functions/populate-video-hooks/index.ts`.

**Главное:** мы НЕ превращаем видео в вектор целиком. Сначала из транскрипции
выделяется **только текст хука** (1–3 первых цепляющих предложения), и в вектор
кодируется именно эта короткая строка. Поэтому поиск находит похожие *зацепки*,
а не похожие *темы целиком*.

### Пошагово для одного видео

**Шаг 1. Выбор исходного текста.** Берутся видео с `view_count >= 50000` и
непустой транскрипцией. Из двух полей выбирается русский текст:
```ts
const transcript = (video.translation_text?.trim() || video.transcript_text?.trim()) ?? '';
// приоритет — перевод (ru), иначе оригинал; < 20 символов → пропуск
```
Благодаря этому в базе все хуки на одном языке (ru) → векторы сопоставимы.

**Шаг 2. Извлечение хука нейросетью (Gemini Flash).** Сырая транскрипция
(первые 3000 символов) идёт в Gemini с `temperature: 0.1`, ответ строго JSON:
```ts
// prompt просит: «первые 1-3 предложения, заканчивается там,
// где начинается основное содержание» + выбрать нишу из 16 значений
{"hook": "текст хука", "niche": "fitness"}
// хук короче 5 символов → видео отбраковывается
```
В вектор пойдёт **не вся транскрипция**, а очищенный, осмысленно вырезанный хук.
Качество вектора зависит от того, как Gemini вырезал хук.

**Шаг 3. Текст хука → вектор (Jina).** Кодируется ТОЛЬКО строка хука:
```ts
body: JSON.stringify({
  model: 'jina-embeddings-v3',
  input: [parsed.hook],        // <- только хук, не весь сценарий
  task: 'retrieval.passage',   // режим "документа в базе"
})
// → массив из 1024 чисел
```

**Шаг 4. Сохранение вектора рядом с метаданными:**
```ts
await supabase.from('video_embeddings').insert({
  part_type: 'hook',
  content: parsed.hook,                  // сам текст (для показа)
  embedding: JSON.stringify(embedding),  // вектор[1024]
  niche: parsed.niche,
  script_length: getScriptLength(transcript), // short(<80) / medium(<200) / long
  view_count,
  tier: getTier(view_count),             // 1m+ / 500k+ / 100k+ / 50k+
  url, owner_username,
});
```

### Что важно понять про логику превращения

1. **Двухступенчатость:** LLM-извлечение (видео → чистый хук), затем эмбеддинг
   (хук → числа). Это два разных шага с разными моделями.
2. **Кодируется короткий текст**, а не весь сценарий → векторы сравниваются
   «зацепка к зацепке».
3. **Единый язык (ru)** на этапе индексации → векторное пространство однородно.
4. **Асимметрия query/passage:** документ-хук → `passage`, запрос юзера → `query`.
5. **Идемпотентность:** перед обработкой проверяется, нет ли уже строки
   `part_type='hook'` для этого `video_id` — повторно не считаем.
6. **Метаданные ≠ вектор:** ниша, просмотры, tier хранятся отдельными колонками
   и работают как обычные SQL-фильтры *до* векторной сортировки, не зашиты в вектор.

```
видео.translation_text / transcript_text
        │  Gemini Flash (temp 0.1)
        ▼
"текст хука" + niche
        │  Jina v3 (task=passage)
        ▼
vector[1024]
        │
        ▼
video_embeddings(part_type='hook', content, embedding, niche, view_count, tier, url, ...)
```

---

## 7. Как система понимает, какой хук подходит юзеру

Понимание идёт в **два этапа**: сначала математика (грубый отбор), потом нейросеть
(тонкий отбор). Ни один этап не «понимает» в человеческом смысле — они дополняют
друг друга. Код: `handleGenerateAiHook` в `api/scriptwriter.js`.

### Этап 1. Математика: близость векторов (отбор 20 кандидатов)

Текст юзера превращается в вектор через Jina в режиме `retrieval.query`, затем
Postgres считает косинусное расстояние до всех хуков базы и берёт 20 ближайших:
```js
const embedding = await jinaEmbed(queryText);                 // вектор запроса
const viralHooks = await matchViralHooks(embedding, { minViews: min_views, limit: 20 });
```
```sql
1 - (ve.embedding <=> query_embedding) AS similarity   -- 1 = почти идентично по смыслу
ORDER BY ve.embedding <=> query_embedding              -- кто ближе, тот выше
LIMIT 20
```
**Что значит «близко»:** у похожих по смыслу текстов числа в векторе похожи, угол
между векторами маленький → расстояние маленькое. Юзер пишет про похудение →
ближайшими будут хуки про вес/тело/трансформацию, даже если слова не совпадают
дословно. Это семантический поиск: совпадение по смыслу, а не по словам.

Параллельно работают **жёсткие SQL-фильтры** (не вектор): `view_count >= min_views`,
опционально ниша — невирусные хуки в кандидаты не попадают.

> Итог этапа 1: из тысяч хуков остаётся 20 самых смыслово-близких и вирусных.
> Быстро и дёшево, но грубо — вектор ловит тему, но не чувствует стиль и уместность.

### Этап 2. Нейросеть: смысловой отбор (из 20 → 10 лучших)

20 кандидатов с метаданными текстом скармливаются Claude 3.7 Sonnet:
```
Выбери 10 ЛУЧШИХ хуков — наиболее релевантных теме и стилю сценария пользователя.
Для каждого — адаптируй под сценарий (минимальные изменения, сохрани технику).
Объясни, ПОЧЕМУ хук цепляет — какую психологическую технику использует.
```
Здесь происходит то, что вектор не умеет:
- **отсев нерелевантных** — вектор мог притянуть смежную, но не ту тему;
- **учёт стиля и тона** сценария, а не только темы;
- **адаптация** — переписывает хук под тему юзера, сохраняя приём;
- **объяснение** — называет психологический приём (любопытство, шок, паттерн-прерывание).

> Итог этапа 2: 10 готовых, адаптированных и объяснённых хуков по реальной уместности.

### Почему именно связка, а не один из этапов

| | Только вектор | Только Claude | Связка (как у нас) |
|---|---|---|---|
| Скорость / цена | дёшево | дорого (нельзя дать тысячи хуков в промпт) | дёшево сузить → точно отобрать |
| Понимание смысла | грубо (тема) | тонко (тема + стиль) | оба уровня |
| Откуда хуки | из реальной базы | мог бы выдумать | из реальной вирусной базы |

Вектор отвечает: **«какие 20 хуков вообще про это?»** — быстро, из всей базы.
Claude отвечает: **«какие 10 реально подойдут именно этому юзеру и почему?»** — умно,
но только по короткому списку.

```
текст юзера
   │ Jina (query) → вектор[1024]
   ▼
косинусный поиск + фильтры (views, niche)   →  20 ближайших хуков
   │
   ▼
Claude Sonnet: релевантность теме+стилю      →  10 лучших + адаптация + объяснение
   │
   ▼
выдача юзеру
```

**Ключевой нюанс:** «подходит» решает Claude на этапе 2, но он выбирает только из
того, что принёс вектор на этапе 1. Если вектор не нашёл нужное в топ-20 — Claude
это уже не увидит. Качество финала зависит от обоих этапов.

---

## 8. Почему именно Jina (а не OpenAI / Cohere)

> В коде явного обоснования нет — это продуктовое решение. Ниже — почему Jina
> объективно хорошо ложится на задачу.

1. **Мультиязычность.** Контент русскоязычный; `jina-embeddings-v3` —
   мультиязычная модель и хорошо кодирует русский. Многие дешёвые эмбеддеры
   заточены под английский и на русском дают худшую релевантность.
2. **Раздельные `task` (query / passage)** — ровно наш сценарий: документ-хук
   кодируется как `passage`, запрос юзера — как `query`. Это асимметричный поиск
   «короткий запрос ↔ короткий хук», даёт прирост точности. У OpenAI такого нет.
3. **1024 измерения — баланс качество/цена/скорость.** Компактный вектор: дешевле
   хранить, быстрее искать по HNSW, чем у моделей с 1536–3072 при сравнимом
   качестве на коротких текстах (хуки — это 1–3 предложения).
4. **Простой REST + отдельный провайдер.** LLM идут через OpenRouter, эмбеддинги —
   отдельным HTTP к Jina. Зависимости развязаны: смена LLM-модели ничего не ломает.

**Чем можно заменить:**
- **OpenAI `text-embedding-3-small`** (1536) — удобно, но нет query/passage и слабее на ru.
- **Cohere `embed-multilingual-v3`** — сильный мультиязычный аналог с типами входа
  (`search_query` / `search_document`), ближайший по логике.

> Реальные мотивы могли быть и приземлённее: цена за эмбеддинг, бесплатный тариф,
> или что было под рукой на старте.

---

## 9. Инструкция: как повторить с нуля

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

## 10. Частые грабли

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

## 11. Схема одной картинкой

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
