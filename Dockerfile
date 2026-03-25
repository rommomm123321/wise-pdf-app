# Этап 1: Сборка фронтенда (React + Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
# Копируем package.json и устанавливаем зависимости
COPY frontend/package*.json ./
RUN npm install
# Копируем весь код фронтенда и билдим его (результат будет в папке dist)
COPY frontend/ .
RUN npm run build

# Этап 2: Настройка бэкенда и объединение
FROM node:20-alpine
WORKDIR /app/backend

# Копируем package.json бэкенда и устанавливаем зависимости
COPY backend/package*.json ./
RUN npm install --production

# Копируем исходный код бэкенда и папку prisma
COPY backend/ ./

# Генерируем Prisma Client (для Linux Alpine)
RUN npx prisma generate

# Копируем сбилженный фронтенд из первого этапа в папку public бэкенда
COPY --from=frontend-builder /app/frontend/dist ./public

# Указываем порт, который будет слушать Express
EXPOSE 3000

# Запускаем сервер
CMD ["node", "server.js"]
