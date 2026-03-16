const state = { all: [], filtered: [] };

let tableSortKey = localStorage.getItem("postcardsSortKey") || "id";
let tableSortDir = Number(localStorage.getItem("postcardsSortDir") || "1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = 1;

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

function norm(s){
  return String(s ?? "").toLowerCase().trim();
}

function money(v){
  if(v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v);
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function buildOptions(items, selectId, keyFn, labelFn){
  const sel = document.getElementById(selectId);
  const map = new Map();

  for(const it of items){
    const key = keyFn(it);
    if(!key) continue;
    if(!map.has(key)) map.set(key, labelFn(it));
  }

  const pairs = Array.from(map.entries())
    .sort((a,b) => String(a[1]).localeCompare(String(b[1]), "de", { sensitivity:"base" }));

  for(const [k, label] of pairs){
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = label;
    sel.appendChild(opt);
  }
}

function refillSelect(selectId, firstLabel, pairs, currentValue){
  const sel = document.getElementById(selectId);
  if(!sel) return;

  sel.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  sel.appendChild(first);

  for(const [value, label] of pairs){
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  }

  const allowed = new Set(pairs.map(([v]) => v));
  sel.value = (currentValue && allowed.has(currentValue)) ? currentValue : "";
}

function matchesQuery(it, q){
  if(!q) return true;

  const hay = [
    it.id,
    it.model_id,
    it.label,
    it.airline,
    it.aircraft_manufacturer,
    it.aircraft_type,
    it.aircraft_type_exact,
    it.registration,
    it.publisher,
    it.publisher_norm,
    it.condition,
    it.size,
    it.year
  ].map(norm).join(" | ");

  return hay.includes(q);
}

function passesFilters(it, filters, excludeKey = ""){
  if(excludeKey !== "q" && !matchesQuery(it, filters.q)) return false;
  if(excludeKey !== "model" && filters.model && (it.model_id || "") !== filters.model) return false;
  if(excludeKey !== "airline" && filters.airline && (it.airline || "") !== filters.airline) return false;
  if(excludeKey !== "type" && filters.type && (it.aircraft_type || "") !== filters.type) return false;
  if(excludeKey !== "publisher" && filters.publisher && (it.publisher_norm || it.publisher || "") !== filters.publisher) return false;
  return true;
}

function buildFacetOptions(filters){
  {
    const items = state.all.filter(it => passesFilters(it, filters, "model"));
    const map = new Map();
    for(const it of items){
      const key = it.model_id || "";
      if(key && !map.has(key)) map.set(key, key);
    }
    refillSelect(
      "model",
      "Alle Modelle",
      Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0], "de")),
      filters.model
    );
  }

  {
    const items = state.all.filter(it => passesFilters(it, filters, "airline"));
    const map = new Map();
    for(const it of items){
      const key = it.airline || "";
      if(key && !map.has(key)) map.set(key, key);
    }
    refillSelect(
      "airline",
      "Alle Airlines",
      Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0], "de")),
      filters.airline
    );
  }

  {
    const items = state.all.filter(it => passesFilters(it, filters, "type"));
    const map = new Map();
    for(const it of items){
      const key = it.aircraft_type || "";
      if(key && !map.has(key)) map.set(key, key);
    }
    refillSelect(
      "type",
      "Alle Flugzeugtypen",
      Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0], "de")),
      filters.type
    );
  }

  {
    const items = state.all.filter(it => passesFilters(it, filters, "publisher"));
    const map = new Map();
    for(const it of items){
      const key = it.publisher_norm || it.publisher || "";
      if(key && !map.has(key)) map.set(key, key);
    }
    refillSelect(
      "publisher",
      "Alle Herausgeber",
      Array.from(map.entries()).sort((a,b) => a[0].localeCompare(b[0], "de")),
      filters.publisher
    );
  }
}

