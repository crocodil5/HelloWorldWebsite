# GitHub Transfer Guide

## Полный перенос проекта на GitHub

### 1. Создание архива проекта
Архив `project_export.tar.gz` создан в родительской директории, исключая:
- node_modules (будет восстановлен через npm install)
- attached_assets (временные файлы)
- .git (будет пересоздан на GitHub)
- Все файлы из .gitignore

### 2. Структура перенесённого проекта
```
project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   ├── public/
│   └── index.html
├── server/                 # Express.js backend
│   ├── db.ts
│   ├── domainUtils.ts
│   ├── index.ts
│   ├── routes.ts
│   ├── storage.ts
│   ├── telegramBot.ts
│   └── vite.ts
├── shared/                 # Shared types and schemas
│   └── schema.ts
├── config/                 # Configuration
│   ├── admins.json
│   └── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
├── domain.config
├── .gitignore
├── README_GITHUB.md        # Основной README для GitHub
└── [документация].md       # Файлы документации
```

### 3. Шаги для создания GitHub репозитория

#### Шаг 1: Создание репозитория на GitHub
1. Зайдите на https://github.com/crocodil5/replittest
2. Нажмите "New repository" или используйте существующий
3. Название: `replittest`
4. Описание: `PayPal Payment System with Telegram Bot Integration`
5. Добавьте README.md
6. Создайте репозиторий

#### Шаг 2: Загрузка файлов
1. Скачайте архив `project_export.tar.gz` из Replit
2. Распакуйте локально: `tar -xzf project_export.tar.gz`
3. Переименуйте `workspace` в `replittest`
4. Переименуйте `README_GITHUB.md` в `README.md`

#### Шаг 3: Инициализация Git
```bash
cd replittest
git init
git add .
git commit -m "Initial commit: PayPal Payment System with Telegram Bot"
git branch -M main
git remote add origin https://github.com/crocodil5/replittest.git
git push -u origin main
```

### 4. Настройка переменных окружения на новом сервере

Создайте файл `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
TELEGRAM_BOT_TOKEN=8060343326:AAHvHLzqappYiyspQNHNWUD-6AJ4lfc1FtY
SENDGRID_API_KEY=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
RESEND_API_KEY=re_123456789_your_resend_key_here
NODE_ENV=production
```

### 5. Установка и запуск

```bash
# Установка зависимостей
npm install

# Настройка базы данных
npm run db:push

# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build
```

### 6. Конфигурация администратора

Обновите `config/admins.json`:
```json
["8146147595"]
```

### 7. Конфигурация домена

Обновите `domain.config`:
```
your-production-domain.com
```

### 8. Важные файлы для переноса

#### Основные файлы проекта:
- ✅ `package.json` - все зависимости
- ✅ `tsconfig.json` - конфигурация TypeScript
- ✅ `vite.config.ts` - конфигурация Vite
- ✅ `drizzle.config.ts` - настройки БД
- ✅ `tailwind.config.ts` - стили
- ✅ `postcss.config.js` - CSS обработка

#### Конфигурационные файлы:
- ✅ `domain.config` - управление доменом
- ✅ `config/admins.json` - администраторы
- ✅ `shablon_mail.html` - шаблон email
- ✅ `.gitignore` - исключения Git

#### Документация:
- ✅ `PROJECT_SETUP_GUIDE.md` - инструкции по настройке
- ✅ `TECHNICAL_DOCUMENTATION.md` - техническая документация
- ✅ `TELEGRAM_BOT_GUIDE.md` - руководство по боту
- ✅ `DEPLOYMENT_README.md` - деплой инструкции
- ✅ `replit.md` - история изменений и архитектура

### 9. Проверка работоспособности

После переноса проверьте:
1. ✅ Запуск сервера (`npm run dev`)
2. ✅ Подключение к базе данных
3. ✅ Работу Telegram бота
4. ✅ Отправку email уведомлений
5. ✅ Создание и управление ссылками
6. ✅ Работу админ панели

### 10. Дополнительные действия

#### Обновление домена в коде (если требуется):
Если меняется домен, обновите:
- `domain.config` файл
- Или используйте команду `/edit_domain new-domain.com` в Telegram боте

#### Настройка SSL и HTTPS:
Для продакшена потребуется:
- SSL сертификат
- Настройка reverse proxy (nginx/apache)
- Firewall конфигурация

### 11. Резервное копирование

Создайте резервную копию важных данных:
```bash
# База данных
pg_dump $DATABASE_URL > backup.sql

# Конфигурация
cp -r config/ backup_config/
cp domain.config backup_domain.config
```

---

## Готово! 🚀

Проект полностью подготовлен для переноса на GitHub. Все файлы организованы, документация создана, и архив готов для загрузки.

**Следующие шаги:**
1. Скачайте архив `project_export.tar.gz`
2. Загрузите на GitHub по инструкции выше
3. Настройте переменные окружения
4. Запустите и протестируйте функциональность