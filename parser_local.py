import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlencode

from bs4 import BeautifulSoup
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

# In Python, keep data beside the script; in a frozen build, keep it beside the EXE.
if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent

PROFILE_DIR = BASE_DIR / ".rutracker-profile"
OUTPUT_FILE = BASE_DIR / "rutracker_retro_games_raw.json"

SEARCH_URL = "https://rutracker.org/forum/tracker.php"
HOME_URL = "https://rutracker.org/forum/index.php"

CATEGORIES = {
    "NES / Dendy": 2424,
    "SEGA Mega Drive": 2425,
    "Sony PlayStation 1": 2394,
}


def page_looks_like_challenge(page):
    try:
        title = page.title().lower()
        body = page.locator("body").inner_text(timeout=3000).lower()
    except Exception:
        return True

    markers = (
        "just a moment",
        "checking your browser",
        "verify you are human",
        "cf-chl-",
    )
    return any(marker in title or marker in body for marker in markers)


def parse_category(page, category_name, category_id):
    params = {
        "f": category_id,
        "o": 1,
        "s": 2,
        "start": 0,
    }
    url = f"{SEARCH_URL}?{urlencode(params)}"

    print(f"\nПарсим категорию: {category_name}")
    response = page.goto(url, wait_until="domcontentloaded", timeout=60000)

    if response is not None and response.status >= 400:
        raise RuntimeError(
            f"RuTracker ответил HTTP {response.status} для категории {category_name}."
        )

    # Даём странице время дорисовать таблицу результатов.
    try:
        page.wait_for_selector("tr.t-row", timeout=15000)
    except PlaywrightTimeoutError:
        pass

    if page_looks_like_challenge(page):
        raise RuntimeError(
            "Открылась проверка Cloudflare. Пройди её в окне Chromium, "
            "затем запусти скрипт ещё раз."
        )

    soup = BeautifulSoup(page.content(), "html.parser")
    topics = soup.find_all("tr", class_="t-row")

    if not topics:
        title = page.title()
        raise RuntimeError(
            f"Не найдены строки раздач в категории '{category_name}'. "
            f"Заголовок страницы: {title!r}. Возможно, сессия не авторизована "
            "или RuTracker изменил разметку."
        )

    games = []
    for topic in topics:
        title_tag = topic.find("a", class_="topictitle")
        if not title_tag:
            continue

        title = title_tag.get_text(" ", strip=True)
        href = title_tag.get("href", "")
        topic_id = title_tag.get("data-topic_id")

        if not topic_id:
            match = re.search(r"(?:\?|&)t=(\d+)", href)
            topic_id = match.group(1) if match else None

        if not topic_id:
            continue

        size_tag = topic.find("td", class_="tor-size")
        size_raw = size_tag.get("data-ts_size", "0") if size_tag else "0"
        size_bytes = int(size_raw) if str(size_raw).isdigit() else 0

        games.append({
            "platform": category_name,
            "title": title,
            "rutracker_id": str(topic_id),
            "url": f"https://rutracker.org/forum/viewtopic.php?t={topic_id}",
            "size_bytes": size_bytes,
        })

    print(f"Найдено раздач: {len(games)}")
    time.sleep(2)
    return games


def main():
    print("Локальный парсер RuTracker для Tico")
    print(f"Профиль браузера: {PROFILE_DIR}")
    print("Cookie вручную копировать не нужно — Chromium сохранит сессию локально.")

    with sync_playwright() as playwright:
        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(PROFILE_DIR),
                channel="chrome",
                headless=False,
                locale="ru-RU",
                viewport={"width": 1440, "height": 900},
            )
        except Exception as exc:
            raise RuntimeError(
                "Не удалось запустить Google Chrome. Установи Google Chrome для Windows "
                "и попробуй снова. "
                f"Подробности: {exc}"
            ) from exc

        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto(HOME_URL, wait_until="domcontentloaded", timeout=60000)

            print("\nВ открывшемся окне Chromium:")
            print("1. Войди в свой аккаунт RuTracker, если сайт этого попросит.")
            print("2. Если появится проверка Cloudflare, пройди её обычным способом.")
            print("3. Убедись, что сайт открылся и аккаунт авторизован.")
            input("\nПосле этого вернись в PowerShell и нажми Enter... ")

            if page_looks_like_challenge(page):
                raise RuntimeError(
                    "Cloudflare всё ещё показывает проверку. "
                    "Заверши её в браузере и запусти скрипт повторно."
                )

            all_games = []
            for category_name, category_id in CATEGORIES.items():
                all_games.extend(
                    parse_category(page, category_name, category_id)
                )

            if not all_games:
                raise RuntimeError(
                    "Не найдено ни одной раздачи. Существующий JSON не перезаписан."
                )

            temp_file = OUTPUT_FILE.with_suffix(".json.tmp")
            temp_file.write_text(
                json.dumps(all_games, ensure_ascii=False, indent=4),
                encoding="utf-8",
            )
            temp_file.replace(OUTPUT_FILE)

            print(
                f"\nГотово! Собрано раздач: {len(all_games)}."
                f"\nФайл: {OUTPUT_FILE}"
            )
        finally:
            context.close()


if __name__ == "__main__":
    main()
