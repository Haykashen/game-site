# Тестовый стенд на VPS: Docker Compose + Caddy

Эта схема поднимает полноценный стенд с PostgreSQL, Fastify API, загрузкой
фотографий и HTTPS на одном домене:

```text
Интернет
   │ 80/443
   ▼
 Caddy (web) ── /api/*, /uploads/* ──► Fastify API (api) ──► PostgreSQL (db)
   │
   └── dist/index.html (React single-file build)
```

Caddy сам получает сертификат Let's Encrypt. PostgreSQL и загруженные файлы
хранятся в Docker volumes, поэтому переживают перезапуск контейнеров.

## Что понадобится

- VPS с Ubuntu 24.04, 2 ГБ RAM и 2 vCPU (для теста достаточно).
- Публичный IPv4.
- Открытые порты `22`, `80`, `443`.
- Домен **не обязателен**: можно использовать бесплатный `<IP>.sslip.io`
  (например, `203.0.113.10.sslip.io`).
- Репозиторий на GitHub или доступ к нему по SSH.

## 1. Подготовить VPS

Подключитесь к серверу и обновите систему:

```bash
sudo apt update && sudo apt upgrade -y
```

Установите Docker и Compose plugin:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

Если включён UFW, откройте нужные порты:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 2. Настроить домен

### Вариант без покупки домена

Узнайте публичный IP сервера:

```bash
curl -4 ifconfig.me
```

Пусть IP равен `203.0.113.10`. Тогда публичный адрес будет:

```text
203.0.113.10.sslip.io
```

Ничего настраивать в DNS не нужно: `sslip.io` сам резолвит IP из имени.

### Вариант со своим доменом

Создайте A-запись:

```text
game.example.com → 203.0.113.10
```

Дождитесь обновления DNS. Проверка:

```bash
dig +short game.example.com
```

## 3. Склонировать проект

```bash
git clone https://github.com/Haykashen/game-site.git
cd game-site
git checkout main
```

## 4. Создать `.env`

```bash
cp deploy/env.production.example .env
nano .env
```

Обязательно замените:

- `APP_DOMAIN` — только домен, без `https://` (например, `game.example.com`).
- `POSTGRES_PASSWORD` — длинный пароль.
- `DATABASE_URL` — тот же пароль, хост `db`.
- `CORS_ORIGINS` и `PUBLIC_API_URL` — `https://<APP_DOMAIN>` без слэша на конце.
- `SEED_DEMO_EMAIL`, `SEED_DEMO_PASSWORD` — данные администратора для теста.

Пример для `203.0.113.10.sslip.io`:

```dotenv
APP_DOMAIN=203.0.113.10.sslip.io

POSTGRES_USER=discvault
POSTGRES_PASSWORD=very-long-random-password
POSTGRES_DB=discvault
DATABASE_URL=postgresql://discvault:very-long-random-password@db:5432/discvault?schema=public

CORS_ORIGINS=https://203.0.113.10.sslip.io
PUBLIC_API_URL=https://203.0.113.10.sslip.io

NODE_ENV=production
HOST=0.0.0.0
PORT=3001
COOKIE_SECURE=true
SESSION_TTL_DAYS=30
UPLOAD_DIR=/data/uploads
MAX_UPLOAD_BYTES=10485760

SEED_DEMO_EMAIL=admin@example.com
SEED_DEMO_PASSWORD=change-me-demo-password
SEED_DEMO_ROLE=admin
ALLOW_DEMO_SEED=true
```

Важно: если в пароле есть `@`, `:`, `/`, `#`, `?` и другие спецсимволы,
их нужно URL-кодировать в `DATABASE_URL`. Для теста проще использовать
пароль из букв и цифр.

## 5. Собрать и запустить

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

При старте API автоматически применяет миграции Prisma. Проверьте логи:

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

Дождитесь, пока Caddy выпустит сертификат. Первый запуск может занять
1–2 минуты.

Проверка API:

```bash
curl -fsS https://203.0.113.10.sslip.io/api/health
```

Ожидаемый ответ:

```json
{"status":"ok","service":"discvault-api","database":"up","time":"..."}
```

## 6. Залить демо-данные

```bash
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

После этого можно войти с данными из `.env`:

- email: `SEED_DEMO_EMAIL`
- пароль: `SEED_DEMO_PASSWORD`

Для проверки админки оставьте `SEED_DEMO_ROLE=admin`.

## 7. Открыть сайт

Откройте:

```text
https://<APP_DOMAIN>
```

Проверьте:

- каталог и карточки игр;
- вход и сохранение сессии после перезагрузки;
- коллекцию;
- создание лота с фотографией;
- модерацию и жалобы под админом;
- `/api/health` отвечает `200`.

## Обновление стенда

Для автоматического обновления после push в `main` см. [AUTO_DEPLOY.md](AUTO_DEPLOY.md).
Workflow проверяет сборку и миграции, сохраняет БД и фотографии и заменяет
только образы приложения. Новые миграции требуют отдельного ручного запуска.

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Миграции применятся автоматически при перезапуске API. Если миграция
несовместима с текущими данными, сначала сделайте резервную копию БД.

## Резервная копия

Дамп PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U discvault discvault > backup.sql
```

Восстановление:

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U discvault -d discvault
```

Загруженные фотографии лежат в volume `uploads`. Для тестового стенда
достаточно периодически копировать volume или использовать S3/MinIO.

## Остановка

```bash
docker compose -f docker-compose.prod.yml down
```

Данные сохраняются. Команда `down -v` удаляет PostgreSQL, загрузки и
сертификаты Caddy — используйте её только если хотите полностью очистить стенд.

## Если что-то не работает

### Caddy не получает сертификат

Проверьте:

```bash
dig +short <APP_DOMAIN>
docker compose -f docker-compose.prod.yml logs web
```

Домен должен указывать на IP VPS, а порты `80` и `443` — быть открыты.
Для `sslip.io` DNS настраивать не нужно.

### API перезапускается

```bash
docker compose -f docker-compose.prod.yml logs api
```

Чаще всего причина — неверный `DATABASE_URL`, пароль PostgreSQL или
неприменённая миграция.

### Вход не сохраняется

Сайт должен открываться по `https://`, а `COOKIE_SECURE` должен быть `true`.
Не тестируйте вход по `http://<IP>`: защищённая cookie не установится.

### Фото не открываются

Проверьте, что Caddy проксирует `/uploads/*` на API, а volume `uploads`
подключён к контейнеру `api`. При использовании S3 заполните `S3_*`
в `.env`.

### Нужно поменять пароль БД

Пароль PostgreSQL хранится в volume. После первого запуска простого
изменения `.env` недостаточно: нужно либо сменить пароль внутри PostgreSQL,
либо удалить volume и развернуть БД заново (данные будут потеряны).

## Ограничения тестового стенда

- `ALLOW_DEMO_SEED=true` предназначен только для тестового окружения.
- Для реального продакшена нужны резервное копирование, мониторинг,
  ограничение доступа к SSH и отдельные секреты.
- Загруженные файлы хранятся на диске VPS. Для нескольких серверов
  используйте S3/MinIO.
