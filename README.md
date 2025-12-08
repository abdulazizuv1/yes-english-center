# YES English Center — фронтенд, мок-тесты и админка

Статический сайт школы YES с модульной архитектурой ES-модулей, Firebase-авторизацией и панелями для управления тестами/пользователями. Ключевые блоки: публичный лендинг, личные мок-тесты после авторизации, кабинеты администратора и студента, облачные функции для создания/удаления пользователей.

## Возможности
- Лендинг с секциями Groups/Results/Feedbacks и динамической подгрузкой данных из Firestore.
- Авторизация через Firebase Auth, проверка роли и отображение нужных ссылок (Mock Tests, Admin Panel, My Settings).
- Три языка интерфейса (en/ru/uz) через `lang.js` + модуль `language.js`.
- Кэширование данных в памяти и IndexedDB (30 мин) для групп/результатов/отзывов.
- Мок-тесты (reading, listening, writing, full) доступны только авторизованным пользователям.
- Админ-панель: создание/удаление пользователей через Cloud Functions, загрузка материалов в Storage, CRUD по тестам и группам.

## Технологии
- HTML/CSS/ES-модули, Swiper 11, AOS, glassmorphism-эффекты.
- Firebase (Auth, Firestore, Storage, Cloud Functions v2).
- Node 20+ для вспомогательных скриптов и функций.

## Структура
- `index.html`, `style.css`, `glass-effects.js`, `lang.js` — публичный лендинг.
- `src/` — модульный фронтенд (Auth, DataLoader с multi-level cache, UI renderer, Swiper config, Helpers). См. подробности в `src/README.md`.
- `pages/mock/` — страницы выбора и прохождения мок-тестов (reading/listening/writing/full + результаты).
- `settings/admin/` — админка (управление пользователями, группами, тестами, загрузками в Storage) на Firebase SDK.
- `settings/user/` — страница настроек студента.
- `functions/` — Cloud Functions (`createUser`, `deleteUser`) с проверкой токена админа.
- `mock-tests/` — примерные данные/скрипты для импорта мок-тестов.
- `image/` — статические изображения.

## Подготовка Firebase-конфига (обязательно)
Создайте файл `config.js` в корне проекта и экспортируйте конфиг вашего Firebase-проекта (используется на лендинге, в мок-страницах и админке):

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..." // опционально
};
```

Для вспомогательных Node-скриптов (`node.js`, `index.mjs`) можно создать `.env` с теми же ключами (`FIREBASE_API_KEY` и т.д.).

## Запуск локально (статический фронт)
1) Убедитесь, что `config.js` заполнен.
2) Поднимите простой сервер из корня, чтобы корректно работали ES-модули:
- `npx serve .` **или** `python -m http.server 8080` и откройте `http://localhost:8080`.

## Работа с Cloud Functions
- Установить зависимости: `npm install --prefix functions`.
- Линт: `npm run lint --prefix functions`.
- Локально (эмулятор): `npm run serve --prefix functions`.
- Деплой только функций: `npm run deploy --prefix functions`.

## Данные и коллекции Firestore
Основные коллекции, которые ожидает фронтенд:
- `groups` — карточки преподавателей/групп (`name`, `position`, `photoURL`, `createdAt`).
- `results` — достижения студентов (`score`, `name`, `photoURL`, `createdAt`).
- `feedbacks` — отзывы (`text`, `author`, `photoURL`, `createdAt`).
- `users` — пользователи с `role` (`admin`/`teacher`/`student`), `name`, `username` (уникален).
- Тестовые коллекции для моков: `readingTests`, `listeningTests`, `writingTests`, `fullMockTests` (структура см. в `pages/mock/**`).

## Потоки использования
- **Публичный лендинг:** данные тянутся из Firestore, прогресс отображается через скелетоны, Swiper обновляется после рендера.
- **Авторизация:** логин по email/username + пароль, проверка роли; после входа показываются ссылки на мок-тесты и кабинеты, при отсутствии `name` предлагается задать имя.
- **Мок-тесты:** доступны только после входа; перенаправление защищено `onAuthStateChanged`.
- **Админка:** защищена проверкой роли в Firestore; создание/удаление пользователей идет через `https://...cloudfunctions.net/createUser|deleteUser` с ID-токеном текущего админа; загрузки в Storage и сохранение ссылок в коллекциях.

## Советы по разработке
- Данные кэшируются в памяти и IndexedDB на 30 минут; при обновлениях используйте функции из `data-loader.js` (`reloadData`) или очищайте IndexedDB вручную.
- Все модули доступны глобально в консоли как `window.App.*` для отладки.
- При добавлении новых тестов придерживайтесь существующих коллекций и схем, чтобы рендер страниц не ломался.

## Лицензия
Проект образовательного центра YES; используйте внутри команды согласно договорённостям.