const state = {
  all: [],
  filtered: []
};

let tableSortKey = localStorage.getItem("airlinesSortKey") || "group";
let tableSortDir = Number(localStorage.getItem("airlinesSortDir") || "1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = 1;

const OPTIONAL_COLUMNS = [
  { key: "price_total", label: "Preis" },
  { key: "shipping_total", label: "Versandkosten" },
  { key: "space_cm", label: "Platzbedarf" }
];

function getVisibleOptionalColumns(){
  try{
    const raw = localStorage.getItem("airlinesOverviewOptionalColumns");
    const arr = JSON.parse(raw || "[]");
    if(!Array.isArray(arr)) return [];

    const allowed = new Set(OPTIONAL_COLUMNS.map(c => c.key));
    return arr.filter(x => allowed.has(x));
  }catch(e){
    return [];
  }
}

function setVisibleOptionalColumns(keys){
  localStorage.setItem("airlinesOverviewOptionalColumns", JSON.stringify(keys || []));
}

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

function getAirlineName(it){
  return String(it.airline_row || it.airline || it.airline_code || "").trim();
}

function getGroupName(it){
  return String(it.airline || it.group || it.airline_group || "").trim();
}

function matchesModelStatus(it, filters){
  const s = String(it.status || "").trim().toLowerCase();

  const ownedOn = filters.owned !== false;
  const orderedOn = filters.ordered === true;
  const wishlistOn = filters.wishlist === true;

  if(s === "owned") return ownedOn;
  if(s === "ordered") return orderedOn;
  if(s === "wishlist" || it.wishlist === true) return wishlistOn;

  return false;
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

function parseDecimalDE(v){
  if(v === null || v === undefined || v === "") return null;

  const s = String(v).trim().replace(",", ".");
  const n = Number(s);

  return Number.isFinite(n) ? n : null;
}

function getScaleDenominator(scale){
  const m = String(scale || "").match(/1\s*:\s*(\d+)/);
  if(!m) return null;

  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function calcModelLengthCm(it){
  const lengthM = parseDecimalDE(it.length_m);
  const denom = getScaleDenominator(it.scale);

  if(lengthM === null || !denom) return 0;

  return (lengthM * 100) / denom;
}

function formatMoneyDE(n){
  if(!Number.isFinite(n)) n = 0;

  return `€\u00A0${n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatCmDE(n){
  if(!Number.isFinite(n)) n = 0;

  return `${n.toLocaleString("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} cm`;
}

function buildAirlineRows(items, filters){
  const map = new Map();

  items
    .filter(it => matchesModelStatus(it, filters))
    .forEach(it => {
      const airline = getAirlineName(it);
      const group = getGroupName(it);

      if(!airline) return;

      const key = airline;

      if(!map.has(key)){
        map.set(key, {
          airline,
          group,
          models: 0,
          typesSet: new Set(),
          flown: 0,
          priceTotal: 0,
          shippingTotal: 0,
          spaceCm: 0
        });
      }

      const row = map.get(key);

      row.models += 1;

      if(it.aircraft_type){
        row.typesSet.add(String(it.aircraft_type).trim());
      }

      if(it.flown === true){
        row.flown += 1;
      }

      row.priceTotal += parseMoneyValue(it.price);
      row.shippingTotal += parseMoneyValue(it.shipping_allocated);
      row.spaceCm += calcModelLengthCm(it);

      if(!row.group && group){
        row.group = group;
      }
    });

  return Array.from(map.values()).map(row => ({
    airline: row.airline,
    group: row.group,
    models: row.models,
    types: row.typesSet.size,
    flown: row.flown,
    price_total: row.priceTotal,
    shipping_total: row.shippingTotal,
    space_cm: row.spaceCm
  }));
}

function refillGroupOptions(rows, currentValue){
  const sel = document.getElementById("group");
  if(!sel) return;

  const groups = Array.from(
    new Set(rows.map(x => x.group).filter(Boolean))
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

function matchesQuery(row, q){
  if(!q) return true;

  const hay = [
    row.airline,
    row.group,
    row.models,
    row.types,
    row.flown
  ].map(norm).join(" | ");

  return hay.includes(q);
}

function matchesGroup(row, group){
  if(!group) return true;
  return row.group === group;
}

function matchesFlown(row, flown){
  if(!flown) return true;

  if(flown === "true") return row.flown > 0;
  if(flown === "false") return row.flown === 0;

  return true;
}

function updateActiveFilterUI(filters){
  const map = [
    ["q", "Suche"],
    ["group", "Airline-Gruppe"],
    ["flown", "Mitgeflogen"]
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

function sortRows(rows){
  const arr = rows.slice();

  arr.sort((a,b) => {
    let va = a[tableSortKey];
    let vb = b[tableSortKey];

    if(["models", "types", "flown", "price_total", "shipping_total", "space_cm"].includes(tableSortKey)){
      va = Number(va || 0);
      vb = Number(vb || 0);
    }else{
      va = String(va || "").toLowerCase();
      vb = String(vb || "").toLowerCase();
    }

    if(va < vb) return -1 * tableSortDir;
    if(va > vb) return  1 * tableSortDir;

    // Default-Tie-Breaker: Gruppe → Airline
    const ga = String(a.group || "").toLowerCase();
    const gb = String(b.group || "").toLowerCase();

    if(ga < gb) return -1;
    if(ga > gb) return 1;

    return String(a.airline || "").localeCompare(String(b.airline || ""), "de");
  });

  return arr;
}

function sumRows(rows, key){
  return rows.reduce((sum, row) => {
    const n = Number(row[key] || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function formatOptionalValue(key, value){
  if(key === "price_total" || key === "shipping_total"){
    return formatMoneyDE(value);
  }

  if(key === "space_cm"){
    return formatCmDE(value);
  }

  return value ?? "";
}

function averagePerModel(row, key){
  const models = Number(row.models || 0);
  if(!models) return 0;

  const value = Number(row[key] || 0);
  return Number.isFinite(value) ? value / models : 0;
}

function render(rows){
  document.getElementById("count").textContent =
    rows.length === 1 ? "1 Airline" : `${rows.length} Airlines`;

  if(!rows.length){
    document.getElementById("content").innerHTML = `<div class="err">Keine Treffer.</div>`;
    return;
  }

  const mark = (key) => {
    if(tableSortKey !== key) return `<span class="sortMark">↕</span>`;
    return `<span class="sortMark active">${tableSortDir === 1 ? "↑" : "↓"}</span>`;
  };

  const thClass = (key) =>
    tableSortKey === key ? "thSort active" : "thSort";

  const visibleOptionalCols = getVisibleOptionalColumns();
  
  const optionalHeaders = visibleOptionalCols.map(key => {
    const col = OPTIONAL_COLUMNS.find(c => c.key === key);
    if(!col) return "";
  
    let html = `<th class="${thClass(key)} num" data-sort="${esc(key)}">${esc(col.label)} ${mark(key)}</th>`;
  
    if(key === "price_total"){
      html += `<th class="num">Ø Preis</th>`;
    }
  
    if(key === "shipping_total"){
      html += `<th class="num">Ø Versand</th>`;
    }
  
    return html;
  }).join("");
  
  let html = `
    <table>
      <thead>
        <tr>
          <th class="${thClass("airline")}" data-sort="airline">Airline ${mark("airline")}</th>
          <th class="${thClass("group")}" data-sort="group">Airline-Gruppe ${mark("group")}</th>
          <th class="${thClass("models")} num" data-sort="models">Modelle ${mark("models")}</th>
          <th class="${thClass("types")} num" data-sort="types">Typen ${mark("types")}</th>
          <th class="${thClass("flown")} num" data-sort="flown">Mitgeflogen ${mark("flown")}</th>
          ${optionalHeaders}
        </tr>
      </thead>
      <tbody>
  `;

  for(const row of rows){
    const href =
      `./models_overview.html?group=${encodeURIComponent(row.group || "")}` +
      `&airline=${encodeURIComponent(row.airline || "")}` +
      `&status=owned`;
    
    const optionalCells = visibleOptionalCols.map(key => {
      let html = "";
    
      const value = formatOptionalValue(key, row[key]);
      html += `<td class="num mono">${esc(value)}</td>`;
    
      if(key === "price_total"){
        html += `<td class="num mono">${esc(formatMoneyDE(averagePerModel(row, "price_total")))}</td>`;
      }
    
      if(key === "shipping_total"){
        html += `<td class="num mono">${esc(formatMoneyDE(averagePerModel(row, "shipping_total")))}</td>`;
      }
    
      return html;
    }).join("");
        
    html += `
      <tr class="airlineRow" data-href="${esc(href)}">
        <td>${esc(row.airline)}</td>
        <td>${esc(row.group)}</td>
        <td class="num mono">${esc(row.models)}</td>
        <td class="num mono">${esc(row.types)}</td>
        <td class="num mono">
          ${
            row.flown > 0
              ? `<span class="badge badge-flown">${esc(row.flown)}</span>`
              : `<span class="muted">0</span>`
          }
        </td>
        ${optionalCells}
      </tr>
    `;
  }

  const totalModels = sumRows(rows, "models");
  
  const optionalSumCells = visibleOptionalCols.map(key => {
    let html = "";
  
    const sum = sumRows(rows, key);
    html += `<td class="num mono">${esc(formatOptionalValue(key, sum))}</td>`;
  
    if(key === "price_total"){
      const avg = totalModels ? sum / totalModels : 0;
      html += `<td class="num mono">${esc(formatMoneyDE(avg))}</td>`;
    }
  
    if(key === "shipping_total"){
      const avg = totalModels ? sum / totalModels : 0;
      html += `<td class="num mono">${esc(formatMoneyDE(avg))}</td>`;
    }
  
    return html;
  }).join("");

  html += `
      </tbody>
      <tfoot>
        <tr class="sumRow">
          <td colspan="2">Summe angezeigte Airlines</td>
          <td class="num mono">${esc(sumRows(rows, "models"))}</td>
          <td class="num mono">${esc(sumRows(rows, "types"))}</td>
          <td class="num mono">${esc(sumRows(rows, "flown"))}</td>
          ${optionalSumCells}
        </tr>
      </tfoot>
    </table>
  `;
  
  document.getElementById("content").innerHTML = html;

  document.querySelectorAll("#content .airlineRow").forEach(tr => {
    tr.addEventListener("click", () => {
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
        tableSortDir = 1;
      }

      localStorage.setItem("airlinesSortKey", tableSortKey);
      localStorage.setItem("airlinesSortDir", String(tableSortDir));

      apply();
    });
  });
}

function apply(){
  const filters = {
    q: norm(document.getElementById("q").value),
    group: document.getElementById("group").value,
    flown: document.getElementById("flown").value,
  
    // derzeit bewusst fix: nur vorhandene Modelle
    // später können hier Checkboxen für ordered / wishlist ergänzt werden
    owned: true,
    ordered: false,
    wishlist: false
  };

  updateActiveFilterUI(filters);

  const baseRows = buildAirlineRows(state.all, filters);

  refillGroupOptions(baseRows, filters.group);

  let rows = baseRows.filter(row => {
    if(!matchesQuery(row, filters.q)) return false;
    if(!matchesGroup(row, filters.group)) return false;
    if(!matchesFlown(row, filters.flown)) return false;
    return true;
  });

  rows = sortRows(rows);

  state.filtered = rows;
  render(rows);
}

function makeColumnPanelDraggable(){
  const panel = document.getElementById("columnPanel");
  const handle = panel?.querySelector(".columnPanelHead");

  if(!panel || !handle) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  handle.addEventListener("pointerdown", (ev) => {
    if(ev.target.closest("button")) return;

    dragging = true;
    panel.classList.add("is-dragging");

    const rect = panel.getBoundingClientRect();

    startX = ev.clientX;
    startY = ev.clientY;
    startLeft = rect.left;
    startTop = rect.top;

    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.transform = "none";

    handle.setPointerCapture(ev.pointerId);
  });

  handle.addEventListener("pointermove", (ev) => {
    if(!dragging) return;

    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    const rect = panel.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - 8;
    const maxTop = window.innerHeight - rect.height - 8;

    const newLeft = clamp(startLeft + dx, 8, maxLeft);
    const newTop = clamp(startTop + dy, 8, maxTop);

    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  });

  handle.addEventListener("pointerup", (ev) => {
    dragging = false;
    panel.classList.remove("is-dragging");

    try{
      handle.releasePointerCapture(ev.pointerId);
    }catch(e){}
  });

  handle.addEventListener("pointercancel", () => {
    dragging = false;
    panel.classList.remove("is-dragging");
  });
}

async function main(){
  try{
    const res = await fetch("./index.json", {cache:"no-store"});
    if(!res.ok) throw new Error(`index.json HTTP ${res.status}`);

    const data = await res.json();
    state.all = Array.isArray(data?.items) ? data.items : [];

    const baseRows = buildAirlineRows(state.all, {
      owned: true,
      ordered: false,
      wishlist: false
    });

    document.getElementById("meta").innerHTML =
      `<span class="mono">${esc(formatStandDE(data.generated_at || ""))}</span>` +
      ` · Anzahl: <span class="mono">${esc(baseRows.length)}</span>`;

    document.getElementById("q").addEventListener("input", apply);
    document.getElementById("group").addEventListener("change", apply);
    document.getElementById("flown").addEventListener("change", apply);

    document.getElementById("reset").addEventListener("click", () => {
      document.getElementById("q").value = "";
      document.getElementById("group").value = "";
      document.getElementById("flown").value = "";

      tableSortKey = "group";
      tableSortDir = 1;
      localStorage.removeItem("airlinesSortKey");
      localStorage.removeItem("airlinesSortDir");

      history.replaceState(null, "", location.pathname);
      apply();
    });

    const visibleOptionalCols = new Set(getVisibleOptionalColumns());

    document.querySelectorAll(".colToggle").forEach(cb => {
      cb.checked = visibleOptionalCols.has(cb.value);
    
      cb.addEventListener("change", () => {
        const keys = Array.from(document.querySelectorAll(".colToggle"))
          .filter(x => x.checked)
          .map(x => x.value);
    
        setVisibleOptionalColumns(keys);
        apply();
      });
    });
    
    document.getElementById("selectAllColumns")?.addEventListener("click", () => {
      const keys = OPTIONAL_COLUMNS.map(c => c.key);
    
      document.querySelectorAll(".colToggle").forEach(cb => {
        cb.checked = true;
      });
    
      setVisibleOptionalColumns(keys);
      apply();
    });
    
    document.getElementById("clearAllColumns")?.addEventListener("click", () => {
      document.querySelectorAll(".colToggle").forEach(cb => {
        cb.checked = false;
      });
    
      setVisibleOptionalColumns([]);
      apply();
    });
    
    const columnPanel = document.getElementById("columnPanel");
    const columnBackdrop = document.getElementById("columnPanelBackdrop");
    
    function openColumnPanel(){
      if(columnPanel){
        columnPanel.hidden = false;
        columnPanel.style.left = "";
        columnPanel.style.top = "";
        columnPanel.style.right = "";
        columnPanel.style.bottom = "";
        columnPanel.style.transform = "";
      }
    
      if(columnBackdrop) columnBackdrop.hidden = false;
      document.body.classList.add("noscroll");
    }
    
    function closeColumnPanel(){
      if(columnPanel) columnPanel.hidden = true;
      if(columnBackdrop) columnBackdrop.hidden = true;
      document.body.classList.remove("noscroll");
    }
    
    document.getElementById("openColumns")?.addEventListener("click", openColumnPanel);
    document.getElementById("closeColumns")?.addEventListener("click", closeColumnPanel);
    columnBackdrop?.addEventListener("click", closeColumnPanel);
    makeColumnPanelDraggable();
    
    document.addEventListener("keydown", (ev) => {
      if(ev.key === "Escape"){
        closeColumnPanel();
      }
    });
    
    const p = new URLSearchParams(location.search);

    if(p.has("q")){
      document.getElementById("q").value = p.get("q") || "";
    }

    if(p.has("group")){
      document.getElementById("group").value = p.get("group") || "";
    }

    if(p.has("flown")){
      document.getElementById("flown").value = p.get("flown") || "";
    }

    if(p.has("sort")){
      const sort = p.get("sort") || "";
      const allowed = new Set(["airline", "group", "models", "types", "flown"]);

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
