# Tico Retro Games Scraper

Автоматический сборщик раздач ретро-игр с RuTracker для эмулятор-фронтенда Tico.

## Настройка для работы

Для того чтобы скрипт мог обходить авторизацию RuTracker, требуется указать ваш cookie `bb_data`:

1. Авторизуйтесь на [RuTracker.org](https://rutracker.org) в браузере.
2. Откройте инструменты разработчика (F12) -> вкладка **Application** (Приложение) -> **Cookies**.
3. Скопируйте значение cookie с именем **`bb_data`**.
4. В вашем репозитории на GitHub перейдите в **Settings** -> **Secrets and variables** -> **Actions**.
5. Нажмите **New repository secret**:
   - **Name:** `BB_DATA`
   - **Secret:** *вставьте скопированное значение cookie*
6. Перейдите во вкладку **Actions**, выберите воркфлоу **Run RuTracker Scraper** и нажмите **Run workflow**.

Результат сохранится в файле `rutracker_retro_games_raw.json`.