function updateActiveFilterUI(filters){
  const map = [
    ["q", "Suche"],
    ["model", "Modell"],
    ["airline", "Airline"],
    ["type", "Flugzeugtyp"],
    ["publisher", "Herausgeber"]
  ];

  const active = [];

  map.forEach(([key, label]) => {
    const el = document.getElementById(key);
    const on = !!filters[key];
    if(el) el.classList.toggle("is-active", on);
    if(on) active.push(label);
  });

  const box = document.getElementById("activeFilters");
  if(box){
    box.textContent = active.length
      ? `Aktive Filter: ${active.join(", ")}`
      : "Keine Filter aktiv";
  }
}

function sortByColumn(items){
  if(!tableSortKey) return items.slice();

  const arr = items.slice();

  arr.sort((a,b) => {
    let va = a[tableSortKey];
    let vb = b[tableSortKey];

    if(tableSortKey === "price" || tableSortKey === "year"){
      va = Number(va);
      vb = Number(vb);
      if(!Number.isFinite(va)) va = -1;
      if(!Number.isFinite(vb)) vb = -1;
    }

    if(va == null) va = "";
    if(vb == null) vb = "";

    if(typeof va === "string") va = va.toLowerCase();
    if(typeof vb === "string") vb = vb.toLowerCase();

    if(va < vb) return -1 * tableSortDir;
    if(va > vb) return  1 * tableSortDir;

    return (a.id || "").localeCompare(b.id || "", "de");
  });

  return arr;
}

