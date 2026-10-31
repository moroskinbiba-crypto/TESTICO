# Tico Retro Games Scraper

Автоматический сборщик раздач ретро-игр с RuTracker для эмулятор-фронтенда Tico.

## Настройка авторизации RuTracker

В актуальной схеме RuTracker используется cookie `bb_session`, а не старый `bb_data`. Скрипт принимает cookie отдельно через GitHub Actions Secrets.

1. Авторизуйтесь на [RuTracker.org](https://rutracker.org) в браузере.
2. Нажмите F12 и откройте **Application → Storage → Cookies → https://rutracker.org**.
3. Добавьте в GitHub Secrets значения cookie из столбца **Value**. Не копируйте сами названия cookie.

Откройте [Settings → Secrets and variables → Actions](https://github.com/moroskinbiba-crypto/TESTICO/settings/secrets/actions) и создайте следующие Repository secrets:

| Secret name | Cookie name |
|---|---|
| `BB_SESSION` | `bb_session` |
| `BB_GUID` | `bb_guid` |
| `BB_SSL` | `bb_ssl` |
| `BB_T` | `bb_t` |
| `CF_CLEARANCE` | `cf_clearance` |

`BB_SESSION` обязателен. Рекомендуется добавить все пять cookie. Не публикуйте их в Issues, коммитах или чатах: они позволяют использовать вашу браузерную сессию.

## Запуск

1. Откройте вкладку **Actions**.
2. Выберите **Run RuTracker Scraper**.
3. Нажмите **Run workflow**.

Скрипт также настроен на еженедельный запуск по воскресеньям в 00:00 UTC.

Результат сохраняется в `rutracker_retro_games_raw.json`.

## Важное замечание о Cloudflare

Cookie `cf_clearance` может быть привязана к IP-адресу и параметрам браузера, а среда GitHub Actions запускается с другого IP. Поэтому даже с корректными секретами RuTracker может вернуть проверку Cloudflare (HTTP 403). В таком случае скрипт завершится с явной ошибкой, а не создаст пустую базу как будто парсинг прошёл успешно.
