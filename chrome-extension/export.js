const countEl = document.getElementById("count");
const downloadButton = document.getElementById("download");
const statusEl = document.getElementById("status");
let exportJson = "";

async function prepareExport() {
  const all = await chrome.storage.local.get(null);
  const pages = Object.entries(all)
    .filter(([key, value]) => key.startsWith("fp:") && value && typeof value === "object")
    .map(([, value]) => value)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "listing" ? -1 : 1;
      return String(a.topic_id || a.page_start || "").localeCompare(
        String(b.topic_id || b.page_start || ""), "ru", { numeric: true }
      );
    });

  const topicMap = new Map();
  const linkMap = new Map();

  for (const page of pages) {
    for (const item of page.listing_topics || []) {
      const id = String(item.topic_id);
      const current = topicMap.get(id) || {
        topic_id: id,
        title: item.title || null,
        topic_url: item.topic_url || null,
        categories: [],
        size_bytes: item.size_bytes === undefined ? null : item.size_bytes,
        size_text: item.size_text || null,
        seed_text: item.seed_text || null,
        leech_text: item.leech_text || null,
        download_links: []
      };
      if (page.category_id && !current.categories.some(category => String(category.category_id) === String(page.category_id))) {
        current.categories.push({
          category_id: page.category_id,
          category_name: page.category_name || null
        });
      }
      topicMap.set(id, current);
    }
  }

  for (const page of pages) {
    if (page.kind !== "topic" || !page.topic_id) continue;
    const id = String(page.topic_id);
    const current = topicMap.get(id) || {
      topic_id: id,
      title: page.page_title || null,
      topic_url: page.page_url || null,
      categories: page.category_id ? [{
        category_id: page.category_id,
        category_name: page.category_name || null
      }] : [],
      size_bytes: null,
      size_text: null,
      seed_text: null,
      leech_text: null,
      download_links: []
    };

    current.title = page.page_title || current.title;
    current.topic_url = page.page_url || current.topic_url;
    current.download_links = page.download_links || [];
    current.page_fingerprint = {
      fingerprint_hash: page.fingerprint_hash || null,
      captured_at: page.captured_at || null,
      metadata_pairs: page.metadata_pairs || [],
      structure: page.structure || null,
      tables: page.tables || []
    };
    topicMap.set(id, current);

    for (const link of page.download_links || []) {
      if (!link.url) continue;
      const key = link.type + "|" + link.url;
      linkMap.set(key, {
        ...link,
        topic_id: id,
        topic_title: current.title,
        topic_url: current.topic_url
      });
    }
  }

  const topics = Array.from(topicMap.values()).sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "ru")
  );
  const links = Array.from(linkMap.values());
  const result = {
    schema: "tico-rutracker-catalog-capture/1",
    collector_version: "1.2.1",
    exported_at: new Date().toISOString(),
    summary: {
      fingerprint_pages: pages.length,
      listing_pages: pages.filter(page => page.kind === "listing").length,
      topic_pages: pages.filter(page => page.kind === "topic").length,
      unique_topics: topics.length,
      topics_with_download_links: topics.filter(topic => topic.download_links.length > 0).length,
      download_links: links.length,
      magnet_links: links.filter(link => link.type === "magnet").length,
      torrent_links: links.filter(link => link.type !== "magnet").length
    },
    topics: topics,
    download_links: links,
    page_fingerprints: pages
  };

  exportJson = JSON.stringify(result, null, 2);
  countEl.textContent =
    "Готово: " + topics.length + " тем, " + links.length + " ссылок, " + pages.length + " отпечатков.";
  downloadButton.disabled = pages.length === 0;
  if (!pages.length) statusEl.textContent = "Сначала открой страницы RuTracker с включённым автосбором.";
}

downloadButton.addEventListener("click", () => {
  try {
    const blob = new Blob([exportJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tico_rutracker_page_fingerprints.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    statusEl.textContent = "JSON отправлен в папку загрузок Chrome.";
    statusEl.className = "status success";
  } catch (error) {
    statusEl.textContent = error.message || String(error);
    statusEl.className = "status error";
  }
});

prepareExport().catch(error => {
  statusEl.textContent = error.message || String(error);
  statusEl.className = "status error";
});
