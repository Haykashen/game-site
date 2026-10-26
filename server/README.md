# DiscVault API

Backend на Fastify + TypeScript + PostgreSQL + Prisma. Обслуживает каталог, коллекцию, маркет, аукционы, сделки, отзывы и загрузку фотографий. Frontend обращается к API по same-origin путям `/api/v1/*` (в dev-режиме через Vite proxy).

## Требования

- Node.js 22+
- PostgreSQL 16+
- Docker и Docker Compose — для локального PostgreSQL и MinIO (опционально; можно использовать свою БД)
- npm 10+

## Быстрый старт

```bash
# 1. Зависимости всего workspace
npm install

# 2. Переменные окружения
copy server/.env.example server/.env      # Windows
# cp server/.env.example server/.env       # macOS / Linux

# 3. PostgreSQL и MinIO (можно пропустить, если БД уже есть)
docker compose up -d

# 4. Prisma client, миграции и демо-данные
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Frontend и API одновременно
npm run dev:full
```

После запуска:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/api/health`
- MinIO console: `http://localhost:9001` (`minioadmin` / `minioadmin`)

`GET /api/health` отвечает `200`, когда процесс и PostgreSQL готовы. Если БД недоступна, возвращается `503` и `{"status":"degraded","database":"down"}`; frontend в этом случае автоматически остаётся в локальном демо-режиме.

## Переменные окружения

Файл `server/.env` (пример — `server/.env.example`):

| Переменная | Назначение |
| --- | --- |
| `NODE_ENV` | `development` / `production` |
| `HOST`, `PORT` | Адрес и порт API (по умолчанию `0.0.0.0:3001`) |
| `DATABASE_URL` | Строка подключения PostgreSQL |
| `CORS_ORIGINS` | Разрешённые origin через запятую |
| `COOKIE_SECURE` | `true` для HTTPS; в dev — `false` |
| `SESSION_TTL_DAYS` | Время жизни сессии в днях (по умолчанию 30) |
| `PUBLIC_API_URL` | Публичный URL API для ссылок на локальные загрузки |
| `UPLOAD_DIR` | Каталог локальных файлов, если S3 недоступен |
| `MAX_UPLOAD_BYTES` | Максимальный размер одного файла |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Параметры S3/MinIO |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Ключи S3/MinIO |
| `S3_PUBLIC_URL` | Публичный префикс объектов |
| `S3_FORCE_PATH_STYLE` | `true` для MinIO |
| `SEED_DEMO_EMAIL`, `SEED_DEMO_PASSWORD` | Демо-аккаунт, создаваемый seed-скриптом |
| `SEED_DEMO_ROLE` | Роль демо-аккаунта: `user`, `moderator` или `admin` |
| `ALLOW_DEMO_SEED` | `true` разрешает демо-seed в production (по умолчанию запрещён) |

Если S3/MinIO недоступны, сервер не падает: фотографии сохраняются в `server/uploads/` и раздаются как `/uploads/*`.

## Скрипты

Из корня репозитория:

```bash
npm run dev              # только frontend
npm run dev:full         # frontend + API
npm run server:dev       # только API (tsx watch)
npm run typecheck        # типы frontend
npm run typecheck:server # типы backend
npm run build            # single-file frontend
npm run build:server     # production-сборка API в server/dist
npm run db:generate      # prisma generate
npm run db:validate      # prisma validate
npm run db:migrate       # prisma migrate deploy (применяет готовые миграции)
npm run db:migrate:dev   # prisma migrate dev (создаёт миграцию при изменении схемы)
npm run db:seed          # демо-данные
npm run db:studio        # Prisma Studio
```

## Демо-аккаунт

После `npm run db:seed`:

- Email: `demo@discvault.local`
- Пароль: `demo12345`

Seed импортирует игры, издания, объявления, обсуждения и новости из `src/data`. Авторы объявлений, тем и ответов создаются как demo-пользователи с `is_demo = true`; вход под ними отключён. Для локальной демонстрации используется только аккаунт выше.

Чтобы проверить очередь модерации локально, задайте `SEED_DEMO_ROLE=admin` в `server/.env` и выполните `npm run db:seed` ещё раз. Роль `moderator` позволяет скрывать объявления, но блокировать пользователей может только `admin`.

## Аутентификация

