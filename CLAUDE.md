# YES English Center — CLAUDE.md

## Инструкция при старте каждого чата
1. Если существует `plans/handoff.md` — прочитай его молча и используй как контекст
2. Не сообщай пользователю что ты читал — просто учитывай содержимое

## Stack & Versions
- **Frontend**: Vanilla JS (ES modules), HTML, CSS — основной сайт и admin панель
- **Dashboard**: React 19 + Vite 7 + React Router 7 + Chart.js (в `pages/dashboard/`)
- **Backend**: Firebase Cloud Functions v2 (Node.js, `functions/`)
- **DB**: Firestore (`yes-english-center` project)
- **Auth**: Firebase Auth
- **Build**: Vite (`npm run build` → `dist/`)
- **Deploy**: cPanel (`.cpanel.yml`) + Firebase Functions
- **Service Worker**: `sw.js` (кэширование)
- **i18n**: `lang.js` (мультиязычность)

## Структура папок
```
/
├── index.html          # Главная страница (Vanilla JS)
├── style.css           # Глобальные стили
├── lang.js             # Переводы / i18n
├── glass-effects.js    # UI эффекты
├── sw.js               # Service Worker
├── config.js           # Firebase config (публичный)
├── src/
│   ├── main.js         # Точка входа
│   └── modules/        # auth, cache, callback, data, language, swiper, ui, utils
├── pages/
│   ├── dashboard/      # React + Vite приложение (admin dashboard)
│   ├── mock/           # Страница полного мока
│   └── mock.html/js    # Mock test entry
├── settings/
│   ├── admin/
│   │   └── tests/
│   │       ├── add/    # Добавление тестов (reading/writing/listening)
│   │       └── edit/   # Редактирование тестов
│   └── user/           # Настройки пользователя
├── mock-tests/
│   ├── app/            # Mock test logic
│   └── data/           # Test data
├── functions/          # Firebase Cloud Functions v2
├── image/              # Статика
├── dist/               # Vite build output (не коммитить)
└── plans/              # Планы задач (см. plans/README.md)
```

## Команды
```bash

# Build in pages/dashboard
npm run build

# Lint
npm run lint

# Preview билда
npm run preview

# Firebase Functions deploy
cd functions && npm run deploy

# Локальный статик-сервер для Vanilla JS части
npx serve . --config serve.json
```

## Что я часто делаю неправильно в таких проектах

1. **Путаю два стека** — в `pages/dashboard/` React с Vite, везде остальном чистый Vanilla JS. Не добавляю React-компоненты туда, где Vanilla JS и наоборот.

2. **Firebase импорты** — проект использует Firebase v12 (modular API). Нельзя писать `firebase.firestore()` — только `import { getFirestore } from 'firebase/firestore'`.

3. **ES modules в Vanilla JS** — все `.js` файлы используют `type="module"`. Нет глобальных переменных через `var`, только `import/export`.

4. **Service Worker кэш** — после изменений в `sw.js` или добавления новых файлов нужно обновить версию кэша, иначе браузер будет показывать старое.

5. **Config.js с ключами в репо** — Firebase config публичный и в git, это нормально для клиентских ключей Firebase. Не пытаться спрятать в `.env`.

6. **Структура тестов** — каждый тип теста (reading/writing/listening) имеет свою папку с `index.js`. Не ломать эту структуру.

7. **cPanel deploy** — `.cpanel.yml` деплоит на хостинг. Проверять что `dist/` актуален перед деплоем.

## Когда использовать каких агентов

| Задача | Агент |
|--------|-------|
| Найти где реализована фича / паттерн | `researcher` |
| Разобраться в структуре модуля | `researcher` |
| Спланировать новую фичу | `researcher` → `architect` |
| Проверить готовый код | `code-reviewer` |
| Написать код | Основной Claude (без агента) |

## Команды Claude Code
- `/plan-feature` — исследование + план реализации с подтверждением
- `/handoff` — сохранить прогресс сессии перед `/clear`
