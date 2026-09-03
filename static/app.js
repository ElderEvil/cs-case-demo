let selected = null;
let nonce = 0;

async function getJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return body;
}

function showError(id, error) {
  const output = document.getElementById(id);
  output.className = "result error";
  output.textContent = error.message || "Something went wrong";
}

async function load() {
  try {
    const [cases, fair] = await Promise.all([
      getJson("/api/cases"),
      getJson("/api/fair/commitment"),
    ]);
    document.getElementById("commitment").textContent = fair.server_hash;
    const grid = document.getElementById("cases");
    grid.innerHTML = "";
    for (const c of cases) {
      const el = document.createElement("article");
      el.className = "card";
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      el.setAttribute("aria-pressed", "false");

      const title = document.createElement("h3");
      title.textContent = c.name;
      const price = document.createElement("div");
      price.textContent = `${c.price_uah} ₴`;
      const odds = document.createElement("ul");
      const totalWeight = c.items.reduce((sum, item) => sum + item.weight, 0);
      for (const item of c.items) {
        const line = document.createElement("li");
        const percentage = (item.weight / totalWeight * 100).toFixed(1);
        line.textContent = `${item.name} — ${percentage}% · ${item.price_uah} ₴`;
        odds.appendChild(line);
      }
      el.append(title, price, odds);

      const pick = () => {
        selected = c.id;
        document.querySelectorAll(".card").forEach((n) => {
          n.classList.remove("selected");
          n.setAttribute("aria-pressed", "false");
        });
        el.classList.add("selected");
        el.setAttribute("aria-pressed", "true");
        const btn = document.getElementById("openBtn");
        btn.disabled = false;
        btn.textContent = `Open ${c.name} — ${c.price_uah} ₴ (fake)`;
      };
      el.onclick = pick;
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick();
        }
      };
      grid.appendChild(el);
    }
  } catch (error) {
    showError("cases", error);
  }
}

document.getElementById("openBtn").onclick = async () => {
  try {
    const seed = document.getElementById("seed").value || "demo";
    const res = await getJson("/api/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: selected, client_seed: seed, nonce }),
    });
    nonce += 1;
    document.getElementById("vNonce").value = res.nonce;
    const result = document.getElementById("result");
    result.className = "result";
    result.textContent =
      `Won: ${res.item.name} (${res.item.price_uah} ₴) · roll ${res.roll.toFixed(6)} · nonce ${res.nonce}`;
  } catch (error) {
    showError("result", error);
  }
};

document.getElementById("verifyBtn").onclick = async () => {
  try {
    const seed = document.getElementById("seed").value || "demo";
    const out = await getJson("/api/fair/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        server_seed: document.getElementById("vSeed").value,
        client_seed: seed,
        nonce: Number(document.getElementById("vNonce").value),
        commitment: document.getElementById("commitment").textContent,
      }),
    });
    const output = document.getElementById("verifyOut");
    output.className = "result";
    output.textContent =
      `commitment_valid=${out.commitment_valid} · roll=${Number(out.roll).toFixed(6)}`;
  } catch (error) {
    showError("verifyOut", error);
  }
};

load();
