(() => {
  "use strict";

  // Category IDs confirmed by the user from RuTracker.
  const CATEGORIES = {
    "908": "Игры для PS",
    "357": "Игры для PS2",
    "1116": "PS1 и PSP",
    "773": "Wii U / Wii / GameCube",
    "774": "3DS / DS",
    "968": "Dreamcast",
    "129": "Остальные консоли"
  };

  function detectChallenge() {
    const text = (document.title + " " + (document.body?.innerText || "")).toLowerCase();
    return (
      text.includes("just a moment") ||
      text.includes("checking your browser") ||
      text.includes("verify you are human") ||
      text.includes("проверка безопасности") ||
      location.pathname.includes("/cdn-cgi/challenge-platform/")
    );
  }

  function readTopicId(link) {
    const dataId = link.getAttribute("data-topic_id");
    if (dataId && /^\d+$/.test(dataId)) return dataId;

    try {
      const url = new URL(link.getAttribute("href") || "", location.href);
      const id = url.searchParams.get("t");
      if (id && /^\d+$/.test(id)) return id;
    } catch (_) {
      // Fall through to the regular expression.
    }

    const match = (link.getAttribute("href") || "").match(/[?&]t=(\d+)/);
    return match ? match[1] : null;
  }

  async function collectCurrentCategory() {
    if (!location.pathname.endsWith("/tracker.php")) {
      throw new Error("Открой страницу категории RuTracker (tracker.php), затем повтори сбор.");
    }

    if (detectChallenge()) {
      throw new Error("RuTracker ещё показывает проверку безопасности. Дождись её завершения в обычном Chrome.");
    }

    const categoryId = new URL(location.href).searchParams.get("f");
    const platform = CATEGORIES[categoryId];

    if (!platform) {
      throw new Error("Неизвестная категория. Открой одну из семи категорий консольных игр в меню расширения.");
    }

    // Wait briefly for RuTracker to render the topic table.
    let rows = document.querySelectorAll("tr.t-row");
    for (let attempt = 0; rows.length === 0 && attempt < 20; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      rows = document.querySelectorAll("tr.t-row");
    }

    if (detectChallenge()) {
      throw new Error("RuTracker показывает проверку безопасности. Сначала заверши её в обычном окне браузера.");
    }

    if (rows.length === 0) {
      throw new Error("На странице не найдены строки раздач (tr.t-row). Возможно, разметка RuTracker изменилась или таблица ещё загружается.");
    }

    const games = [];
    for (const row of rows) {
      const titleLink = row.querySelector("a.topictitle");
      if (!titleLink) continue;

      const title = (titleLink.textContent || "").trim();
      const topicId = readTopicId(titleLink);
      if (!title || !topicId) continue;

      const sizeCell = row.querySelector("td.tor-size");
      const rawSize = sizeCell?.getAttribute("data-ts_size") || "0";
      const sizeBytes = /^\d+$/.test(rawSize) ? Number(rawSize) : 0;

      games.push({
        platform,
        title,
        rutracker_id: topicId,
        url: `https://rutracker.org/forum/viewtopic.php?t=${topicId}`,
        size_bytes: sizeBytes
      });
    }

    if (games.length === 0) {
      throw new Error("Строки страницы найдены, но не удалось извлечь названия и ID раздач.");
    }

    return {
      platform,
      category_id: categoryId,
      count: games.length,
      games,
      page_url: location.href
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TICO_COLLECT_CURRENT_CATEGORY") return false;

    collectCurrentCategory()
      .then(result => sendResponse({ ok: true, result }))
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));

    return true;
  });
})();
