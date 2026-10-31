const CATEGORY_URLS = {
  "2424": "https://rutracker.org/forum/tracker.php?f=2424&o=1&s=2&start=0",
  "2425": "https://rutracker.org/forum/tracker.php?f=2425&o=1&s=2&start=0",
  "2394": "https://rutracker.org/forum/tracker.php?f=2394&o=1&s=2&start=0"
};

const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const collectButton = document.getElementById("collect");
const exportButton = document.getElementById("export");
const clearButton = document.getElementById("clear");

function showStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? " " + type : "");
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

async function refreshSummary() {
  const data = await chrome.storage.local.get({ games: [], collected: {} });
  const games = Array.isArray(data.games) ? data.games : [];
  const collected = data.collected || {};
  const entries = Object.entries(collected);

  if (entries.length === 0) {
    summaryEl.textContent = "Пока ничего не собрано";
  } else {
    const lines = entries.map(([platform, info]) => {
      const date = info.updatedAt ? new Date(info.updatedAt).toLocaleString("ru-RU") : "";
      return `• ${platform}: ${info.count} раздач${date ? " · " + date : ""}`;
    });
    lines.push(`Всего уникальных раздач: ${games.length}`);
    summaryEl.textContent = lines.join("\n");
  }

  exportButton.disabled = games.length === 0;
  clearButton.disabled = games.length === 0;
}

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", async () => {
    try {
      const tab = await getActiveTab();
      if (!tab?.id) throw new Error("Не удалось определить активную вкладку.");
      await chrome.tabs.update(tab.id, { url: CATEGORY_URLS[button.dataset.category] });
      window.close();
    } catch (error) {
      showStatus(error.message || String(error), "error");
    }
  });
});

collectButton.addEventListener("click", async () => {
  collectButton.disabled = true;
  showStatus("Читаю открытую страницу RuTracker…");

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://rutracker.org/forum/")) {
      throw new Error("Сначала открой RuTracker в этой вкладке.");
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "TICO_COLLECT_CURRENT_CATEGORY" });
    } catch (_error) {
      throw new Error("Расширение ещё не подключено к этой вкладке. Обнови страницу RuTracker (F5) и повтори.");
    }

    if (!response?.ok) throw new Error(response?.error || "Не удалось прочитать категорию.");

    const result = response.result;
    const current = await chrome.storage.local.get({ games: [], collected: {} });
    const previousGames = Array.isArray(current.games) ? current.games : [];

    // Replace this category's previous snapshot, preserving the other categories.
    const keepOtherCategories = previousGames.filter(game => game.platform !== result.platform);
    const merged = new Map();
    for (const game of [...keepOtherCategories, ...result.games]) {
      merged.set(String(game.rutracker_id), game);
    }

    const games = Array.from(merged.values());
    const collected = {
      ...(current.collected || {}),
      [result.platform]: {
        count: result.games.length,
        updatedAt: new Date().toISOString(),
        categoryId: result.category_id
      }
    };

    await chrome.storage.local.set({ games, collected });
    showStatus(`Добавлено ${result.count} раздач: ${result.platform}.`, "success");
    await refreshSummary();
  } catch (error) {
    showStatus(error.message || String(error), "error");
  } finally {
    collectButton.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("export.html") });
});

clearButton.addEventListener("click", async () => {
  const confirmed = confirm("Удалить все собранные раздачи?");
  if (!confirmed) return;
  await chrome.storage.local.set({ games: [], collected: {} });
  showStatus("Локальная база очищена.", "success");
  await refreshSummary();
});

refreshSummary().catch(error => showStatus(error.message || String(error), "error"));