- Email + пароль, хэширование Argon2id (`@node-rs/argon2`).
- Сессия хранится в PostgreSQL, в cookie `rk_session` лежит только случайный токен; в БД — его SHA-256 хэш.
- Cookie `httpOnly`, `SameSite=Lax`, срок жизни 30 дней (настраивается).
- Приватные маршруты читают сессию из cookie; `credentials: 'include'` обязателен для меж-origin запросов.

## Деньги и даты

- В PostgreSQL все цены хранятся целыми числами в копейках (`*_minor`).
- API принимает и отдаёт рубли (`price`, `currentPrice`, `bidStep`, `packagingPrice`, `amount`).
- Даты в API — ISO 8601. Для дат без времени используется `YYYY-MM-DD`.

## Основные маршруты

### Health

- `GET /api/health`
- `GET /api/v1/health`

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/me`

### Users

- `PATCH /api/v1/users/me`
- `GET /api/v1/users/:id`
- `GET /api/v1/users/:id/reviews`

### Catalog

- `GET /api/v1/catalog/games`
- `GET /api/v1/catalog/games/:id`
- `GET /api/v1/catalog/editions`
- `GET /api/v1/catalog/editions/:id`
- `GET /api/v1/catalog/filters`

### Game ratings

- `GET /api/v1/catalog/games/:id/ratings` — средняя оценка активных пользователей, число голосов и свой балл при наличии сессии.
- `PUT /api/v1/catalog/games/:id/ratings` — поставить или изменить оценку: `{ "score": 8 }`, целое число от 1 до 10, нужна сессия.
- `DELETE /api/v1/catalog/games/:id/ratings` — удалить свой голос, нужна сессия.

Один пользователь имеет один голос на игру. Оценки игр хранятся отдельно от рейтинга продавца и отзывов по сделкам. Перед запуском примените миграции (`npm run db:migrate`).

### Collection

- `GET /api/v1/collection/copies`
- `POST /api/v1/collection/copies`
- `PATCH /api/v1/collection/copies/:id`
- `DELETE /api/v1/collection/copies/:id`
- `PUT /api/v1/collection/editions/:editionId/quantity`
- `PATCH /api/v1/collection/editions/:editionId`
- `DELETE /api/v1/collection/editions/:editionId`
- `GET /api/v1/collection/stats`

### Market

`itemType`: `game`, `cover`, `manual`, `map`, `soundtrack`, `figure`, `steelbook`,
`other`. Старые клиенты без поля создают `game`. Для лута издание необязательно,
игра обязательна; если издание передано, оно должно принадлежать указанной игре.
Параметр `itemType` в `GET /api/v1/market` фильтрует категорию. После первой
ставки категория лота неизменяема. Перед запуском примените миграции.

- `GET /api/v1/market`
- `GET /api/v1/market/mine`
- `GET /api/v1/market/:id`
- `POST /api/v1/market`
- `PATCH /api/v1/market/:id`
- `PATCH /api/v1/market/:id/status`
- `DELETE /api/v1/market/:id`

`DELETE` удаляет пустое объявление физически, а объявление со ставками или сделками — мягко (`deletedAt`).

Новые лоты создаются с `moderationStatus: "pending"` и не отдаются в публичных
лентах, детальной странице, ставках и сделках. Владелец видит их в
`GET /api/v1/market/mine`, модераторы — в очереди проверки.

### Lot moderation

- `GET /api/v1/admin/market?status=pending|visible|hidden|removed|all&kind=listing|auction` — очередь новых лотов (`admin` / `moderator`)
- `PATCH /api/v1/admin/market/:id/moderation` — `visible` для публикации, `hidden` для отклонения, `removed` для снятия, `pending` для возврата на проверку; необязательный `note` сохраняется и отправляется автору

При одобрении лот становится публичным, подписчики игры получают уведомление
`entry_created`, а автор — `entry_approved`. При отклонении автор получает
`entry_rejected` с комментарием. Просроченный аукцион и лот заблокированного
автора опубликовать нельзя.

### Auctions and bids

- `GET /api/v1/market/:id/bids`
- `POST /api/v1/market/:id/bids`

Ставки пишутся в отдельную таблицу `bids`. В транзакции обновляются `current_price_minor`, `bid_count`, `winner_id` и `version`. Первая ставка может быть равна стартовой цене; каждая следующая — не меньше `currentPrice + bidStep`.

Просроченные аукционы закрываются при чтении и фоновой проверкой каждые 30 секунд: со ставками — `sold` и создаётся сделка, без ставок — `closed`.

### Deals and reviews

- `POST /api/v1/market/:id/deals`
- `GET /api/v1/deals`
- `GET /api/v1/deals/:id`
- `PATCH /api/v1/deals/:id/status`
- `POST /api/v1/deals/:id/reviews`

### Admin analytics

- `GET /api/v1/admin/analytics?period=7d|30d|90d|365d` — KPI по играм и пользователям, динамика, топ игр, продавцов, покупателей и коллекционеров (`admin` / `moderator`)

### Reports

- `POST /api/v1/reports` — жалоба на `market_entry` или `user` (только авторизованные)
- `GET /api/v1/reports/mine` — свои жалобы
- `GET /api/v1/admin/reports` — очередь жалоб (`admin` / `moderator`)
- `PATCH /api/v1/admin/reports/:id` — взять в работу, завершить или отклонить; действия `hide_entry` и `suspend_user`
- `PATCH /api/v1/admin/market/:id/moderation` — скрыть, удалить, вернуть или отправить объявление на повторную проверку

### Users

- `GET /api/v1/admin/users?search=&role=all|user|moderator|admin&status=all|active|suspended|deleted&comment=&sortBy=&sortDir=&page=1&pageSize=20` — список всех пользователей с ролями, статусами, комментариями, числом лотов, завершённых сделок и экземпляров в коллекции (только `admin`)
- `PATCH /api/v1/admin/users/:id/status` — заблокировать или разблокировать пользователя (только `admin`)

Один пользователь может иметь только одну открытую жалобу на конкретный лот или профиль. При блокировке пользователя его сессии удаляются, публичные лоты и профиль перестают отдаваться API. Скрытые и ожидающие проверки лоты остаются доступны владельцу и модераторам.

### Discussions

- `GET /api/v1/discussions` — лента тем, фильтры `gameId`, `q`, пагинация и сортировка
- `GET /api/v1/discussions/:id` — тема вместе с деревом ответов
- `POST /api/v1/discussions` — создать тему (только авторизованные)
- `PATCH /api/v1/discussions/:id` — изменить свою тему (модератор может любую); закрепление доступно модераторам
- `DELETE /api/v1/discussions/:id` — удалить свою тему (модератор может любую)
- `POST /api/v1/discussions/:id/comments` — ответить в теме; `parentId` указывает на сообщение, на которое отвечают
- `PATCH /api/v1/discussions/:id/comments/:commentId` — изменить свой ответ
- `DELETE /api/v1/discussions/:id/comments/:commentId` — удалить свой ответ

Ответы хранятся в `discussion_comments` со ссылкой `parent_id` на родительское сообщение. API отдаёт комментарии вложенным деревом `replies` произвольной глубины, а `commentCount` в ленте считает ответы на всех уровнях.

### News

- `GET /api/v1/news` — новости с фильтрами `category`, `gameId`, `q`
- `GET /api/v1/news/:id`
- `POST /api/v1/news` — публикация (`moderator` / `admin`)
- `PATCH /api/v1/news/:id` — редактирование (`moderator` / `admin`)
- `DELETE /api/v1/news/:id` — удаление (`moderator` / `admin`)

### Uploads

- `POST /api/v1/uploads` — multipart-файл
- `POST /api/v1/uploads/data-url` — JSON с data URL

В БД хранятся только URL/S3-ключи. Base64 не попадает в PostgreSQL.

## Режимы frontend

- Если `/api/health` вернул `200` и `database: "up"`, включается API-режим.
- С авторизованной сессией маркет и коллекция читаются/пишутся через API.
- Без сессии, при недоступном API или при открытии single-file сборки через `file://` работает исходный локальный режим на `localStorage`. Демо-ставки, сделки и ответы в обсуждениях в нём тоже доступны; ответы сохраняются между перезагрузками.

## Production

```bash
npm run build:all
npm run db:migrate
npm run server:start
```

Для production:

- поставьте `NODE_ENV=production`, `COOKIE_SECURE=true`;
- используйте HTTPS;
- задайте реальные `DATABASE_URL`, S3-ключи и `CORS_ORIGINS`;
- раздавайте `dist/index.html` статически, а `/api` и `/uploads` проксируйте на Fastify.
