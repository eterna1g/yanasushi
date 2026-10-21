# YANASUSHI Delivery

Сайт доставки суши: отдельные страницы каталога, общая корзина, промо-слайдер и панель управления меню.

## Локальный запуск

```sh
npm ci
npm run build
npm start
```

Node.js 24 и Python 3. Откройте порт 8000. Готовые HTML/JS-файлы также входят в репозиторий. Карточки каталога видны без JavaScript; для корзины нужен JavaScript.

## Страницы

- `index.html` — главная и предложения.
- `sushi.html`, `sets.html`, `promo.html`, `extras.html` — меню.
- `contacts.html` — контакты и доставка.
- `admin.html` — управление меню.

## Публикация

Workflow `.github/workflows/pages.yml` собирает и публикует сайт при каждом push в `main`. В Settings → Pages нужно выбрать Source: **GitHub Actions**.

Адрес после первой успешной публикации: https://eterna1g.github.io/yanasushi/

`npm run export` создаёт `dist/` только с публичными файлами сайта. Исходники Worker, тесты и служебные файлы туда не входят.

## Telegram и админ-панель

API заказов: https://yellow-term-d7c1.zubashenkoserhii.workers.dev

Адрес задан в `ORDER_API_URL` файла `site-settings.js` и используется витриной и админ-панелью. Telegram-токен хранится только в секретах Cloudflare Worker. Публикация сайта не изменяет Worker и не отправляет тестовые заказы.

Существующий Worker может принимать заказы без поддержки каталога: в таком случае сайт показывает встроенные 17 позиций. Для публикации меню из админ-панели нужны API `/catalog`, KV-привязка `CATALOG` и секрет `ADMIN_TOKEN` — см. [ADMIN_SETUP.md](ADMIN_SETUP.md).

Origin для CORS: `https://eterna1g.github.io`, без пути репозитория.

Контактные ссылки, номер телефона, адрес и условия доставки задаются в `site-settings.js`. Реальные контактные данные пока не заполнены.

## Проверки

```sh
npm test
npm run test:browser
```

Для браузерных проверок нужен Chromium: `npx playwright install chromium` или установленный системный браузер. Тесты не отправляют сообщения в Telegram.

Источники фотографий: [assets/PHOTO_SOURCES.md](assets/PHOTO_SOURCES.md).
