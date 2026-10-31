const countEl = document.getElementById("count");
const downloadButton = document.getElementById("download");
const statusEl = document.getElementById("status");

let exportJson = "[]";

async function prepareExport() {
  const data = await chrome.storage.local.get({ games: [] });
  const games = Array.isArray(data.games) ? data.games : [];
  exportJson = JSON.stringify(games, null, 4);
  countEl.textContent = `Готово записей: ${games.length}`;
  downloadButton.disabled = games.length === 0;
  if (games.length === 0) statusEl.textContent = "Сначала собери хотя бы одну категорию.";
}

downloadButton.addEventListener("click", () => {
  try {
    const blob = new Blob([exportJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rutracker_retro_games_raw.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    statusEl.textContent = "Загрузка JSON началась. Проверь папку загрузок Chrome.";
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
