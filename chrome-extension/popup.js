const CATEGORY_URLS = {
  "908": "https://rutracker.org/forum/tracker.php?f=908&o=1&s=2&start=0",
  "357": "https://rutracker.org/forum/tracker.php?f=357&o=1&s=2&start=0",
  "1116": "https://rutracker.org/forum/tracker.php?f=1116&o=1&s=2&start=0",
  "773": "https://rutracker.org/forum/tracker.php?f=773&o=1&s=2&start=0",
  "774": "https://rutracker.org/forum/tracker.php?f=774&o=1&s=2&start=0",
  "968": "https://rutracker.org/forum/tracker.php?f=968&o=1&s=2&start=0",
  "129": "https://rutracker.org/forum/tracker.php?f=129&o=1&s=2&start=0"
};

const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const captureButton = document.getElementById("capture");
const exportButton = document.getElementById("export");
const clearButton = document.getElementById("clear");
const toggleButton = document.getElementById("toggleAuto");

function status(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status" + (type ? " " + type : "");
}

async function getPages() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key, value]) => key.startsWith("fp:") && value && typeof value === "object")
    .map(([, value]) => value);
}

function countLinks(pages) {
  const unique = new Map();
  for (const page of pages) {
    for (const link of page.download_links || []) {
      if (link.url) unique.set(link.type + "|" + link.url, link);
    }
  }
  return Array.from(unique.values());
}

async function refresh() {
  const [pages, settings, lastData] = await Promise.all([
    getPages(),
    chrome.storage.local.get({ tico_auto_capture: true }),
    chrome.storage.local.get({ tico_last_capture: null })
  ]);
  const topics = new Set(pages.filter(page => page.kind === "topic").map(page => String(page.topic_id)));
  const listingPages = pages.filter(page => page.kind === "listing");
  const listedTopics = new Set();
  for (const page of listingPages) {
    for (const item of page.listing_topics || []) listedTopics.add(String(item.topic_id));
  }
  const links = countLinks(pages);

  const lines = [
    "Всего отпечатков: " + pages.length,
    "Страниц категорий: " + listingPages.length,
    "Уникальных тем в списках: " + listedTopics.size,
    "Открытых страниц раздач: " + topics.size,
    "Уникальных ссылок скачивания: " + links.length,
    "Magnet: " + links.filter(link => link.type === "magnet").length,
    "Torrent / dl.php: " + links.filter(link => link.type !== "magnet").length
  ];

  const last = lastData.tico_last_capture;
  if (last?.ok) {
    lines.push("Последняя: " + (last.title || last.key));
    if (last.kind === "topic") lines.push("Ссылок на ней: " + (last.download_link_count || 0));
  } else if (last?.error) {
    lines.push("Последняя ошибка: " + last.error);
  }

  summaryEl.textContent = pages.length ? lines.join("\n") : "Пока отпечатков нет.";
  exportButton.disabled = pages.length === 0;
  clearButton.disabled = pages.length === 0;

  const enabled = Boolean(settings.tico_auto_capture);
  toggleButton.textContent = enabled ? "Автосбор: ВКЛ" : "Автосбор: ВЫКЛ";
  toggleButton.classList.toggle("secondary", !enabled);
  toggleButton.classList.toggle("primary", enabled);
}

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!tabs[0]?.id) throw new Error("Не удалось определить активную вкладку.");
      await chrome.tabs.update(tabs[0].id, { url: CATEGORY_URLS[button.dataset.category] });
      window.close();
    } catch (error) {
      status(error.message || String(error), "error");
    }
  });
});

toggleButton.addEventListener("click", async () => {
  const current = await chrome.storage.local.get({ tico_auto_capture: true });
  await chrome.storage.local.set({ tico_auto_capture: !current.tico_auto_capture });
  await refresh();
});

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  status("Снимаю отпечаток текущей страницы…");
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];
    if (!tab?.id || !tab.url?.startsWith("https://rutracker.org/forum/")) {
      throw new Error("Открой страницу RuTracker в этой вкладке.");
    }
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "TICO_CAPTURE_CURRENT_PAGE" });
    } catch (_) {
      throw new Error("Расширение ещё не подключено к вкладке. Обнови страницу RuTracker клавишей F5.");
    }
    if (!response?.ok) throw new Error(response?.error || "Не удалось снять отпечаток.");
    status(
      "Сохранено: " + (response.result.title || response.result.key) +
      ". Ссылок скачивания: " + response.result.download_link_count + ".",
      "success"
    );
    await refresh();
  } catch (error) {
    status(error.message || String(error), "error");
  } finally {
    captureButton.disabled = false;
  }
});

exportButton.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("export.html") });
});

clearButton.addEventListener("click", async () => {
  if (!confirm("Удалить все отпечатки страниц и найденные ссылки?")) return;
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter(key => key.startsWith("fp:"));
  if (keys.length) await chrome.storage.local.remove(keys);
  await chrome.storage.local.remove("tico_last_capture");
  status("Локальная база очищена.", "success");
  await refresh();
});

refresh().catch(error => status(error.message || String(error), "error"));
