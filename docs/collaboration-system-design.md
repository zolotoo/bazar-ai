# Система совместной работы над проектами

## Обзор

Система позволяет владельцам проектов приглашать участников через Telegram и синхронизировать изменения в реальном времени, создавая ощущение "шаринга" как в Figma или Notion.

---

## 1. Архитектура решения

### 1.1 Компоненты системы

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (React/Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  UI Layer    │  │  State Mgmt  │  │  Sync Layer │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ WebSocket / SSE
┌─────────────────────────────────────────────────────────────┐
│              Backend (Vercel Serverless / Node.js)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Routes  │  │  Sync Engine │  │  Conflict    │      │
│  │              │  │              │  │  Resolver    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Database (Supabase)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Projects    │  │  Members     │  │  Changes     │      │
│  │  Videos      │  │  Permissions │  │  History     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Real-time (Supabase Realtime / Pusher)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Channels    │  │  Events      │  │  Presence    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Технологический стек

- **Frontend**: React + Zustand (state management) + React Query (sync state)
- **Backend**: Vercel Serverless Functions + Supabase Edge Functions
- **Database**: Supabase PostgreSQL с Row Level Security (RLS)
- **Real-time**: Supabase Realtime (PostgreSQL changes) + WebSocket fallback
- **Telegram Integration**: Telegram Bot API для команд и уведомлений
- **Conflict Resolution**: Operational Transform (OT) или CRDT (Yjs)

---

## 2. Модель данных

### 2.1 Таблицы базы данных

#### `project_members`
```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Telegram username: tg-@username
  role TEXT NOT NULL CHECK (role IN ('read', 'write', 'admin')),
  invited_by TEXT NOT NULL, -- Telegram username пригласившего
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  
  UNIQUE(project_id, user_id),
  INDEX idx_project_members_project (project_id),
  INDEX idx_project_members_user (user_id)
);

-- RLS Policy: участники видят только свои записи
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memberships"
  ON project_members FOR SELECT
  USING (auth.uid()::text = user_id OR 
         EXISTS (SELECT 1 FROM project_members pm 
                 WHERE pm.project_id = project_members.project_id 
                 AND pm.user_id = auth.uid()::text));
```

#### `project_changes` (для истории изменений)
```sql
CREATE TABLE project_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN (
    'video_added', 'video_moved', 'video_deleted', 
    'folder_created', 'folder_renamed', 'folder_deleted',
    'project_updated'
  )),
  entity_type TEXT NOT NULL, -- 'video', 'folder', 'project'
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  vector_clock JSONB, -- Для конфликт-резолюции
  
  INDEX idx_project_changes_project_time (project_id, timestamp DESC),
  INDEX idx_project_changes_entity (entity_type, entity_id)
);
```

#### `project_presence` (кто сейчас редактирует)
```sql
CREATE TABLE project_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  entity_type TEXT, -- 'video', 'folder', null (общий просмотр)
  entity_id UUID,
  cursor_position JSONB, -- Для показа курсора
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(project_id, user_id, entity_type, entity_id),
  INDEX idx_presence_project (project_id)
);

-- Автоматическая очистка старых записей (через 30 секунд неактивности)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM project_presence 
  WHERE last_seen < NOW() - INTERVAL '30 seconds';
END;
$$ LANGUAGE plpgsql;
```

#### Обновление `projects`
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id TEXT NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;
```

#### Обновление `saved_videos` (для синхронизации)
```sql
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS last_modified_by TEXT;
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE saved_videos ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
```

---

## 3. Механизм синхронизации

### 3.1 Стратегия синхронизации

**Подход**: Event Sourcing + Operational Transform

1. **Все изменения записываются как события** в `project_changes`
2. **Клиенты подписываются на изменения** через Supabase Realtime
3. **При конфликтах применяется Operational Transform** (или CRDT)

### 3.2 Поток синхронизации

```
┌─────────────┐
│   User A    │  Изменяет видео (перемещает в папку)
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Client A       │  1. Оптимистичное обновление UI
│  - Apply change │  2. Отправка события на сервер
└──────┬──────────┘
       │ POST /api/project/changes
       ▼
┌─────────────────┐
│  Backend API    │  1. Валидация прав (write)
│  - Validate     │  2. Запись в project_changes
│  - Save change  │  3. Обновление данных
│  - Broadcast    │  4. Broadcast через Realtime
└──────┬──────────┘
       │ Supabase Realtime
       ▼
┌─────────────────┐
│  Supabase DB    │  INSERT INTO project_changes
└──────┬──────────┘
       │ Realtime trigger
       ▼
┌─────────────────┐
│  All Clients    │  1. Получение события
│  (User B, C...) │  2. Применение через OT
│  - Receive      │  3. Обновление UI
│  - Transform    │
│  - Apply        │
└─────────────────┘
```

### 3.3 Реализация синхронизации

#### Frontend Hook: `useProjectSync`

```typescript
// src/hooks/useProjectSync.ts
import { useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useProjectContext } from '../contexts/ProjectContext';
import { useAuth } from './useAuth';

export function useProjectSync(projectId: string) {
  const { user } = useAuth();
  const { currentProject, updateProject } = useProjectContext();

  useEffect(() => {
    if (!projectId || !user) return;

    // Подписка на изменения проекта
    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_changes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          handleChange(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_videos',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          handleVideoChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  const handleChange = useCallback(async (change: ProjectChange) => {
    // Применяем изменение через Operational Transform
    await applyChange(change);
  }, []);

  const sendChange = useCallback(async (
    changeType: ChangeType,
    entityType: string,
    entityId: string,
    oldData: any,
    newData: any
  ) => {
    const { data, error } = await supabase
      .from('project_changes')
      .insert({
        project_id: projectId,
        user_id: `tg-${user?.telegram_username}`,
        change_type: changeType,
        entity_type: entityType,
        entity_id: entityId,
        old_data: oldData,
        new_data: newData,
        vector_clock: generateVectorClock(),
      });

    if (error) {
      console.error('Failed to send change:', error);
      // Rollback optimistic update
    }
  }, [projectId, user]);

  return { sendChange };
}
```

#### Backend API: `/api/project/changes`

```typescript
// api/project/changes.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId, changeType, entityType, entityId, oldData, newData, userId } = req.body;

  // Проверка прав доступа
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!member || (changeType !== 'read' && member.role === 'read')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Сохранение изменения
  const { data: change, error } = await supabase
    .from('project_changes')
    .insert({
      project_id: projectId,
      user_id: userId,
      change_type: changeType,
      entity_type: entityType,
      entity_id: entityId,
      old_data: oldData,
      new_data: newData,
      vector_clock: generateVectorClock(),
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Применение изменения к данным
  await applyChangeToEntity(changeType, entityType, entityId, newData);

  // Realtime автоматически разошлет изменение всем подписчикам

  return res.status(200).json({ success: true, change });
}
```

---

## 4. Обработка конфликтов

### 4.1 Стратегия разрешения конфликтов

**Подход**: Vector Clocks + Last-Write-Wins с ручным разрешением для критических изменений

### 4.2 Vector Clock

```typescript
interface VectorClock {
  [userId: string]: number; // Счетчик изменений от каждого пользователя
}

function generateVectorClock(currentClock?: VectorClock): VectorClock {
  const userId = getCurrentUserId();
  return {
    ...currentClock,
    [userId]: (currentClock?.[userId] || 0) + 1,
  };
}

function compareVectorClocks(vc1: VectorClock, vc2: VectorClock): 'before' | 'after' | 'concurrent' {
  let vc1Before = false;
  let vc2Before = false;

  const allUsers = new Set([...Object.keys(vc1), ...Object.keys(vc2)]);

  for (const user of allUsers) {
    const t1 = vc1[user] || 0;
    const t2 = vc2[user] || 0;

    if (t1 < t2) vc2Before = true;
    if (t2 < t1) vc1Before = true;
  }

  if (vc1Before && !vc2Before) return 'before';
  if (vc2Before && !vc1Before) return 'after';
  return 'concurrent'; // Конфликт!
}
```

### 4.3 Разрешение конфликтов

```typescript
// src/utils/conflictResolver.ts
export async function resolveConflict(
  localChange: ProjectChange,
  remoteChange: ProjectChange
): Promise<ProjectChange> {
  const comparison = compareVectorClocks(
    localChange.vector_clock,
    remoteChange.vector_clock
  );

  // Если изменения не конфликтуют - применяем оба
  if (comparison !== 'concurrent') {
    return comparison === 'after' ? remoteChange : localChange;
  }

  // Конфликт - применяем стратегию в зависимости от типа изменения
  switch (localChange.change_type) {
    case 'video_moved':
      // Last-write-wins для перемещения видео
      return remoteChange.timestamp > localChange.timestamp 
        ? remoteChange 
        : localChange;

    case 'folder_renamed':
      // Показываем диалог выбора пользователю
      return await showConflictDialog(localChange, remoteChange);

    case 'video_deleted':
      // Удаление всегда побеждает
      return localChange.entity_id === remoteChange.entity_id
        ? localChange
        : remoteChange;

    default:
      // По умолчанию - last-write-wins
      return remoteChange.timestamp > localChange.timestamp 
        ? remoteChange 
        : localChange;
  }
}
```

---

## 5. UX дизайн

### 5.1 Для владельца проекта

#### Приглашение участника

**Команда в Telegram**:
```
/project invite @username
```

**Или через UI**:
- Кнопка "Пригласить" в настройках проекта
- Модальное окно с полем для ввода Telegram username
- Выбор роли (read/write/admin)
- Отправка приглашения

**Уведомление участнику**:
```
🔔 Вас пригласили в проект "Название проекта"
Роль: Write
Принять / Отклонить
```

#### Управление участниками

**Список участников** в настройках проекта:
```
👤 @username1 (Admin) [Удалить]
👤 @username2 (Write) [Изменить роль] [Удалить]
👤 @username3 (Read) [Изменить роль] [Удалить]
```

#### Индикаторы активности

- **Presence indicators**: Аватарки участников в правом верхнем углу
- **Кто редактирует**: Подсветка элемента, который редактирует другой пользователь
- **История изменений**: Боковая панель с последними изменениями

### 5.2 Для участника

#### Автоматическое появление проекта

После принятия приглашения:
- Проект автоматически появляется в секции "Общие проекты" в сайдбаре
- Бейдж "Shared" рядом с названием
- Иконка показывает количество активных участников

#### Ограничения по ролям

**Read (только чтение)**:
- Видит все видео и папки
- Не может перемещать, удалять, создавать папки
- Кнопки действий неактивны или скрыты

**Write (редактирование)**:
- Может перемещать видео
- Может создавать/удалять папки
- Не может удалять проект, управлять участниками

**Admin (администратор)**:
- Все права Write
- Может управлять участниками
- Может удалять проект

### 5.3 Визуальные индикаторы

```typescript
// Индикатор присутствия
<div className="flex items-center gap-2">
  {activeMembers.map(member => (
    <div 
      key={member.user_id}
      className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 border-2 border-white"
      title={`@${member.username} онлайн`}
    />
  ))}
</div>

// Индикатор редактирования
{editingMember && (
  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs">
    👤 @{editingMember.username} редактирует
  </div>
)}

// История изменений
<div className="fixed right-0 top-0 h-full w-80 bg-white/90 backdrop-blur-xl border-l border-slate-200">
  <h3>История изменений</h3>
  {recentChanges.map(change => (
    <div key={change.id} className="p-3 border-b">
      <div className="flex items-center gap-2">
        <Avatar username={change.user_id} />
        <span className="text-sm">
          @{change.user_id} {getChangeDescription(change)}
        </span>
      </div>
      <span className="text-xs text-slate-400">{formatTime(change.timestamp)}</span>
    </div>
  ))}
</div>
```

---

## 6. Команды Telegram

### 6.1 Реализация бота

```typescript
// api/telegram/webhook.js
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.command('project', async (ctx) => {
  const [action, username] = ctx.message.text.split(' ').slice(1);

  switch (action) {
    case 'invite':
      await handleInvite(ctx, username);
      break;
    case 'remove':
      await handleRemove(ctx, username);
      break;
    case 'role':
      const [targetUsername, role] = username.split(' ');
      await handleRoleChange(ctx, targetUsername, role);
      break;
    default:
      ctx.reply('Использование: /project [invite|remove|role] @username [role]');
  }
});

async function handleInvite(ctx, username) {
  const projectId = await getCurrentProjectForUser(ctx.from.username);
  const inviterId = `tg-@${ctx.from.username}`;
  const inviteeId = `tg-${username}`;

  // Создаем запись в project_members
  const { data } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: inviteeId,
      role: 'write',
      invited_by: inviterId,
      status: 'pending',
    });

  // Отправляем уведомление приглашенному
  await bot.telegram.sendMessage(
    getTelegramUserId(username),
    `🔔 Вас пригласили в проект!\nПринять: /accept ${projectId}`
  );

  ctx.reply(`✅ Приглашение отправлено @${username}`);
}
```

---

## 7. Edge-cases и ограничения

### 7.1 Обработка edge-cases

1. **Пользователь удален из проекта во время редактирования**
   - Проверка прав перед каждым изменением
   - Откат локальных изменений при потере доступа
   - Уведомление: "Вы больше не имеете доступа к проекту"

2. **Одновременное удаление одного и того же элемента**
   - Vector clock определяет порядок
   - Последнее удаление побеждает
   - Уведомление: "Элемент был удален другим пользователем"

3. **Сетевые проблемы / оффлайн режим**
   - Локальная очередь изменений
   - Синхронизация при восстановлении соединения
   - Индикатор статуса синхронизации

4. **Большое количество участников (>50)**
   - Ограничение на количество участников
   - Пагинация списка участников
   - Группировка presence индикаторов

5. **Telegram username изменился**
   - Использование стабильного ID (Telegram user_id вместо username)
   - Миграция при изменении username

### 7.2 Ограничения

- **Производительность**: При >1000 изменений в минуту может потребоваться батчинг
- **Хранилище**: История изменений может расти быстро - нужна архивация старых записей
- **Telegram API**: Rate limits (30 сообщений/сек) - нужна очередь для уведомлений
- **Supabase Realtime**: Ограничение на количество подписок - один канал на проект

---

## 8. План реализации

### Фаза 1: Базовая инфраструктура (1-2 недели)
- [ ] Создание таблиц БД (project_members, project_changes, project_presence)
- [ ] RLS политики для безопасности
- [ ] API endpoints для управления участниками
- [ ] Базовая UI для приглашения/управления участниками

### Фаза 2: Синхронизация (2-3 недели)
- [ ] Настройка Supabase Realtime подписки
- [ ] Реализация useProjectSync хука
- [ ] Event sourcing для изменений
- [ ] Базовое применение изменений на клиенте

### Фаза 3: Конфликты и оптимизация (1-2 недели)
- [ ] Vector Clock реализация
- [ ] Conflict resolver
- [ ] Оптимистичные обновления UI
- [ ] Обработка оффлайн режима

### Фаза 4: Telegram интеграция (1 неделя)
- [ ] Настройка Telegram бота
- [ ] Команды /project invite/remove/role
- [ ] Уведомления о приглашениях

### Фаза 5: UX полировка (1 неделя)
- [ ] Presence индикаторы
- [ ] История изменений
- [ ] Визуальные индикаторы редактирования
- [ ] Анимации и переходы

---

## 9. Альтернативные подходы

### 9.1 CRDT вместо Operational Transform

**Преимущества**:
- Автоматическое разрешение конфликтов
- Нет необходимости в центральном сервере для трансформаций
- Лучше работает в оффлайн режиме

**Недостатки**:
- Более сложная реализация
- Больше данных для синхронизации
- Может быть избыточно для простых операций

**Рекомендация**: Начать с OT, при необходимости мигрировать на CRDT (Yjs)

### 9.2 Pusher вместо Supabase Realtime

**Преимущества**:
- Более гибкая настройка каналов
- Лучшая поддержка presence
- Больше контроля над событиями

**Недостатки**:
- Дополнительный сервис (стоимость)
- Нужна интеграция с БД

**Рекомендация**: Использовать Supabase Realtime (уже в стеке), при необходимости добавить Pusher для presence

---

## 10. Метрики успеха

- **Время синхронизации**: < 500ms для 95% изменений
- **Конфликты**: < 5% изменений требуют ручного разрешения
- **Надежность**: 99.9% успешных синхронизаций
- **UX**: Пользователи не замечают задержек при совместной работе

---

## Заключение

Предложенное решение обеспечивает:
- ✅ Безопасность через RLS и проверку прав
- ✅ Масштабируемость через event sourcing
- ✅ Надежность через vector clocks и конфликт-резолюцию
- ✅ Удобство через автоматическую синхронизацию и Telegram интеграцию

Система готова к поэтапной реализации с возможностью итеративного улучшения.
