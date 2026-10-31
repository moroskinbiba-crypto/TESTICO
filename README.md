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

## Portable EXE для Windows (без установки Python)

Готовая Windows x64-сборка публикуется на странице [Releases](https://github.com/moroskinbiba-crypto/TESTICO/releases/tag/windows-latest).

1. Скачай `TicoRuTrackerScraper-Windows-x64.zip`.
2. Распакуй архив целиком в обычную папку, например `C:\TicoScraper`. Не запускай EXE прямо из ZIP.
3. Убедись, что установлен Google Chrome.
4. Запусти `TicoRuTrackerScraper.exe`.
5. В открывшемся окне Chrome авторизуйся на RuTracker и пройди проверку, если она появится.
6. Вернись в консоль программы и нажми Enter.
7. JSON появится рядом с EXE: `rutracker_retro_games_raw.json`.

Python, pip, виртуальное окружение и отдельная установка Playwright не нужны. Google Chrome должен быть установлен на компьютере.

Сессия хранится в папке `.rutracker-profile` рядом с EXE. Не удаляй её, если хочешь сохранять вход. Не передавай эту папку другим людям и не загружай её в GitHub. Не запускай одновременно две копии программы с одним профилем.

Если Windows SmartScreen покажет предупреждение о неизвестном издателе, это связано с тем, что сборка не подписана сертификатом издателя. Запускай файл только если скачал его из официального Releases этого репозитория.

