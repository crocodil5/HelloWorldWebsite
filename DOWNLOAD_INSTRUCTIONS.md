# 📥 Инструкции по загрузке архива проекта

## 🎯 Готов к загрузке

### Архив проекта
- **Файл**: `project_export_clean.tar.gz`
- **Размер**: 341KB (оптимизирован)
- **Расположение**: В родительской директории Replit проекта

### Что включено
✅ Все исходные файлы (client/, server/, shared/)
✅ Конфигурационные файлы (package.json, tsconfig.json, vite.config.ts)
✅ Настройки администратора (config/admins.json)
✅ Домен конфигурация (domain.config)
✅ Шаблоны email (shablon_mail.html)
✅ Полная документация проекта
✅ PayPal шрифты и ресурсы

### Что исключено
❌ node_modules/ (будет восстановлено через npm install)
❌ Служебные файлы (.cache/, .local/, .upm/)
❌ Временные файлы (attached_assets/, database_backup.sql)
❌ Git история (.git/)

## 🚀 Шаги загрузки

### 1. Загрузка архива из Replit
```bash
# В терминале Replit
cd ..
ls -la project_export_clean.tar.gz
```

### 2. Локальная распаковка
```bash
# На локальной машине
tar -xzf project_export_clean.tar.gz
mv workspace replittest
cd replittest
```

### 3. Подготовка к GitHub
```bash
# Переименовать README
mv README_GITHUB.md README.md

# Создать .env файл
touch .env
```

### 4. Инициализация Git
```bash
git init
git add .
git commit -m "Initial commit: PayPal Payment System with Telegram Bot"
```

### 5. Подключение к GitHub
```bash
git remote add origin https://github.com/crocodil5/replittest.git
git branch -M main
git push -u origin main
```

## 📋 Настройка после загрузки

### Переменные окружения (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
TELEGRAM_BOT_TOKEN=8060343326:AAHvHLzqappYiyspQNHNWUD-6AJ4lfc1FtY
SENDGRID_API_KEY=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
RESEND_API_KEY=your_resend_key_here
NODE_ENV=production
```

### Установка зависимостей
```bash
npm install
npm run db:push
npm run dev
```

## ✅ Проверка работоспособности

После установки проверьте:
1. Запуск сервера (http://localhost:5000)
2. Админ панель (http://localhost:5000/admin)
3. Telegram bot функциональность
4. Email уведомления
5. Создание и управление ссылками

## 📖 Документация

Все файлы документации включены в архив:
- `README.md` - Основная документация
- `PROJECT_SETUP_GUIDE.md` - Инструкции по настройке
- `TECHNICAL_DOCUMENTATION.md` - Техническая документация
- `TELEGRAM_BOT_GUIDE.md` - Руководство по боту
- `DEPLOYMENT_README.md` - Инструкции по деплою
- `GITHUB_TRANSFER_GUIDE.md` - Подробная инструкция по переносу

---

**Готово! Архив оптимизирован и готов для загрузки на GitHub. Размер 341KB обеспечивает быструю загрузку.**