function render(items){
  document.getElementById("count").textContent =
    items.length === 1 ? "1 Postkarte" : `${items.length} Postkarten`;

  if(!items.length){
    document.getElementById("content").innerHTML = `<div class="err">Keine Treffer.</div>`;
    return;
  }

  const mark = (key) => {
    if(tableSortKey !== key) return `<span class="sortMark">↕</span>`;
    return `<span class="sortMark active">${tableSortDir === 1 ? "↑" : "↓"}</span>`;
  };

  const thClass = (key, base = "") =>
    (tableSortKey === key ? `${base} thSort active` : `${base} thSort`).trim();

  let html = `
    <table>
      <thead>
        <tr>
          <th class="pcThumbCell"></th>
          <th class="${thClass("id")}" data-sort="id">Postkarten-ID ${mark("id")}</th>
          <th class="${thClass("model_id")}" data-sort="model_id">Modell-ID ${mark("model_id")}</th>
          <th class="${thClass("airline")}" data-sort="airline">Airline ${mark("airline")}</th>
          <th class="${thClass("aircraft_type")}" data-sort="aircraft_type">Flugzeugtyp ${mark("aircraft_type")}</th>
          <th class="${thClass("registration","hide-m")}" data-sort="registration">Registrierung ${mark("registration")}</th>
          <th class="${thClass("publisher_norm","hide-m")}" data-sort="publisher_norm">Herausgeber ${mark("publisher_norm")}</th>
          <th class="${thClass("year","hide-m")}" data-sort="year">Jahr ${mark("year")}</th>
          <th class="${thClass("price")}" data-sort="price">Preis ${mark("price")}</th>
        </tr>
      </thead>
      <tbody>
  `;

  for(const it of items){
    const href = `./postcard.html?id=${encodeURIComponent(it.id || "")}`;
    const thumb = it.thumb_url
      ? `<a class="pcThumbLink" href="${href}" title="Postkarte anzeigen">
           <img class="pcThumbImg" src="${esc(it.thumb_url)}" alt="Thumbnail" loading="lazy">
         </a>`
      : "";

    html += `
      <tr class="postcardRow" data-id="${esc(it.id || "")}">
        <td class="pcThumbCell">${thumb}</td>
        <td class="mono">
          <a href="${href}" title="Postkarte anzeigen">${esc(it.id || "")}</a>
        </td>
        <td class="mono">
          ${
            it.model_id
              ? `<a href="./model.html?id=${encodeURIComponent(it.model_id)}">${esc(it.model_id)}</a>`
              : ""
          }
        </td>
        <td>${esc(it.airline || "")}</td>
        <td>${esc(it.aircraft_type || "")}</td>
        <td class="mono hide-m">${esc(it.registration || "")}</td>
        <td class="hide-m">${esc(it.publisher_norm || it.publisher || "")}</td>
        <td class="mono hide-m">${esc(it.year || "")}</td>
        <td class="mono priceCell">${esc(money(it.price))}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  document.getElementById("content").innerHTML = html;

  document.querySelectorAll("#content .postcardRow").forEach(tr => {
    tr.addEventListener("click", (e) => {
      if(e.target.closest("a")) return;
      const id = tr.getAttribute("data-id");
      if(id) location.href = `./postcard.html?id=${encodeURIComponent(id)}`;
    });
  });

  document.querySelectorAll("#content th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if(tableSortKey === key){
        tableSortDir *= -1;
      }else{
        tableSortKey = key;
        tableSortDir = 1;
      }

      localStorage.setItem("postcardsSortKey", tableSortKey);
      localStorage.setItem("postcardsSortDir", String(tableSortDir));
      apply();
    });
  });
}

function apply(){
  const filters = {
    q: norm(document.getElementById("q").value),
    model: document.getElementById("model").value,
    airline: document.getElementById("airline").value,
    type: document.getElementById("type").value,
    publisher: document.getElementById("publisher").value
  };

  buildFacetOptions(filters);
  updateActiveFilterUI(filters);

  let items = state.all.filter(it => {
    if(!matchesQuery(it, filters.q)) return false;
    if(filters.model && (it.model_id || "") !== filters.model) return false;
    if(filters.airline && (it.airline || "") !== filters.airline) return false;
    if(filters.type && (it.aircraft_type || "") !== filters.type) return false;
    if(filters.publisher && (it.publisher_norm || it.publisher || "") !== filters.publisher) return false;
    return true;
  });

  items = sortByColumn(items);
  state.filtered = items;
  render(items);
}

async function main(){
  try{
    const [idxRes, enrRes] = await Promise.all([
      fetch("./data/postcards_index.json", { cache:"no-store" }),
      fetch("./data/postcards_enriched.json", { cache:"no-store" })
    ]);

    if(!idxRes.ok) throw new Error(`postcards_index.json HTTP ${idxRes.status}`);
    if(!enrRes.ok) throw new Error(`postcards_enriched.json HTTP ${enrRes.status}`);

    const idx = await idxRes.json();
    const enr = await enrRes.json();

    const enrichedById = (enr && typeof enr === "object") ? enr : {};
    const items = Array.isArray(idx?.items) ? idx.items : [];

    state.all = items.map(it => {
      const e = enrichedById[it.id] || {};
      return {
        ...it,
        ...e,
        id: it.id || e.postcard_id || "",
        postcard_id: it.id || e.postcard_id || ""
      };
    });

    document.getElementById("meta").innerHTML =
      `<span class="mono">${esc(formatStandDE(idx.generated_at || ""))}</span>` +
      ` · Anzahl: <span class="mono">${esc(idx.count_unique || state.all.length)}</span>`;

    document.getElementById("q").addEventListener("input", apply);
    document.getElementById("model").addEventListener("change", apply);
    document.getElementById("airline").addEventListener("change", apply);
    document.getElementById("type").addEventListener("change", apply);
    document.getElementById("publisher").addEventListener("change", apply);

    document.getElementById("reset").addEventListener("click", () => {
      document.getElementById("q").value = "";
      document.getElementById("model").value = "";
      document.getElementById("airline").value = "";
      document.getElementById("type").value = "";
      document.getElementById("publisher").value = "";

      tableSortKey = "id";
      tableSortDir = 1;
      localStorage.removeItem("postcardsSortKey");
      localStorage.removeItem("postcardsSortDir");

      apply();
      history.replaceState(null, "", location.pathname);
    });

    const p = new URLSearchParams(location.search);
    if(p.has("q")) document.getElementById("q").value = p.get("q") || "";

    apply();
  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte Postkarten-Daten nicht laden. (${esc(e.message)})</div>`;
    document.getElementById("meta").textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", main);
