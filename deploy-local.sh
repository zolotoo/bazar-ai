#!/bin/bash

# RiRi AI Local Deploy Script

# 1. Проверяем наличие нужных файлов
if [ ! -f "Dockerfile.frontend" ]; then
    echo "❌ Dockerfile.frontend не найден!"
    exit 1
fi

# 2. Устанавливаем зависимости (если надо)
echo "📦 Installing dependencies..."
npm install

# 3. Собираем проект (используем ваши локальные .env переменные)
echo "🚀 Building frontend..."
npm run build

# Проверяем, что dist создана
if [ ! -d "dist" ]; then
    echo "❌ Ошибка билда: папка dist не найдена!"
    exit 1
fi

# 4. Создаем captain-definition
echo "📝 Creating captain-definition..."
echo '{"schemaVersion":2,"dockerfilePath":"./Dockerfile.frontend"}' > captain-definition

# 5. Упаковываем
echo "📦 Packaging..."
tar -czf frontend-local.tar.gz dist/ nginx.conf Dockerfile.frontend captain-definition

# 6. Получаем токен CapRover
echo "🔑 Getting CapRover token..."
CAP_PASSWORD="captain42" # Пароль по умолчанию, замените если другой
RESPONSE=$(curl -s -X POST http://95.182.100.126:3000/api/v2/login \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"$CAP_PASSWORD\"}")

TOKEN=$(echo $RESPONSE | jq -r '.data.token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "❌ Ошибка получения токена! Проверьте пароль или IP сервера."
    echo "Ответ сервера: $RESPONSE"
    exit 1
fi

# 7. Отправляем в CapRover
echo "📡 Deploying to CapRover (riri-fe-dev)..."
curl -X POST http://95.182.100.126:3000/api/v2/user/apps/appData/riri-fe-dev \
  -H "x-captain-auth: $TOKEN" \
  -F "sourceFile=@frontend-local.tar.gz"

echo -e "\n✨ Готово! Проверьте статус в панели CapRover."
