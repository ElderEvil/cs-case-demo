let selectedCase,
  nonce = 0,
  cases = [],
  activeFilter = "all";
const accents = ["#65d7ff", "#a27cff", "#ff7196", "#ffb84d", "#eb61ff"];
const ticker = document.querySelector(".drops-track");
if (ticker) {
  const viewport = document.createElement("div");
  viewport.className = "drops-viewport";
  ticker.parentNode?.insertBefore(viewport, ticker);
  viewport.append(ticker);
  ticker.insertAdjacentHTML("beforeend", ticker.innerHTML);
  ticker.setAttribute("aria-hidden", "true");
}
const getJson = async (url, options) => {
  const r = await fetch(url, options),
    b = await r.json();
  if (!r.ok) throw new Error(b.detail || `Request failed (${r.status})`);
  return b;
};
const rarity = (i) =>
  i.name.includes("★")
    ? "EXTRAORDINARY"
    : i.price_uah > 800
      ? "COVERT"
      : i.price_uah > 150
        ? "CLASSIFIED"
        : "MIL-SPEC";
const itemAccent = (i) =>
  i.name.includes("★")
    ? "#ffb84d"
    : i.price_uah > 800
      ? "#ff7196"
      : i.price_uah > 150
        ? "#a27cff"
        : "#65d7ff";
function renderCases() {
  const grid = document.getElementById("casesGrid");
  grid.innerHTML = "";
  const visibleCases = cases.filter((caseItem) => {
    if (activeFilter === "popular") {
      return ["recruit", "vanguard", "anime"].includes(caseItem.id);
    }
    if (activeFilter === "premium") {
      return ["zeus", "knife"].includes(caseItem.id);
    }
    return true;
  });
  visibleCases.forEach((c) => {
    const n = cases.indexOf(c);
    const e = document.createElement("article");
    e.className = "case-card";
    e.style.setProperty("--case", accents[n]);
    e.innerHTML = `<span class="case-rarity">${n === 4 ? "LEGENDARY SERIES" : `OBSIDIAN SERIES 0${n + 1}`}</span><div class="case-visual"><div class="case-box"></div></div><h3>${c.name}</h3><div class="case-footer"><strong>${c.price_uah.toLocaleString("uk-UA")} ₴</strong><button aria-label="Open ${c.name}">→</button></div>`;
    e.onclick = () => openCase(c);
    grid.append(e);
  });
}
function populateReel(c, result) {
  const reel = document.getElementById("reel");
  reel.innerHTML = "";
  Array.from({ length: 14 }, (_, n) =>
    n === 9 ? result.item : c.items[n % c.items.length],
  ).forEach((i) => {
    const e = document.createElement("div");
    e.className = "reel-item";
    e.style.setProperty("--item", itemAccent(i));
    e.innerHTML = `<span>${rarity(i)}</span><b>${i.name}</b>`;
    reel.append(e);
  });
}
async function openCase(c) {
  selectedCase = c;
  const d = document.getElementById("openDialog"),
    status = document.getElementById("openingStatus");
  document.getElementById("openingCase").textContent =
    `OPENING · ${c.name.toUpperCase()}`;
  document.getElementById("wonCard").hidden = true;
  document.getElementById("openAgain").hidden = true;
  status.className = "opening-status";
  status.textContent = "Synchronizing drop sequence…";
  d.showModal();
  try {
    const res = await getJson("/api/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        case_id: c.id,
        client_seed: document.getElementById("seed").value || "demo",
        nonce,
      }),
    });
    nonce++;
    document.getElementById("vNonce").value = res.nonce;
    populateReel(c, res);
    const reel = document.getElementById("reel");
    reel.classList.remove("spinning");
    void reel.offsetWidth;
    reel.classList.add("spinning");
    setTimeout(() => reveal(res), 2500);
  } catch (e) {
    status.textContent = e.message;
    status.classList.add("error");
  }
}
function reveal(res) {
  document.getElementById("openingStatus").textContent =
    `ROLL ${res.roll.toFixed(6)} · NONCE ${res.nonce}`;
  document.getElementById("wonName").textContent = res.item.name;
  document.getElementById("wonPrice").textContent =
    `${res.item.price_uah.toLocaleString("uk-UA")} ₴`;
  document.getElementById("wonMeta").textContent = rarity(res.item);
  document.getElementById("wonCard").hidden = false;
  document.getElementById("openAgain").hidden = false;
  addToInventory(res.item);
}
function addToInventory(item) {
  const stack = document.getElementById("inventoryStack");
  stack.querySelector(".empty-inventory")?.remove();
  const old = stack.querySelectorAll(".inventory-item");
  if (old.length > 2) old[0].remove();
  const e = document.createElement("div");
  e.className = "inventory-item";
  e.style.setProperty("--item", itemAccent(item));
  e.style.setProperty("--tilt", `${(Math.random() * 10 - 5).toFixed(1)}deg`);
  e.style.setProperty("--x", `${Math.round(Math.random() * 50 - 25)}px`);
  e.style.setProperty("--y", `${Math.round(Math.random() * 18 - 9)}px`);
  e.innerHTML = `<p>${rarity(item)} · JUST NOW</p><h4>${item.name}</h4>`;
  stack.append(e);
}
document.getElementById("closeOpen").onclick = () =>
  document.getElementById("openDialog").close();
document.getElementById("openAgain").onclick = () =>
  selectedCase && openCase(selectedCase);
document.getElementById("fairBtn").onclick = () =>
  document.getElementById("fairDialog").showModal();
document.getElementById("verifyBtn").onclick = () =>
  document.getElementById("fairDialog").showModal();
document.getElementById("closeFair").onclick = () =>
  document.getElementById("fairDialog").close();
document.getElementById("showCases").onclick = () =>
  document.getElementById("cases").scrollIntoView({ behavior: "smooth" });
document.querySelectorAll(".filter").forEach((filterButton) => {
  filterButton.addEventListener("click", () => {
    activeFilter = filterButton.textContent.trim().split(" ")[0].toLowerCase();
    document
      .querySelectorAll(".filter")
      .forEach((button) =>
        button.classList.toggle("selected", button === filterButton),
      );
    renderCases();
  });
});
document.getElementById("verifyRoll").onclick = async () => {
  const out = document.getElementById("verifyOut");
  try {
    const r = await getJson("/api/fair/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        server_seed: document.getElementById("vSeed").value,
        client_seed: document.getElementById("seed").value || "demo",
        nonce: Number(document.getElementById("vNonce").value),
        commitment: document.getElementById("commitment").textContent,
      }),
    });
    out.className = "verify-out";
    out.textContent = `Commitment ${r.commitment_valid ? "valid ✓" : "does not match"} · roll ${Number(r.roll).toFixed(6)}`;
  } catch (e) {
    out.className = "verify-out error";
    out.textContent = e.message;
  }
};
async function load() {
  try {
    const [c, f] = await Promise.all([
      getJson("/api/cases"),
      getJson("/api/fair/commitment"),
    ]);
    cases = c;
    document.getElementById("commitment").textContent = f.server_hash;
    renderCases();
  } catch (e) {
    document.getElementById("casesGrid").textContent = e.message;
  }
}
load();
