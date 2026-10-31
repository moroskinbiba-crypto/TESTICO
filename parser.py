import json
import os
import time
import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://rutracker.org/forum/tracker.php"

# ID категорий на рутрекере (при необходимости можно изменить или дополнить)
CATEGORIES = {
    "NES / Dendy": 2424,
    "SEGA Mega Drive": 2425,
    "Sony PlayStation 1": 2394,
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Получаем cookie из секретов GitHub Actions или локального окружения
BB_DATA = os.environ.get("BB_DATA", "")

COOKIES = {
    "bb_data": BB_DATA
}


def parse_rutracker_category(category_name, c_id, max_pages=1):
    games_data = []
    session = requests.Session()
    session.headers.update(HEADERS)
    session.cookies.update(COOKIES)

    for page in range(max_pages):
        start = page * 50
        params = {
            "f": c_id,
            "o": 1,
            "s": 2,
            "start": start
        }

        print(f"Парсим категорию '{category_name}', страница {page + 1}...")
        response = session.get(SEARCH_URL, params=params)

        if response.status_code != 200:
            print(f"Ошибка доступа к странице: {response.status_code}")
            break

        soup = BeautifulSoup(response.text, "html.parser")
        topics = soup.find_all("tr", class_="t-row")

        if not topics:
            print("Раздачи не найдены или закончились.")
            break

        for topic in topics:
            try:
                title_tag = topic.find("a", class_="topictitle")
                if not title_tag:
                    continue

                title = title_tag.text.strip()
                topic_id = title_tag.get("data-topic_id") or title_tag.get("href", "").split("t=")[-1]
                link = f"https://rutracker.org/forum/viewtopic.php?t={topic_id}"

                size_tag = topic.find("td", class_="tor-size")
                size_bytes = size_tag.get("data-ts_size") if size_tag else "0"

                games_data.append({
                    "platform": category_name,
                    "title": title,
                    "rutracker_id": topic_id,
                    "url": link,
                    "size_bytes": int(size_bytes) if size_bytes and size_bytes.isdigit() else 0
                })
            except Exception as e:
                print(f"Ошибка при парсинге строки: {e}")
                continue

        time.sleep(2)

    return games_data


def main():
    if not BB_DATA:
        print("ВНИМАНИЕ: Переменная окружения BB_DATA не задана!")

    all_retro_games = []

    for cat_name, cat_id in CATEGORIES.items():
        category_results = parse_rutracker_category(cat_name, cat_id, max_pages=1)
        all_retro_games.extend(category_results)

    output_filename = "rutracker_retro_games_raw.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(all_retro_games, f, ensure_ascii=False, indent=4)

    print(f"\nГотово! Собрано раздач: {len(all_retro_games)}. Сохранено в {output_filename}")


if __name__ == "__main__":
    main()
