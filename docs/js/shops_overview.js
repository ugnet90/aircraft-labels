const SHOP_MISSING_KEY = "__missing_shop__";
const SHOP_MISSING_LABEL = "— Shop fehlt —";

const state = {
  all: [],
  filtered: []
};

let tableSortKey = localStorage.getItem("shopsSortKey") || "total_sum";
let tableSortDir = Number(localStorage.getItem("shopsSortDir") || "-1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = -1;

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

function norm(s){
  return String(s ?? "").toLowerCase().trim();
}

function formatStandDE(iso){
  if(!iso) return "";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return iso;

  return d.toLocaleString("de-DE", {
    day:"2-digit",
    month:"2-digit",
    year:"numeric",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function getShopName(it){
  return String(it.shop || it.Shop || "").trim();
}

function getShopUrl(it){
  return String(it.shop_url || it.Shop_url || it.Shop_URL || "").trim();
}

function getGroupName(it){
  return String(it.airline || it.group || it.airline_group || "").trim();
}

function getAircraftType(it){
  return String(it.aircraft_type || it.typ_anzeige || "").trim();
}

function parseMoneyValue(v){
  if(v === null || v === undefined || v === "") return 0;

  let s = String(v).trim();
  s = s.replace(/[€\s]/g, "");

  // deutsches Format: 1.234,56 -> 1234.56
  if(s.includes(",")){
    s = s.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyDE(n){
  if(!Number.isFinite(n) || n === 0) return "";

  return `€\u00A0${n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function avg(sum, count){
  const c = Number(count || 0);
  if(!c) return 0;
  const s = Number(sum || 0);
  return Number.isFinite(s) ? s / c : 0;
}

function statusAllowedSet(value){
  if(value === "all"){
    // Für Shop-Statistik bedeutet "alle": vorhanden + bestellt.
    // Wunschmodelle werden bewusst nicht einbezogen.
    return new Set(["owned", "ordered"]);
  }

  return new Set(
    String(value || "owned")
      .split(",")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

function matchesStatus(it, filters){
  const s = String(it.status || "").trim().toLowerCase();
  return filters.statuses.has(s);
}

function hasShopValue(it){
  return !!String(it.shop || it.Shop || "").trim();
}

function matchesShopKnown(it, filters){
  if(!filters.shopKnown) return true;

  const hasShop = hasShopValue(it);

  if(filters.shopKnown === "known") return hasShop;
  if(filters.shopKnown === "missing") return !hasShop;

  return true;
}

function matchesGroup(it, filters){
  if(!filters.group) return true;
  return getGroupName(it) === filters.group;
}

function matchesQueryRow(row, q){
  if(!q) return true;

  const hay = [
    row.shop,
    row.group_list,
    row.models,
    row.price_sum,
    row.shipping_sum,
    row.total_sum
  ].map(norm).join(" | ");

  return hay.includes(q);
}

function looksLikeDomainOrUrl(s){
  const v = String(s || "").trim();
  return /^https?:\/\//i.test(v) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v);
}

function normalizeShopKey(raw){
  let s = String(raw || "").trim();
  if(!s) return "";

  // URL / Domain normalisieren
  if(looksLikeDomainOrUrl(s)){
    let urlText = s;

    if(!/^https?:\/\//i.test(urlText)){
      urlText = "https://" + urlText;
    }

    try{
      const u = new URL(urlText);
      let host = u.hostname.toLowerCase();

      if(host.startsWith("www.")){
        host = host.slice(4);
      }

      return host.replace(/\/+$/, "");
    }catch(e){
      return s
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, "")
        .trim();
    }
  }

  // Freier Shopname: nur vereinheitlichen, nicht URL-kodieren
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function shopDisplayName(raw){
  const original = String(raw || "").trim();
  const key = normalizeShopKey(original);

  if(!key) return "— Shop fehlt —";

  const labels = {
    "flight-shop.de": "Flight-Shop.de"
  };

  if(labels[key]) return labels[key];

  // Bei Domain: normalisierte Domain anzeigen
  if(looksLikeDomainOrUrl(original)){
    return key;
  }

  // Bei freiem Text: Original-Schreibweise erhalten
  return original.replace(/\s+/g, " ").trim();
}

function buildShopRows(items, filters){
  const map = new Map();

  items
    .filter(it => matchesStatus(it, filters))
    .filter(it => matchesGroup(it, filters))
    .filter(it => matchesShopKnown(it, filters))
    .forEach(it => {
      const rawShop = getShopName(it);
      const hasShop = hasShopValue(it);
      
      const shopKey = hasShop ? normalizeShopKey(rawShop) : SHOP_MISSING_KEY;
      const shop = hasShop ? shopDisplayName(rawShop) : SHOP_MISSING_LABEL;
      const shopUrl = hasShop ? getShopUrl(it) : "";
      const key = shopKey;
      
      if(!map.has(key)){
        map.set(key, {
          shop,
          shop_key: key,
          shop_url: "",
          shopUrlsSet: new Set(),
          models: 0,
          price_sum: 0,
          shipping_sum: 0,
          total_sum: 0,
          groupsSet: new Set(),
          typesSet: new Set()
        });
      }

      const row = map.get(key);

      row.models += 1;

      const price = parseMoneyValue(it.price);
      const shipping = parseMoneyValue(it.shipping_allocated);

      row.price_sum += price;
      row.shipping_sum += shipping;
      row.total_sum += price + shipping;

      const group = getGroupName(it);
      if(group) row.groupsSet.add(group);

      const type = getAircraftType(it);
      if(type) row.typesSet.add(type);

      if(shopUrl){
        row.shopUrlsSet.add(shopUrl);
      }
    });

  return Array.from(map.values()).map(row => {
    const urls = Array.from(row.shopUrlsSet);
  
    return {
      shop: row.shop,
      shop_key: row.shop_key,
      shop_url: urls.length === 1 ? urls[0] : "",
      shop_url_count: urls.length,
      models: row.models,
      price_sum: row.price_sum,
      price_avg: avg(row.price_sum, row.models),
      shipping_sum: row.shipping_sum,
      shipping_avg: avg(row.shipping_sum, row.models),
      total_sum: row.total_sum,
      total_avg: avg(row.total_sum, row.models),
      groups: row.groupsSet.size,
      types: row.typesSet.size,
      group_list: Array.from(row.groupsSet).sort((a,b)=>a.localeCompare(b, "de")).join(", ")
    };
  });
}

function refillGroupOptions(items, currentValue){
  const sel = document.getElementById("group");
  if(!sel) return;

  const groups = Array.from(
    new Set(items.map(getGroupName).filter(Boolean))
  ).sort((a,b) => a.localeCompare(b, "de"));

  sel.innerHTML = `<option value="">Alle Airline-Gruppen</option>`;

  groups.forEach(group => {
    const opt = document.createElement("option");
    opt.value = group;
    opt.textContent = group;
    sel.appendChild(opt);
  });

  if(currentValue && groups.includes(currentValue)){
    sel.value = currentValue;
  }else{
    sel.value = "";
  }
}

function updateActiveFilterUI(filters){
  const active = [];

  const qEl = document.getElementById("q");
  const groupEl = document.getElementById("group");
  const statusEl = document.getElementById("status");
  const shopKnownEl = document.getElementById("shopKnown");

  qEl?.classList.toggle("is-active", !!filters.q);
  groupEl?.classList.toggle("is-active", !!filters.group);
  statusEl?.classList.toggle("is-active", filters.statusValue !== "owned");
  shopKnownEl?.classList.toggle("is-active", !!filters.shopKnown);

  if(filters.q) active.push("Suche");
  if(filters.group) active.push("Airline-Gruppe");
  if(filters.statusValue !== "owned") active.push("Status");
  if(filters.shopKnown) active.push("Shop");

  const box = document.getElementById("activeFilters");
  if(box){
    box.textContent = active.length
      ? `Aktive Filter: ${active.join(", ")}`
      : "Keine Filter aktiv";
  }
}

function sortRows(rows){
  const arr = rows.slice();

  arr.sort((a,b) => {
    let va = a[tableSortKey];
    let vb = b[tableSortKey];

    if([
      "models",
      "price_sum",
      "price_avg",
      "shipping_sum",
      "shipping_avg",
      "total_sum",
      "total_avg",
      "groups",
      "types"
    ].includes(tableSortKey)){
      va = Number(va || 0);
      vb = Number(vb || 0);
    }else{
      va = String(va || "").toLowerCase();
      vb = String(vb || "").toLowerCase();
    }

    if(va < vb) return -1 * tableSortDir;
    if(va > vb) return  1 * tableSortDir;

    return String(a.shop || "").localeCompare(String(b.shop || ""), "de");
  });

  return arr;
}

function sumRows(rows, key){
  return rows.reduce((sum, row) => {
    const n = Number(row[key] || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function columnTooltip(key){
  const tips = {
    shop: "Shop bzw. Bezugsquelle. Falls eine Shop-URL vorhanden ist, ist der Shopname verlinkt.",
    models: "Anzahl der aktuell berücksichtigten Modelle dieses Shops.",
    price_sum: "Summe der Modellpreise der aktuell berücksichtigten Modelle dieses Shops.",
    price_avg: "Durchschnittlicher Modellpreis: Summe Preis / Anzahl Modelle.",
    shipping_sum: "Summe der anteiligen Versandkosten der aktuell berücksichtigten Modelle dieses Shops.",
    shipping_avg: "Durchschnittliche Versandkosten: Summe Versandkosten / Anzahl Modelle.",
    total_sum: "Gesamtsumme aus Modellpreis plus anteiligen Versandkosten.",
    total_avg: "Durchschnittliche Gesamtkosten: Gesamt / Anzahl Modelle.",
    groups: "Anzahl unterschiedlicher Airline-Gruppen bei diesem Shop.",
    types: "Anzahl unterschiedlicher Flugzeugtypen bei diesem Shop."
  };

  return tips[key] || "";
}

function modelsOverviewStatusParam(){
  const v = document.getElementById("status")?.value || "owned";

  if(v === "all"){
    return "owned,ordered";
  }

  return v;
}

function render(rows){
  document.getElementById("count").textContent =
    rows.length === 1 ? "1 Shop" : `${rows.length} Shops`;

  if(!rows.length){
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
          <th class="${thClass("shop")}" data-sort="shop" title="${esc(columnTooltip("shop"))}">Shop ${mark("shop")}</th>
          <th class="${thClass("models", "num")}" data-sort="models" title="${esc(columnTooltip("models"))}">Modelle ${mark("models")}</th>
          <th class="${thClass("price_sum", "num")}" data-sort="price_sum" title="${esc(columnTooltip("price_sum"))}">Preis ${mark("price_sum")}</th>
          <th class="${thClass("price_avg", "num")}" data-sort="price_avg" title="${esc(columnTooltip("price_avg"))}">Ø Preis ${mark("price_avg")}</th>
          <th class="${thClass("shipping_sum", "num")}" data-sort="shipping_sum" title="${esc(columnTooltip("shipping_sum"))}">Versandkosten ${mark("shipping_sum")}</th>
          <th class="${thClass("shipping_avg", "num")}" data-sort="shipping_avg" title="${esc(columnTooltip("shipping_avg"))}">Ø Versand ${mark("shipping_avg")}</th>
          <th class="${thClass("total_sum", "num")}" data-sort="total_sum" title="${esc(columnTooltip("total_sum"))}">Gesamt ${mark("total_sum")}</th>
          <th class="${thClass("total_avg", "num")}" data-sort="total_avg" title="${esc(columnTooltip("total_avg"))}">Ø Gesamt ${mark("total_avg")}</th>
          <th class="${thClass("groups", "num")}" data-sort="groups" title="${esc(columnTooltip("groups"))}">Airline-Gruppen ${mark("groups")}</th>
          <th class="${thClass("types", "num")}" data-sort="types" title="${esc(columnTooltip("types"))}">Typen ${mark("types")}</th>
        </tr>
      </thead> 
      <tbody>
  `;

  for(const row of rows){
    const shopText = row.shop || "";
    const shopQuery = row.shop_key === SHOP_MISSING_KEY ? "__shop_missing__" : row.shop_key;
    const statusParam = modelsOverviewStatusParam();
    const href =
      `./models_overview.html?q=${encodeURIComponent(shopQuery)}` +
      `&status=${encodeURIComponent(statusParam)}`;
    
    let shopCell = esc(shopText);
    
    // Externer Produktlink nur, wenn genau ein Modell/eine eindeutige URL dahinterliegt
    if(row.models === 1 && row.shop_url){
      shopCell = `<a href="${esc(row.shop_url)}" target="_blank" rel="noopener noreferrer">${esc(shopText)}</a>`;
    }

    html += `
      <tr class="shopRow" data-href="${esc(href)}">
        <td>${shopCell}</td>
        <td class="num mono">${esc(row.models)}</td>
        <td class="num mono money">${esc(formatMoneyDE(row.price_sum))}</td>
        <td class="num mono money">${esc(formatMoneyDE(row.price_avg))}</td>
        <td class="num mono money">${esc(formatMoneyDE(row.shipping_sum))}</td>
        <td class="num mono money">${esc(formatMoneyDE(row.shipping_avg))}</td>
        <td class="num mono money">${esc(formatMoneyDE(row.total_sum))}</td>
        <td class="num mono money">${esc(formatMoneyDE(row.total_avg))}</td>
        <td class="num mono">${row.groups > 0 ? esc(row.groups) : ""}</td>
        <td class="num mono">${row.types > 0 ? esc(row.types) : ""}</td>
      </tr>
    `;
  }

  const totalModels = sumRows(rows, "models");
  const totalPrice = sumRows(rows, "price_sum");
  const totalShipping = sumRows(rows, "shipping_sum");
  const totalAll = sumRows(rows, "total_sum");

  html += `
      </tbody>
      <tfoot>
        <tr class="sumRow">
          <td>Summen</td>
          <td class="num mono">${esc(totalModels)}</td>
          <td class="num mono money">${esc(formatMoneyDE(totalPrice))}</td>
          <td class="num mono money">${esc(formatMoneyDE(avg(totalPrice, totalModels)))}</td>
          <td class="num mono money">${esc(formatMoneyDE(totalShipping))}</td>
          <td class="num mono money">${esc(formatMoneyDE(avg(totalShipping, totalModels)))}</td>
          <td class="num mono money">${esc(formatMoneyDE(totalAll))}</td>
          <td class="num mono money">${esc(formatMoneyDE(avg(totalAll, totalModels)))}</td>
          <td class="num mono"></td>
          <td class="num mono"></td>
        </tr>
      </tfoot>
    </table>
  `;

  document.getElementById("content").innerHTML = html;

  document.querySelectorAll("#content .shopRow").forEach(tr => {
    tr.addEventListener("click", (ev) => {
      if(ev.target.closest("a")) return;
      const href = tr.getAttribute("data-href");
      if(href) location.href = href;
    });
  });

  document.querySelectorAll("#content th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;

      if(tableSortKey === key){
        tableSortDir *= -1;
      }else{
        tableSortKey = key;
        tableSortDir = [
          "models",
          "price_sum",
          "price_avg",
          "shipping_sum",
          "shipping_avg",
          "total_sum",
          "total_avg"
        ].includes(key) ? -1 : 1;
      }

      localStorage.setItem("shopsSortKey", tableSortKey);
      localStorage.setItem("shopsSortDir", String(tableSortDir));

      apply();
    });
  });
}

function apply(){
  const statusValue = document.getElementById("status").value || "owned";

  const filters = {
    q: norm(document.getElementById("q").value),
    group: document.getElementById("group").value,
    statusValue,
    statuses: statusAllowedSet(statusValue),
    shopKnown: document.getElementById("shopKnown").value
  };

  updateActiveFilterUI(filters);

  refillGroupOptions(
    state.all.filter(it => matchesStatus(it, filters)),
    filters.group
  );

  let rows = buildShopRows(state.all, filters);

  rows = rows.filter(row => matchesQueryRow(row, filters.q));
  rows = sortRows(rows);

  state.filtered = rows;
  render(rows);
}

async function main(){
  try{
    const res = await fetch("./index.json", {cache:"no-store"});
    if(!res.ok) throw new Error(`index.json HTTP ${res.status}`);

    const data = await res.json();
    state.all = Array.isArray(data?.items) ? data.items : [];

    const initialFilters = {
      statusValue: "owned",
      statuses: statusAllowedSet("owned")
    };
    const initialRows = buildShopRows(state.all, initialFilters);

    document.getElementById("meta").innerHTML =
      `<span class="mono">${esc(formatStandDE(data.generated_at || ""))}</span>` +
      ` · Anzahl: <span class="mono">${esc(initialRows.length)}</span>`;

    document.getElementById("q").addEventListener("input", apply);
    document.getElementById("group").addEventListener("change", apply);
    document.getElementById("status").addEventListener("change", apply);
    document.getElementById("shopKnown").addEventListener("change", apply);

    document.getElementById("reset").addEventListener("click", () => {
      document.getElementById("q").value = "";
      document.getElementById("group").value = "";
      document.getElementById("status").value = "owned";
      document.getElementById("shopKnown").value = "";

      tableSortKey = "total_sum";
      tableSortDir = -1;
      localStorage.removeItem("shopsSortKey");
      localStorage.removeItem("shopsSortDir");

      history.replaceState(null, "", location.pathname);
      apply();
    });

    const p = new URLSearchParams(location.search);

    if(p.has("q")){
      document.getElementById("q").value = p.get("q") || "";
    }

    if(p.has("group")){
      document.getElementById("group").value = p.get("group") || "";
    }

    if(p.has("status")){
      document.getElementById("status").value = p.get("status") || "owned";
    }

    if(p.has("shopKnown")){
      document.getElementById("shopKnown").value = p.get("shopKnown") || "";
    }

    if(p.has("sort")){
      const sort = p.get("sort") || "";
      const allowed = new Set([
        "shop",
        "models",
        "price_sum",
        "price_avg",
        "shipping_sum",
        "shipping_avg",
        "total_sum",
        "total_avg",
        "groups",
        "types"
      ]);

      if(allowed.has(sort)){
        tableSortKey = sort;
        tableSortDir = 1;
      }
    }

    apply();

  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">index.json</span> nicht laden. (${esc(e.message)})</div>`;
    document.getElementById("meta").textContent = "";
    document.getElementById("count").textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", main);
