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

## Запуск на Windows (рекомендуется при HTTP 403 в GitHub Actions)

Для локального запуска используется отдельный Chromium через Playwright. Cookie вручную копировать не нужно: войди в RuTracker в открывшемся окне, а браузерный профиль сохранится в папке `.rutracker-profile`.

1. Установи Python 3.10 или новее с сайта https://www.python.org/downloads/windows/. Во время установки включи **Add Python to PATH**.
2. Скачай ZIP репозитория через **Code → Download ZIP** и распакуй его, например, в `C:\TicoScraper`.
3. Запусти файл `run_local.bat` двойным щелчком. Он создаст виртуальное окружение, установит библиотеки и Chromium, а затем запустит парсер. При первом запуске установка браузера займёт немного времени.
4. Откроется окно Chromium. Войди в свой аккаунт RuTracker и, если сайт попросит, пройди проверку Cloudflare обычным способом.
5. Вернись в окно консоли и нажми Enter. Скрипт соберёт три категории и сохранит `rutracker_retro_games_raw.json` в папке проекта.

При следующих запусках используй ту же папку проекта: сессия хранится в `.rutracker-profile`. Не удаляй эту папку, пока хочешь сохранять вход. Не отправляй её другим людям и не загружай в GitHub.

Для ручного запуска из PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-local.txt
.\.venv\Scripts\python.exe -m playwright install chromium
.\.venv\Scripts\python.exe parser_local.py
```
