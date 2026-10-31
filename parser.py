import json
import os
import time
import requests
from bs4 import BeautifulSoup

SEARCH_URL = "https://rutracker.org/forum/tracker.php"

CATEGORIES = {
    "NES / Dendy": 2424,
    "SEGA Mega Drive": 2425,
    "Sony PlayStation 1": 2394,
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# RuTracker uses bb_session for account authentication.
# Other cookies are loaded separately so values containing punctuation
# (for example bb_t) are not accidentally split as a Cookie header.
COOKIE_ENV = {
    "bb_session": ("BB_SESSION", "/forum/"),
    "bb_guid": ("BB_GUID", "/forum/"),
    "bb_ssl": ("BB_SSL", "/forum/"),
    "bb_t": ("BB_T", "/forum/"),
    "cf_clearance": ("CF_CLEARANCE", "/"),
}


def create_session():
    session = requests.Session()
    session.headers.update(HEADERS)

    loaded_cookies = []
    for cookie_name, (env_name, path) in COOKIE_ENV.items():
        value = os.environ.get(env_name, "").strip()
        if value:
            session.cookies.set(
                cookie_name,
                value,
                domain=".rutracker.org",
                path=path,
                secure=True,
            )
            loaded_cookies.append(cookie_name)

    if "bb_session" not in loaded_cookies:
        raise RuntimeError(
            "Не задан BB_SESSION. Добавьте cookie bb_session в GitHub Secret BB_SESSION."
        )

    missing = [name for name in COOKIE_ENV if name not in loaded_cookies]
    if missing:
        print("Предупреждение: не заданы дополнительные cookie: " + ", ".join(missing))

    print("Загружены cookie: " + ", ".join(loaded_cookies))
    return session


def parse_rutracker_category(session, category_name, c_id, max_pages=1):
    games_data = []

    for page in range(max_pages):
        start = page * 50
        params = {
            "f": c_id,
            "o": 1,
            "s": 2,
            "start": start
        }

        print(f"Парсим категорию '{category_name}', страница {page + 1}...")
        response = session.get(SEARCH_URL, params=params, timeout=30)

        if response.status_code != 200:
            raise RuntimeError(
                f"RuTracker вернул HTTP {response.status_code}. "
                "Парсинг остановлен; JSON не будет перезаписан пустыми данными."
            )

        if "Just a moment" in response.text or "cf-chl-" in response.text:
            raise RuntimeError(
                "RuTracker вернул страницу проверки Cloudflare вместо результатов. "
                "Cookie cf_clearance могла истечь или не приниматься с IP GitHub Actions."
            )

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
    session = create_session()
    all_retro_games = []

    for cat_name, cat_id in CATEGORIES.items():
        category_results = parse_rutracker_category(
            session, cat_name, cat_id, max_pages=1
        )
        all_retro_games.extend(category_results)

    output_filename = "rutracker_retro_games_raw.json"
    with open(output_filename, "w", encoding="utf-8") as f:
        json.dump(all_retro_games, f, ensure_ascii=False, indent=4)

    print(
        f"\nГотово! Собрано раздач: {len(all_retro_games)}. "
        f"Сохранено в {output_filename}"
    )


if __name__ == "__main__":
    main()
