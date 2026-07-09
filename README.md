# YES English Center

Платформа подготовки к IELTS учебного центра YES: публичный лендинг, мок-тесты (Listening / Reading / Writing / Full Mock), личный кабинет студента с ежедневным планом подготовки и AI-проверкой письма, админ-панель для управления тестами и пользователями.

Прод: **[yescenter.uz](https://yescenter.uz)**

## Три приложения в одном репозитории

| Приложение | Стек | Где живёт |
|---|---|---|
| Лендинг + мок-тесты | Vanilla JS (ES-модули), без сборки | корень, `pages/mock/` |
| Админ-панель | Vanilla JS, без сборки | `settings/admin/` |
| Дашборд студента | React 19 + Vite (сборка коммитится) | `pages/dashboard/` |

Все три используют общий Firebase (Auth, Firestore, Storage) через `config.js` (в git не хранится).

## Возможности

- **Мок-тесты IELTS** — reading, listening, writing и полный мок; результаты сохраняются в Firestore, доступ к тестам только после входа.
- **Daily Plan** — персональный план подготовки до даты экзамена: студент задаёт уровень по каждой секции, target band и часы в день; план строится детерминированным алгоритмом (`functions/planner.js`), Claude (Haiku) добавляет только персонализацию (веса навыков, недельные темы). Каждый день тренируются все 4 навыка; тесты сайта отмечаются выполненными автоматически.
- **Telegram-бот** `@dailyplan_yes_bot` — утром (7:00) присылает задачи дня, вечером (20:00) напоминает о невыполненных.
- **AI-проверка письма** — Claude оценивает IELTS Writing по официальным дескрипторам с аннотацией ошибок (лимит 2/нед на студента).
- **Проверка Reading Analysis** — Claude проверяет таблицы анализа текста (5/нед).
- **Админка** — CRUD по тестам всех типов, управление пользователями/группами через Cloud Functions, результаты всех студентов.
- Лендинг: 3 языка (en/ru/uz), Swiper, кэширование Firestore-данных (память → IndexedDB, TTL 30 мин), Service Worker.

## Структура

```
index.html, style.css, lang.js     лендинг
src/modules/                       модули лендинга (auth, data, cache, ui, language, callback…)
sw.js                              Service Worker (при изменении статики — поднять версию кэша)
pages/mock/                        мок-тесты: reading/ listening/ writing/ full/ + страницы результатов
pages/dashboard/                   React-дашборд (src/ — исходники, index.html + assets/ — коммитящаяся сборка)
settings/admin/                    админ-панель (добавление/редактирование тестов, пользователи)
functions/                         Cloud Functions (index.js — все функции, planner.js — генератор Daily Plan)
firestore.rules                    правила безопасности — источник правды, деплой через CLI
mock-tests/                        админ-скрипты (admin SDK) и экспорт тестовых данных
docs/SECURITY.md                   что исправлено, известные ограничения, ручные шаги
```

## Настройка

1. **`config.js` в корне** (обязательно, gitignored):

```js
export const firebaseConfig = {
  apiKey: "...", authDomain: "...", projectId: "...",
  storageBucket: "...", messagingSenderId: "...", appId: "...",
};
```

2. **`functions/.env`** — секреты бэкенда (см. `functions/.env.example`): `CLAUDE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `DAILYPLAN_BOT_TOKEN` и др.

3. Для админ-скриптов (`mock-tests/`) нужен `mock-tests/serviceAccountKey.json` (gitignored).

## Локальный запуск

```bash
# Лендинг + мок-тесты (http://localhost:5173, страницы открывать с .html)
npm install && npm run dev

# Дашборд (http://localhost:517x/pages/dashboard/)
cd pages/dashboard && npm install && npm run dev
```

Локальный dev работает с **боевым** Firebase — осторожно с записями.

## Сборка дашборда

```bash
cd pages/dashboard && npm run build
```

Сборка идёт «на место»: чистит `assets/`, восстанавливает entry из `index.dev.html`, кладёт готовые `index.html` + `assets/` — **их нужно коммитить** (cPanel раздаёт файлы из git как есть).

## Cloud Functions

| Функция | Назначение |
|---|---|
| `createUser` / `deleteUser` | управление пользователями (только админ) |
| `generateAIFeedback` | AI-оценка письма (2/нед на студента) |
| `analyzeReadingAnalysis` | AI-проверка reading analysis (5/нед) |
| `generateStudyPlan` | генерация Daily Plan (3/нед) |
| `sendTestNotification` | Telegram-уведомления о сдачах (writing / fullmock / feedback) |
| `submitContactForm` | публичная форма обратной связи лендинга |
| `dailyPlanBotWebhook` | вебхук бота: привязка студента по email, /stop |
| `sendDailyPlanReminders` / `sendEveningNudges` | рассылки 07:00 / 20:00 (Asia/Tashkent) |

```bash
cd functions && npm install
npm run serve   # эмулятор
npm run lint
```

## Деплой

Порядок при изменениях бэкенда: **сначала functions и rules, потом сайт.**

```bash
firebase deploy --only functions --project yes-english-center
firebase deploy --only firestore --project yes-english-center   # rules + indexes
```

Сайт деплоится синхронизацией cPanel: `.cpanel.yml` копирует checkout в `public_html` и удаляет служебные папки (`functions/`, `mock-tests/`, `docs/` не попадают в публичный доступ).

⚠️ Правила Firestore редактируются **только** в `firestore.rules` в репозитории — правки в консоли Firebase будут перезаписаны следующим деплоем.

## Коллекции Firestore

`users`, `groups`, `results`, `feedbacks` (лендинг) · `readingTests`, `listeningTests`, `writingTests`, `fullmockTests` (тесты) · `resultsReading`, `resultsListening`, `resultsWriting`, `resultFullmock` (результаты) · `aiWritingFeedback`, `aiReadingAnalysis` (AI) · `userTargets`, `studyPlans` (Daily Plan) · `telegramLinks` (только сервер).

Ключевые инварианты правил: тесты читаются только после входа; студент создаёт и читает только свои результаты; менять свою `role` нельзя; staff (admin/teacher) видит всё. Подробности и известные ограничения — в `docs/SECURITY.md`.

## Админ-скрипты

```bash
cd mock-tests
node scripts/download-doc.js <collection> <docId>   # выгрузить документ в JSON
```

## Советы по разработке

- Модули лендинга доступны в консоли как `window.App.*`.
- Данные лендинга кэшируются на 30 минут — для сброса `window.App.DataLoader.reloadData()`.
- Меняешь статику, которую кэширует SW, — подними версию кэша в `sw.js`.
- Новые тесты создавай через админку: сборщики валидируют форматы, которые ожидает страница теста (пустой текст вопроса или отсутствующий ответ не дадут сохранить битый тест).
