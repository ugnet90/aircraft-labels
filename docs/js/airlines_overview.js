const state = {
  all: [],
  filtered: [],
  groupTypes: []
};

let tableSortKey = localStorage.getItem("airlinesSortKey") || "group";
if(tableSortKey === "airline"){
  tableSortKey = "group";
}
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

function getModelStatus(it){
  const s = String(it.status || "").trim().toLowerCase();

  if(s === "owned") return "owned";
  if(s === "ordered") return "ordered";
  if(s === "wishlist" || it.wishlist === true) return "wishlist";

  return "";
}

function pairKey(group, aircraftId){
  return `${String(group || "").trim()}||${String(aircraftId || "").trim()}`;
}

function ensureAirlineRow(map, group){
  const g = String(group || "").trim();
  if(!g) return null;

  if(!map.has(g)){
    map.set(g, {
      group: g,

      // Bestand / Bedarf
      models: 0,
      owned: 0,
      ordered: 0,
      wishlist: 0,
      missing: 0,

      // Typen
      typesSet: new Set(),
      wishlistTypesSet: new Set(),
      missingTypesSet: new Set(),

      // übrige bestehende Kennzahlen
      flown: 0,
      priceTotal: 0,
      shippingTotal: 0,
      spaceCm: 0
    });
  }

  return map.get(g);
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

const DISPLAY_ANGLE_DEG = 45;

function calcModelDimensionCm(originalMeters, scale){
  const m = parseDecimalDE(originalMeters);
  const denom = getScaleDenominator(scale);

  if(m === null || !denom) return 0;

  return (m * 100) / denom;
}

const WING_POSITION_FROM_NOSE = 0.45;

function calcModelDisplayWidthCm(it){
  const lengthCm = calcModelDimensionCm(it.length_m, it.scale);
  const wingspanCm = calcModelDimensionCm(it.wingspan_m, it.scale);

  if(!lengthCm && !wingspanCm) return 0;

  const angleRad = DISPLAY_ANGLE_DEG * Math.PI / 180;

  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  // Projektion des Rumpfs auf die Vitrinenbreite:
  // Nase = 0, Heck = lengthCm
  const fuselageMin = 0;
  const fuselageMax = lengthCm * c;

  // Tragflächen liegen nicht über die ganze Länge,
  // sondern ungefähr bei 45 % der Rumpflänge ab Nase.
  const wingX = lengthCm * WING_POSITION_FROM_NOSE * c;
  const halfWing = (wingspanCm / 2) * s;

  const wingMin = wingX - halfWing;
  const wingMax = wingX + halfWing;

  // Effektiver Platzbedarf = äußerste linke bis äußerste rechte Projektion
  const minX = Math.min(fuselageMin, wingMin);
  const maxX = Math.max(fuselageMax, wingMax);

  return Math.max(0, maxX - minX);
}

function formatMoneyDE(n){
  if(!Number.isFinite(n) || n === 0) return "";

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

function matchesModelFlown(it, filters){
  if(!filters.flown) return true;

  if(filters.flown === "true"){
    return it.flown === true;
  }

  if(filters.flown === "false"){
    return it.flown !== true;
  }

  return true;
}

function buildAirlineRows(items, groupTypes, filters){
  const map = new Map();

  // Status je Airline-Gruppe + aircraft_id:
  // Grundlage für die Berechnung "fehlend".
  const statusByGroupType = new Map();

  (items || []).forEach(it => {
    const group = getGroupName(it);
    const aircraftId = String(it.aircraft_id || "").trim();
    const status = getModelStatus(it);

    if(!group || !aircraftId || !status) return;

    const key = pairKey(group, aircraftId);

    if(!statusByGroupType.has(key)){
      statusByGroupType.set(key, { owned: 0, ordered: 0, wishlist: 0 });
    }

    const item = statusByGroupType.get(key);

    if(status === "owned") item.owned += 1;
    if(status === "ordered") item.ordered += 1;
    if(status === "wishlist") item.wishlist += 1;
  });

  // Echte Modelle / Bestellungen / Wünsche zählen.
  (items || [])
    .filter(it => matchesModelFlown(it, filters))
    .forEach(it => {
      const group = getGroupName(it);
      if(!group) return;

      const row = ensureAirlineRow(map, group);
      if(!row) return;

      const status = getModelStatus(it);
      const aircraftType = String(it.aircraft_type || "").trim();
      const aircraftId = String(it.aircraft_id || "").trim();

      if(status === "owned"){
        row.models += 1;
        row.owned += 1;

        if(aircraftType) row.typesSet.add(aircraftType);

        if(it.flown === true){
          row.flown += 1;
        }

        row.priceTotal += parseMoneyValue(it.price);
        row.shippingTotal += parseMoneyValue(it.shipping_allocated);
        row.spaceCm += calcModelDisplayWidthCm(it);
      }

      if(status === "ordered"){
        row.models += 1;
        row.ordered += 1;

        if(aircraftType) row.typesSet.add(aircraftType);

        row.priceTotal += parseMoneyValue(it.price);
        row.shippingTotal += parseMoneyValue(it.shipping_allocated);
        row.spaceCm += calcModelDisplayWidthCm(it);
      }

      if(status === "wishlist"){
        row.wishlist += 1;
        if(aircraftId) row.wishlistTypesSet.add(aircraftId);
      }
    });

  // Fehlende Typen aus group_aircraft_types.json ableiten.
  const seenRelevantPairs = new Set();

  (groupTypes || []).forEach(gt => {
    const group = String(gt.airline || "").trim();
    const aircraftId = String(gt.aircraft_id || "").trim();

    if(!group || !aircraftId) return;

    const key = pairKey(group, aircraftId);
    if(seenRelevantPairs.has(key)) return;
    seenRelevantPairs.add(key);

    const row = ensureAirlineRow(map, group);
    if(!row) return;

    const s = statusByGroupType.get(key) || { owned: 0, ordered: 0, wishlist: 0 };

    // Für diese Verdichtungsseite gilt:
    // Wunsch wird separat gezählt und verhindert daher "fehlend".
    if(s.owned > 0 || s.ordered > 0 || s.wishlist > 0) return;

    row.missing += 1;
    row.missingTypesSet.add(aircraftId);
  });

  return Array.from(map.values()).map(row => ({
    group: row.group,

    models: row.models,
    owned: row.owned,
    ordered: row.ordered,
    wishlist: row.wishlist,
    missing: row.missing,

    types: row.typesSet.size,
    type_keys: Array.from(row.typesSet),

    wishlist_types: row.wishlistTypesSet.size,
    missing_types: row.missingTypesSet.size,

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
    row.group,
    row.models,
    row.owned,
    row.ordered,
    row.wishlist,
    row.missing,
    row.types,
    row.flown,
    row.wishlist > 0 ? "wunsch wishlist" : "",
    row.missing > 0 ? "fehlt fehlend missing" : ""
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

    if(tableSortKey === "price_avg"){
      va = averagePerModel(a, "price_total");
      vb = averagePerModel(b, "price_total");
    }
    else if(tableSortKey === "shipping_avg"){
      va = averagePerModel(a, "shipping_total");
      vb = averagePerModel(b, "shipping_total");
    }
    else if(["models", "owned", "ordered", "wishlist", "missing", "types", "flown", "price_total", "shipping_total", "space_cm"].includes(tableSortKey)){
      va = Number(va || 0);
      vb = Number(vb || 0);
    }
    else{
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

function columnTooltip(key){
  const wingPosPct = Math.round(WING_POSITION_FROM_NOSE * 100);

  const tips = {
    group: "Airline-Gruppe gemäß Datenfeld airline. Die Auswertung erfolgt gruppiert nach Airline-Gruppe.",
    models: "Gesamtanzahl der aktuell berücksichtigten vorhandenen und bestellten Modelle dieser Airline-Gruppe.",
    owned: "Anzahl vorhandener Modelle dieser Airline-Gruppe.",
    ordered: "Anzahl bestellter Modelle dieser Airline-Gruppe.",
    wishlist: "Anzahl der Wunschmodelle dieser Airline-Gruppe.",
    missing: "Anzahl fehlender Flugzeugtypen laut group_aircraft_types.json: Typ ist für die Airline-Gruppe relevant, aber weder vorhanden noch bestellt noch als Wunsch erfasst.",    
    types: "Anzahl unterschiedlicher Flugzeugtypen innerhalb der aktuell berücksichtigten Modelle dieser Airline-Gruppe.",
    flown: "Anzahl der aktuell berücksichtigten Modelle dieser Airline-Gruppe, mit denen du mitgeflogen bist.",

    price_total: "Summe der Modellpreise der aktuell berücksichtigten Modelle dieser Airline-Gruppe.",
    price_avg: "Durchschnittlicher Modellpreis: Summe Preis / Anzahl Modelle.",

    shipping_total: "Summe der anteiligen Versandkosten der aktuell berücksichtigten Modelle dieser Airline-Gruppe.",
    shipping_avg: "Durchschnittliche Versandkosten: Summe Versandkosten / Anzahl Modelle.",

    space_cm: `Berechnung: geschätzter projizierter Platzbedarf bei ${DISPLAY_ANGLE_DEG}° Aufstellwinkel. Die Tragfläche wird näherungsweise bei ${wingPosPct}% der Rumpflänge ab Nase angenommen.`
  };

  return tips[key] || "";
}

function countUniqueTypes(rows){
  const set = new Set();

  rows.forEach(row => {
    const arr = Array.isArray(row.type_keys) ? row.type_keys : [];
    arr.forEach(t => {
      const s = String(t || "").trim();
      if(s) set.add(s);
    });
  });

  return set.size;
}

function isNumericSortKey(key){
  return [
    "models",
    "owned",
    "ordered",
    "wishlist",
    "missing",
    "types",
    "flown",
    "price_total",
    "price_avg",
    "shipping_total",
    "shipping_avg",
    "space_cm"
  ].includes(key);
}

function render(rows){
  document.getElementById("count").textContent =
    rows.length === 1 ? "1 Airline-Gruppe" : `${rows.length} Airline-Gruppen`;

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
  
    const tip = columnTooltip(key);
  
    let html = `
      <th class="${thClass(key)} num optionalBlockStart" data-sort="${esc(key)}" title="${esc(tip)}">
        ${esc(col.label)} ${mark(key)}
      </th>
    `;
  
    if(key === "price_total"){
      html += `
        <th class="${thClass("price_avg")} num" data-sort="price_avg" title="${esc(columnTooltip("price_avg"))}">
          Ø Preis ${mark("price_avg")}
        </th>
      `;
    }
  
    if(key === "shipping_total"){
      html += `
        <th class="${thClass("shipping_avg")} num" data-sort="shipping_avg" title="${esc(columnTooltip("shipping_avg"))}">
          Ø Versand ${mark("shipping_avg")}
        </th>
      `;
    }
  
    return html;
  }).join("");
  
  let html = `
    <table>
      <thead>
        <tr>
          <th class="${thClass("group")}" data-sort="group" title="${esc(columnTooltip("group"))}">
            Airline-Gruppe ${mark("group")}
          </th>
        
          <th class="${thClass("models")} num blockStart" data-sort="models" title="${esc(columnTooltip("models"))}">
            Modelle ${mark("models")}
          </th>
          <th class="${thClass("owned")} num" data-sort="owned" title="${esc(columnTooltip("owned"))}">
            vorh. ${mark("owned")}
          </th>
          <th class="${thClass("ordered")} num" data-sort="ordered" title="${esc(columnTooltip("ordered"))}">
            best. ${mark("ordered")}
          </th>
          <th class="${thClass("wishlist")} num" data-sort="wishlist" title="${esc(columnTooltip("wishlist"))}">
            Wunsch ${mark("wishlist")}
          </th>
          <th class="${thClass("missing")} num" data-sort="missing" title="${esc(columnTooltip("missing"))}">
            fehlt ${mark("missing")}
          </th>
        
          <th class="${thClass("types")} num blockStart" data-sort="types" title="${esc(columnTooltip("types"))}">
            Typen ${mark("types")}
          </th>
        
          <th class="${thClass("flown")} num blockStart" data-sort="flown" title="${esc(columnTooltip("flown"))}">
            Mitgeflogen ${mark("flown")}
          </th>
        
          ${optionalHeaders}
        </tr>
      </thead>
      <tbody>
  `;

  for(const row of rows){
    const href =
      `./models_overview.html?group=${encodeURIComponent(row.group || "")}` +
      `&status=owned,ordered`;
    
    const optionalCells = visibleOptionalCols.map(key => {
      let html = "";
    
      const value = formatOptionalValue(key, row[key]);
      html += `<td class="num mono optionalBlockStart">${esc(value)}</td>`;
    
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
        <td>${esc(row.group)}</td>
        
        <td class="num mono blockStart">${esc(row.models)}</td>
        <td class="num mono">${row.owned > 0 ? esc(row.owned) : ""}</td>
        <td class="num mono">${row.ordered > 0 ? esc(row.ordered) : ""}</td>
        
        <td class="num mono">
          ${
            row.wishlist > 0
              ? `<a class="badge badge-wishlist" href="./models_overview.html?group=${encodeURIComponent(row.group || "")}&status=wishlist">${esc(row.wishlist)}</a>`
              : ""
          }
        </td>
        
        <td class="num mono">
          ${
            row.missing > 0
              ? `<a class="badge badge-missing" href="./models_overview.html?group=${encodeURIComponent(row.group || "")}&status=missing">${esc(row.missing)}</a>`
              : ""
          }
        </td>
        
        <td class="num mono blockStart">${esc(row.types)}</td>
        
        <td class="num mono blockStart">
          ${
            row.flown > 0
              ? `<span class="badge badge-flown">${esc(row.flown)}</span>`
              : ""
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
    html += `<td class="num mono optionalBlockStart">${esc(formatOptionalValue(key, sum))}</td>`;
  
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
          <td>Summen</td>
          
          <td class="num mono blockStart">${esc(sumRows(rows, "models"))}</td>
          <td class="num mono">${sumRows(rows, "owned") > 0 ? esc(sumRows(rows, "owned")) : ""}</td>
          <td class="num mono">${sumRows(rows, "ordered") > 0 ? esc(sumRows(rows, "ordered")) : ""}</td>
          <td class="num mono">${sumRows(rows, "wishlist") > 0 ? esc(sumRows(rows, "wishlist")) : ""}</td>
          <td class="num mono">${sumRows(rows, "missing") > 0 ? esc(sumRows(rows, "missing")) : ""}</td>
          
          <td class="num mono blockStart">${esc(countUniqueTypes(rows))}</td>
          
          <td class="num mono blockStart">
            ${sumRows(rows, "flown") > 0 ? esc(sumRows(rows, "flown")) : ""}
          </td>
          
          ${optionalSumCells}
        </tr>
      </tfoot>
    </table>
  `;
  
  document.getElementById("content").innerHTML = html;

  document.querySelectorAll("#content .airlineRow").forEach(tr => {
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
        tableSortDir = isNumericSortKey(key) ? -1 : 1;
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
  
    // Default: vorhandene + bestellte Modelle
    owned: true,
    ordered: true,
    wishlist: false
  };

  updateActiveFilterUI(filters);

  const baseRows = buildAirlineRows(state.all, state.groupTypes, filters);

  refillGroupOptions(baseRows, filters.group);

  let rows = baseRows.filter(row => {
    if(!matchesQuery(row, filters.q)) return false;
    if(!matchesGroup(row, filters.group)) return false;
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
    
    try{
      const gtRes = await fetch("./data/group_aircraft_types.json", {cache:"no-store"});
      if(gtRes.ok){
        const gtData = await gtRes.json();
        state.groupTypes = Array.isArray(gtData?.items) ? gtData.items : [];
      }
    }catch(e){
      state.groupTypes = [];
    }
    
    const baseRows = buildAirlineRows(state.all, state.groupTypes, {
      owned: true,
      ordered: true,
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
      const allowed = new Set([
        "airline",
        "group",
        "models",
        "types",
        "flown",
        "wishlist",
        "missing",        
        "price_total",
        "price_avg",
        "shipping_total",
        "shipping_avg",
        "space_cm"
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
