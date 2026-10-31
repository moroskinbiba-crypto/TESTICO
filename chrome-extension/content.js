(() => {
  "use strict";

  const VERSION = "1.2.0";
  const SCHEMA = "tico-rutracker-page-fingerprint/1";
  const CATEGORIES = {
    "908": "Игры для PS",
    "357": "Игры для PS2",
    "1116": "PS1 и PSP",
    "773": "Wii U / Wii / GameCube",
    "774": "3DS / DS",
    "968": "Dreamcast",
    "129": "Остальные консоли"
  };
  const PRIVATE_QUERY = /^(sid|session|sessionid|auth|authkey|passkey|token|csrf|securitytoken|key)$/i;
  const SELECTORS = [
    "a.topictitle", "a.maintitle", "h1", "#topic_title", ".topic-title",
    "tr.t-row", "td.tor-size", ".seed", ".leech", ".post_body",
    ".post_body_html", ".post_wrap", ".forumline", "dl", "table",
    "a[href*='dl.php']", "a[href^='magnet:']"
  ];

  const text = (node, limit = 500) => {
    if (!node) return "";
    const value = (node.innerText || node.textContent || "")
      .replace(/\u00a0/g, " ").replace(/[ \t\r\n]+/g, " ").trim();
    return value.slice(0, limit);
  };

  const classes = node => node?.classList ? Array.from(node.classList).slice(0, 12) : [];

  function cleanHttpUrl(value) {
    try {
      const url = new URL(value, location.href);
      for (const key of Array.from(url.searchParams.keys())) {
        if (PRIVATE_QUERY.test(key)) url.searchParams.delete(key);
      }
      url.hash = "";
      return url.toString();
    } catch (_) {
      return "";
    }
  }

  function cleanMagnet(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "magnet:") return "";
      for (const key of Array.from(url.searchParams.keys())) {
        if (PRIVATE_QUERY.test(key)) url.searchParams.delete(key);
      }
      return url.toString();
    } catch (_) {
      return "";
    }
  }

  function topicIdFromAnchor(anchor) {
    if (!anchor) return null;
    const dataId = anchor.getAttribute("data-topic_id") || anchor.getAttribute("data-topic-id");
    if (dataId && /^\d+$/.test(dataId)) return dataId;
    try {
      const id = new URL(anchor.getAttribute("href") || "", location.href).searchParams.get("t");
      if (id && /^\d+$/.test(id)) return id;
    } catch (_) {}
    const match = (anchor.getAttribute("href") || "").match(/[?&]t=(\d+)/);
    return match ? match[1] : null;
  }

  function pageType() {
    const path = location.pathname.toLowerCase();
    if (path.endsWith("/tracker.php")) {
      const id = new URL(location.href).searchParams.get("f");
      if (CATEGORIES[id]) return "listing";
    }
    if (path.endsWith("/viewtopic.php")) {
      const id = new URL(location.href).searchParams.get("t");
      if (id && /^\d+$/.test(id)) return "topic";
    }
    return null;
  }

  function categoryFromTopic() {
    for (const anchor of document.querySelectorAll('a[href*="tracker.php?f="]')) {
      try {
        const id = new URL(anchor.href, location.href).searchParams.get("f");
        if (CATEGORIES[id]) return id;
      } catch (_) {}
    }
    return null;
  }

  function isChallenge() {
    const body = (document.title + " " + (document.body?.innerText || "")).toLowerCase();
    return body.includes("just a moment") ||
      body.includes("checking your browser") ||
      body.includes("verify you are human") ||
      body.includes("проверка безопасности") ||
      location.pathname.includes("/cdn-cgi/challenge-platform/");
  }

  function parseMagnet(value) {
    const uri = cleanMagnet(value);
    let infoHash = null;
    let displayName = null;
    let trackers = 0;
    if (uri) {
      try {
        const params = new URL(uri).searchParams;
        const match = (params.get("xt") || "").match(/urn:btih:([a-z0-9]{32,40})/i);
        infoHash = match ? match[1].toUpperCase() : null;
        displayName = params.get("dn");
        trackers = params.getAll("tr").length;
      } catch (_) {}
    }
    return { url: uri || value, info_hash: infoHash, display_name: displayName, trackers_count: trackers };
  }

  function getDownloadLinks() {
    const result = [];
    const seen = new Set();
    for (const anchor of document.querySelectorAll("a[href]")) {
      const href = (anchor.getAttribute("href") || "").trim();
      if (!href) continue;

      let item = null;
      if (/^magnet:/i.test(href)) {
        const parsed = parseMagnet(href);
        item = {
          type: "magnet",
          url: parsed.url,
          label: text(anchor, 160) || anchor.getAttribute("title") || "Magnet",
          info_hash: parsed.info_hash,
          display_name: parsed.display_name,
          trackers_count: parsed.trackers_count
        };
      } else {
        let url;
        try { url = new URL(href, location.href); } catch (_) { continue; }
        const path = url.pathname.toLowerCase();
        const label = text(anchor, 160) || anchor.getAttribute("title") || "";
        const className = String(anchor.className || "").toLowerCase();
        const torrentFile = /\.torrent$/i.test(path);
        const downloadEndpoint = /(?:^|\/)(?:dl|download)\.php$/i.test(path);
        const downloadLabel = /скачать.{0,30}(торрент|torrent)|download.{0,30}torrent/i.test(label);
        const downloadClass = /(dl-link|download|torrent-link)/i.test(className);
        if (!torrentFile && !downloadEndpoint && !downloadLabel && !downloadClass) continue;
        item = {
          type: torrentFile ? "torrent_file" : "torrent_download",
          url: cleanHttpUrl(url.toString()),
          label: label || "Скачать торрент",
          info_hash: null,
          display_name: null,
          trackers_count: 0
        };
      }

      if (!item?.url) continue;
      const key = item.type + "|" + item.url;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result.slice(0, 120);
  }

  function getTopicsFromListing() {
    const result = [];
    for (const row of document.querySelectorAll("tr.t-row")) {
      const anchor = row.querySelector("a.topictitle");
      const id = topicIdFromAnchor(anchor);
      if (!anchor || !id) continue;
      const sizeCell = row.querySelector("td.tor-size");
      const rawSize = sizeCell?.getAttribute("data-ts_size") || "";
      result.push({
        topic_id: id,
        title: text(anchor),
        topic_url: "https://rutracker.org/forum/viewtopic.php?t=" + id,
        size_bytes: /^\d+$/.test(rawSize) ? Number(rawSize) : null,
        size_text: text(sizeCell, 80) || null,
        seed_text: text(row.querySelector(".seed, .seedmed, .seedlow, [class*='seed']"), 40) || null,
        leech_text: text(row.querySelector(".leech, .leechmed, .leechlow, [class*='leech']"), 40) || null,
        row_classes: classes(row)
      });
    }
    return result;
  }

  function getPagination(categoryId) {
    const output = [];
    const seen = new Set();
    for (const anchor of document.querySelectorAll("a[href*='tracker.php']")) {
      try {
        const url = new URL(anchor.href, location.href);
        if (url.origin !== location.origin || !url.pathname.endsWith("/tracker.php")) continue;
        if (url.searchParams.get("f") !== String(categoryId)) continue;
        const start = url.searchParams.get("start") || "0";
        if (seen.has(start)) continue;
        seen.add(start);
        output.push({
          start: /^\d+$/.test(start) ? Number(start) : start,
          label: text(anchor, 40),
          current: url.href === location.href
        });
      } catch (_) {}
    }
    return output.slice(0, 100);
  }

  function getMetadataPairs() {
    const output = [];
    const seen = new Set();
    const excluded = /(автор|пользоват|разместил|загрузил|никнейм|username|uploader|profile|профиль)/i;
    const add = (label, value, source) => {
      if (!label || !value || excluded.test(label)) return;
      const key = label + "|" + value;
      if (seen.has(key)) return;
      seen.add(key);
      output.push({ label, value, source });
    };

    for (const dl of Array.from(document.querySelectorAll("dl"))) {
      for (const dt of dl.querySelectorAll("dt")) {
        const dd = dt.nextElementSibling;
        if (dd?.tagName.toLowerCase() === "dd") add(text(dt, 80), text(dd, 220), "dl");
      }
    }
    for (const table of Array.from(document.querySelectorAll("table")).slice(0, 16)) {
      for (const row of Array.from(table.querySelectorAll("tr")).slice(0, 30)) {
        const cells = Array.from(row.querySelectorAll(":scope > th, :scope > td"));
        if (cells.length >= 2) add(text(cells[0], 80), text(cells[1], 220), "table");
      }
    }
    return output.slice(0, 60);
  }

  function getTableShapes() {
    return Array.from(document.querySelectorAll("table")).slice(0, 16).map((table, index) => {
      const rows = Array.from(table.querySelectorAll("tr"));
      return {
        index,
        id: table.id || null,
        classes: classes(table),
        row_count: rows.length,
        column_counts: rows.slice(0, 12).map(row => row.querySelectorAll(":scope > th, :scope > td").length),
        first_row_labels: rows[0]
          ? Array.from(rows[0].querySelectorAll(":scope > th, :scope > td")).slice(0, 10).map(cell => text(cell, 80))
          : []
      };
    });
  }

  function getStructure() {
    const tags = {};
    const classCounts = {};
    const ids = [];
    const nodes = document.body ? Array.from(document.body.querySelectorAll("*")).slice(0, 3200) : [];
    for (const node of nodes) {
      const tag = node.tagName.toLowerCase();
      tags[tag] = (tags[tag] || 0) + 1;
      for (const name of Array.from(node.classList || [])) classCounts[name] = (classCounts[name] || 0) + 1;
      if (node.id && ids.length < 80) ids.push(node.id);
    }
    return {
      body_child_count: document.body?.children.length || 0,
      scanned_nodes: nodes.length,
      tag_counts: tags,
      common_classes: Object.entries(classCounts).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([name, count]) => ({ name, count })),
      ids: Array.from(new Set(ids)),
      selector_counts: Object.fromEntries(SELECTORS.map(selector => {
        try { return [selector, document.querySelectorAll(selector).length]; }
        catch (_) { return [selector, -1]; }
      }))
    };
  }

  function makeHash(kind, structure, tables) {
    const stable = JSON.stringify({
      kind,
      selector_counts: structure.selector_counts,
      tag_counts: structure.tag_counts,
      common_classes: structure.common_classes,
      tables: tables.map(table => ({
        id: table.id, classes: table.classes, row_count: table.row_count,
        column_counts: table.column_counts, first_row_labels: table.first_row_labels
      }))
    });
    let hash = 2166136261;
    for (let i = 0; i < stable.length; i++) {
      hash ^= stable.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ("00000000" + (hash >>> 0).toString(16)).slice(-8);
  }

  function createRecord(kind, source) {
    const url = new URL(location.href);
    const topicId = kind === "topic" ? url.searchParams.get("t") : null;
    const categoryId = kind === "listing" ? url.searchParams.get("f") : categoryFromTopic();
    const start = url.searchParams.get("start") || "0";
    const headingNode = kind === "topic"
      ? document.querySelector("a.maintitle, .maintitle, #topic_title, .topic-title, h1, h2")
      : document.querySelector("h1, .maintitle, title");
    const heading = text(headingNode) || text(document.querySelector("title"));
    const topics = kind === "listing" ? getTopicsFromListing() : [];
    const downloads = kind === "topic" ? getDownloadLinks() : [];
    const structure = getStructure();
    const tables = getTableShapes();
    const metadata = kind === "topic" ? getMetadataPairs() : [];
    const key = kind === "topic" ? "topic:" + topicId : "listing:" + categoryId + ":" + start;

    return {
      schema: SCHEMA,
      collector_version: VERSION,
      key,
      kind,
      page_url: cleanHttpUrl(location.href),
      page_title: heading,
      heading_classes: classes(headingNode),
      topic_id: topicId,
      category_id: categoryId,
      category_name: categoryId ? (CATEGORIES[categoryId] || null) : null,
      page_start: /^\d+$/.test(start) ? Number(start) : start,
      captured_at: new Date().toISOString(),
      capture_source: source,
      fingerprint_hash: makeHash(kind, structure, tables),
      document: {
        title: text(document.querySelector("title")),
        language: document.documentElement.lang || null,
        charset: document.characterSet || null,
        body_text_length: text(document.body, 1000000).length,
        body_element_count: document.body?.querySelectorAll("*").length || 0
      },
      structure,
      tables,
      metadata_pairs: metadata,
      listing_topics: topics,
      download_links: downloads,
      download_link_count: downloads.length,
      pagination: kind === "listing" ? getPagination(categoryId) : []
    };
  }

  async function saveRecord(record) {
    const key = "fp:" + encodeURIComponent(record.key);
    const previousData = await chrome.storage.local.get(key);
    const previous = previousData[key];
    const now = new Date().toISOString();
    record.first_seen = previous?.first_seen || now;
    record.last_seen = now;
    record.visit_count = (Number(previous?.visit_count) || 0) + 1;

    await chrome.storage.local.set({
      [key]: record,
      tico_last_capture: {
        ok: true,
        key: record.key,
        kind: record.kind,
        title: record.page_title,
        page_url: record.page_url,
        captured_at: now,
        visit_count: record.visit_count,
        listing_count: record.listing_topics.length,
        download_link_count: record.download_links.length
      }
    });
    return record;
  }

  async function settlePage() {
    if (!document.body || typeof MutationObserver === "undefined") {
      await new Promise(resolve => setTimeout(resolve, 900));
      return;
    }
    await new Promise(resolve => {
      let timer;
      let done = false;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(finish, 650);
      });
      function finish() {
        if (done) return;
        done = true;
        observer.disconnect();
        clearTimeout(timer);
        clearTimeout(hardLimit);
        resolve();
      }
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      timer = setTimeout(finish, 1000);
      const hardLimit = setTimeout(finish, 4500);
    });
  }

  async function capture(source) {
    if (isChallenge()) throw new Error("RuTracker показывает проверку безопасности. Сначала заверши её в обычном окне.");
    const kind = pageType();
    if (!kind) throw new Error("Открой страницу категории tracker.php или тему раздачи viewtopic.php.");
    const record = createRecord(kind, source || "manual");
    if (kind === "listing" && !record.listing_topics.length) {
      throw new Error("Не найдены строки раздач tr.t-row. Возможно, структура страницы изменилась.");
    }
    if (kind === "topic" && !record.topic_id) throw new Error("Не найден ID темы раздачи.");
    const saved = await saveRecord(record);
    return {
      key: saved.key,
      kind: saved.kind,
      title: saved.page_title,
      topic_id: saved.topic_id,
      category_name: saved.category_name,
      listing_count: saved.listing_topics.length,
      download_link_count: saved.download_links.length,
      visit_count: saved.visit_count,
      fingerprint_hash: saved.fingerprint_hash
    };
  }

  async function autoCapture() {
    if (!pageType()) return;
    const config = await chrome.storage.local.get({ tico_auto_capture: true });
    if (!config.tico_auto_capture) return;
    await settlePage();
    try {
      await capture("automatic");
    } catch (error) {
      await chrome.storage.local.set({
        tico_last_capture: {
          ok: false,
          page_url: cleanHttpUrl(location.href),
          captured_at: new Date().toISOString(),
          error: error?.message || String(error)
        }
      });
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "TICO_CAPTURE_CURRENT_PAGE") return false;
    capture("manual")
      .then(result => sendResponse({ ok: true, result }))
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  });

  setTimeout(() => autoCapture().catch(() => {}), 250);
})();