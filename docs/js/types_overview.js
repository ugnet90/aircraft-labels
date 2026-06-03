function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function norm(s){ return String(s ?? "").trim().toLowerCase(); }

let data = null;
let all = [];
let expanded = new Set(); // aircraft_id

const OPTIONAL_COLUMNS = [
  { key: "role", label: "Rolle" },
  { key: "fuselage", label: "Rumpf" },
  { key: "market_segment", label: "Segment" },
  { key: "aircraft_kind", label: "Flugzeugart" },
  { key: "aircraft_status", label: "Status" },
  { key: "first_flight", label: "Erstflug" },
  { key: "propulsion", label: "Antrieb" },
  { key: "engines", label: "Triebwerke" },
  { key: "range_class", label: "Reichweite" },
  { key: "passengers", label: "Passagiere" },
  { key: "length_m", label: "Länge" },
  { key: "wingspan_m", label: "Spannweite" },
  { key: "height_m", label: "Höhe" }
];

const MEASURE_COLUMNS = new Set(["length_m", "wingspan_m", "height_m"]);

let measureMode = localStorage.getItem("typesOverviewMeasureMode") || "original";
if(measureMode !== "original" && measureMode !== "scale400"){
  measureMode = "original";
}

function getVisibleOptionalColumns(){
  try{
    const raw = localStorage.getItem("typesOverviewOptionalColumns");
    const arr = JSON.parse(raw || "[]");
    if(!Array.isArray(arr)) return [];

    const allowed = new Set(OPTIONAL_COLUMNS.map(c => c.key));
    return arr.filter(x => allowed.has(x));
  }catch(e){
    return [];
  }
}

function setVisibleOptionalColumns(keys){
  localStorage.setItem("typesOverviewOptionalColumns", JSON.stringify(keys || []));
}

function buildSelect(id, firstLabel, options){
  const sel = document.getElementById(id);
  sel.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = firstLabel;
  sel.appendChild(opt0);

  for(const x of options){
    const opt = document.createElement("option");
    opt.value = x;
    opt.textContent = x;
    sel.appendChild(opt);
  }
}

function buildStaticSelects(){  
  // Wingtip
  const wing = document.getElementById("wing");
  wing.innerHTML = `
    <option value="">Wingtip: alle</option>
    <option value="true">Wingtip: ja</option>
    <option value="false">Wingtip: nein</option>
  `;

  // Sortierung
  const sort = document.getElementById("sort");
  sort.innerHTML = `
    <option value="type_az">Sort: Typ A→Z</option>
    <option value="owned_desc">Sort: vorhanden ↓</option>
    <option value="ordered_desc">Sort: bestellt ↓</option>
    <option value="manufacturer_az">Sort: Hersteller A→Z</option>
  `;
}

function wingIcon(has){
  return has ? `<span class="wingIcon" title="Wingtip vorhanden">🪽</span>` : "";
}

function wingBadge(has){
  return has ? `<span class="wlBadge">WL</span>` : "";
}


function apply(){
  const q = norm(document.getElementById("q").value);
  const manu = document.getElementById("manu").value;
  const wing = document.getElementById("wing").value;
  const sort = document.getElementById("sort").value || "type_az";

  const fMissing = document.getElementById("fMissing").checked;
  const fOwned = document.getElementById("fOwned").checked;
  const fOrdered = document.getElementById("fOrdered").checked;

  let items = all.filter(x => {
    // Hersteller
    if(manu && (x.manufacturer || "") !== manu) return false;

    // Wingtip
    if(wing === "true" && x.has_wingtip !== true) return false;
    if(wing === "false" && x.has_wingtip !== false) return false;

    // Status via Checkboxen
    const hasOwned = (x.owned_count || 0) > 0;
    const hasOrdered = (x.ordered_count || 0) > 0;
    const isMissing = !hasOwned && !hasOrdered;

    const okMissing = fMissing && isMissing;
    const okOwned = fOwned && hasOwned;
    const okOrdered = fOrdered && hasOrdered;

    if(!(okMissing || okOwned || okOrdered)) return false;

    // Suche
    if(!q) return true;
    const hay = (norm(x.typ_anzeige) + " " + norm(x.aircraft_id) + " " + norm(x.manufacturer));
    return hay.includes(q);
  });

  items = sortItems(items, sort);

  document.getElementById("count").textContent =
    `${items.length} Typen · davon ${items.filter(x => (x.total_count || 0) > 0).length} mit Modellen`;

  render(items);
}

function sortItems(items, mode){
  const arr = items.slice();
  if(mode === "owned_desc"){
    arr.sort((a,b)=>(b.owned_count-a.owned_count) || (a.type_key||"").localeCompare(b.type_key||""));
    return arr;
  }
  if(mode === "ordered_desc"){
    arr.sort((a,b)=>(b.ordered_count-a.ordered_count) || (a.type_key||"").localeCompare(b.type_key||""));
    return arr;
  }
  if(mode === "manufacturer_az"){
    arr.sort((a,b)=> (a.manufacturer||"").localeCompare(b.manufacturer||"") || (a.type_key||"").localeCompare(b.type_key||""));
    return arr;
  }
  arr.sort((a,b)=> (a.type_key||"").localeCompare(b.type_key||""));
  return arr;
}

function statusLabel(st){
  switch(st){
    case "missing": return "fehlend";
    case "owned": return "vorhanden";
    case "ordered": return "bestellt";
    case "mixed": return "vorhanden + bestellt";
    default: return "";
  }
}

function statusBadge(st){
  const s = st || "";
  const lbl = statusLabel(s);
  const cls = "badge " + (s ? "st-" + s : "");
  return lbl ? `<span class="${cls}">${esc(lbl)}</span>` : "";
}

function wingBadge(v){
  return v === true ? `<span class="badge">WL/SL</span>` : "";
}

function getTypeField(x, key){
  const aliases = {
    role: ["role", "Role"],
    fuselage: ["fuselage", "rumpf", "Rumpf"],
    market_segment: ["market_segment", "MarketSegment"],
    aircraft_kind: ["aircraft_kind", "Flugzeugtyp"],
    aircraft_status: ["aircraft_status", "Status"],
    first_flight: ["first_flight", "Erstflug"],
    propulsion: ["propulsion", "Antrieb"],
    engines: ["engines", "Triebwerke"],
    range_class: ["range_class", "Reichweite"],
    passengers: ["passengers", "Passengers"],
    length_m: ["length_m", "Length"],
    wingspan_m: ["wingspan_m", "Wingspan"],
    height_m: ["height_m", "Height"]
  };

  const keys = aliases[key] || [key];

  for(const k of keys){
    const v = x?.[k];
    if(v !== undefined && v !== null && String(v).trim() !== ""){
      return v;
    }
  }

  return "";
}

function isRightAlignedOptionalColumn(key){
  return ["engines", "passengers", "length_m", "wingspan_m", "height_m"].includes(key);
}

function hasVisibleMeasureColumn(keys){
  return keys.some(key => MEASURE_COLUMNS.has(key));
}

function parseDecimalDE(v){
  if(v === null || v === undefined || v === "") return null;

  const s = String(v).trim().replace(",", ".");
  const n = Number(s);

  return Number.isFinite(n) ? n : null;
}

function formatNumberDE(n, digits){
  if(!Number.isFinite(n)) return "";

  return n.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMeasureValue(x, key){
  const originalM = parseDecimalDE(getTypeField(x, key));
  if(originalM === null) return "";

  if(measureMode === "original"){
    return formatNumberDE(originalM, 2);
  }

  // Typen-Übersicht: simuliertes Modellmaß 1:400 in cm
  const cm = (originalM * 100) / 400;
  return formatNumberDE(cm, 1);
}

function getMeasureColumnLabel(label, key){
  if(!MEASURE_COLUMNS.has(key)) return label;

  if(measureMode === "original"){
    return `${label} (m)`;
  }

  return `${label} (cm)`;
}

function updateMeasureModeUI(){
  const visibleOptionalCols = getVisibleOptionalColumns();
  const show = hasVisibleMeasureColumn(visibleOptionalCols);

  const box = document.getElementById("measureModeBox");
  if(box) box.hidden = !show;

  document.getElementById("measureOriginal")?.classList.toggle("is-on", measureMode === "original");
  document.getElementById("measureScale400")?.classList.toggle("is-on", measureMode === "scale400");
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

function render(items){
  if(items.length === 0){
    document.getElementById("content").innerHTML = `<div class="err">Keine Treffer.</div>`;
    return;
  }

  const visibleOptionalCols = getVisibleOptionalColumns();

  const optionalHeaders = visibleOptionalCols.map(key => {
    const col = OPTIONAL_COLUMNS.find(c => c.key === key);
    if(!col) return "";
  
    const cls = isRightAlignedOptionalColumn(key)
      ? `col-opt col-opt-num col-opt-${esc(key)}`
      : `col-opt col-opt-${esc(key)}`;
  
    const label = getMeasureColumnLabel(col.label, key);
  
    return `<th class="${cls}">${esc(label)}</th>`;
  }).join(""); 

  let html = `
    <table class="tbl">
      <thead>
        <tr>
          <th class="col-type">Typ</th>
          <th class="col-wing">WL</th>
          <th class="col-num">best.</th>
          <th class="col-num">vorh.</th>
          ${optionalHeaders}
        </tr>
      </thead>
      <tbody>
  `;

  for(const x of items){
    const isOpen = expanded.has(x.aircraft_id);
    const canOpen = (x.status !== "missing");
  
    const toggleHtml = canOpen
      ? `<button class="toggle" data-aid="${esc(x.aircraft_id)}" aria-label="Details">
           ${isOpen ? "▾" : "▸"}
         </button>`
      : ""; // kein Platzhalter mehr!

    const optionalCells = visibleOptionalCols.map(key => {
      const cls = isRightAlignedOptionalColumn(key)
        ? `col-opt col-opt-num col-opt-${esc(key)} mono`
        : `col-opt col-opt-${esc(key)}`;
    
      const value = MEASURE_COLUMNS.has(key)
        ? formatMeasureValue(x, key)
        : getTypeField(x, key);
    
      return `<td class="${cls}">${esc(value)}</td>`;
    }).join("");
    
    html += `
      <tr class="rowMain st-${esc(x.status || "")}" data-aid="${esc(x.aircraft_id)}">
 
        <td class="col-type">
          <div class="typeLine">
            ${toggleHtml}
            <div>

              <div class="typeName">
                ${esc(x.typ_anzeige || x.aircraft_id)}
                  ${(x.status !== "missing") ? `
                    <a class="typeLink"
                       href="./models_overview.html?aircraft_id=${encodeURIComponent(x.aircraft_id || "")}"
                       title="Alle Airlines dieses Typs anzeigen">↗︎</a>` : ""}
              </div>
              <div class="muted mono">${esc(x.aircraft_id)}</div>
            </div>
          </div>
        </td>
  
        <td class="col-wing">${wingBadge(x.has_wingtip === true)}</td>
        <td class="col-num mono">${(x.ordered_count > 0) ? esc(x.ordered_count) : ""}</td>
        <td class="col-num mono">${(x.owned_count > 0) ? esc(x.owned_count) : ""}</td>
        ${optionalCells}        
      </tr>
    `;
  
    if(isOpen && canOpen){
      const totalCols = 4 + visibleOptionalCols.length;

      html += `
        <tr class="rowDetail">
          <td colspan="${esc(totalCols)}">
            ${renderDetail(x)}
          </td>
        </tr>
      `;
    }
  }

  html += `</tbody></table>`;
  document.getElementById("content").innerHTML = html;
}

function renderDetail(x){
  const groups = Array.isArray(x.airline_group_counts) ? x.airline_group_counts : [];
  if(groups.length === 0){
    return `<div class="muted">Keine Modelle vorhanden/bestellt.</div>`;
  }

  let html = `
    <table class="detailTbl">
      <thead>
        <tr>
          <th>Airline-Gruppe</th>
          <th>Airline</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  for(const g of groups){
    const groupName = g.group || "";
    const airlines = Array.isArray(g.airlines) ? g.airlines : [];
  
    for(const a of airlines){
      const aName = a.airline || "";
  
      const aircraftId = x.aircraft_id || "";
      const typeLabel  = x.typ_anzeige || aircraftId;
  
      // Links
      const linkGroup =
        `./models_overview.html?group=${encodeURIComponent(groupName)}&aircraft_id=${encodeURIComponent(aircraftId)}`;
  
      const linkAir =
        `./models_overview.html?group=${encodeURIComponent(groupName)}&airline=${encodeURIComponent(aName)}&aircraft_id=${encodeURIComponent(aircraftId)}`;

      const ownedCount = Number(a.owned || 0);
      const orderedCount = Number(a.ordered || 0);

      const owned = (a.owned || 0) > 0;
      const ord   = (a.ordered || 0) > 0;
  
      // Dynamische Titel
      const titleGroup =
        `Alle Sammel-Modelle vom Typ ${typeLabel} in der Airline-Gruppe ${groupName} anzeigen`;
  
      const titleAir =
        `Alle Sammel-Modelle vom Typ ${typeLabel} bei ${aName} anzeigen`;
  
      const titleOwned =
        ownedCount === 1
          ? `1 vorhandenes Sammelmodell vom Typ ${typeLabel} bei ${aName} anzeigen`
          : `${ownedCount} vorhandene Sammelmodelle vom Typ ${typeLabel} bei ${aName} anzeigen`;
      
      const titleOrdered =
        orderedCount === 1
          ? `1 bestelltes Sammelmodell vom Typ ${typeLabel} bei ${aName} anzeigen`
          : `${orderedCount} bestellte Sammelmodelle vom Typ ${typeLabel} bei ${aName} anzeigen`;

  
      const dots =
        (owned ? `
          <a class="dotLink"
             href="${esc(linkAir)}"
             title="${esc(titleOwned)}">
            <span class="dotCount">
              <span class="dotNum">${esc(ownedCount)}</span>
              <span class="dot dotG"></span>
            </span>
          </a>
        ` : ``) +
        (ord ? `
          <a class="dotLink"
             href="${esc(linkAir)}"
             title="${esc(titleOrdered)}">
            <span class="dotCount">
              <span class="dotNum">${esc(orderedCount)}</span>
              <span class="dot dotY"></span>
            </span>
          </a>
        ` : ``);
  
      html += `
        <tr>
          <td>
            <a href="${esc(linkGroup)}"
               title="${esc(titleGroup)}">
              ${esc(groupName)}
            </a>
          </td>
  
          <td>
            <a href="${esc(linkAir)}"
               title="${esc(titleAir)}">
              ${esc(aName)}
            </a>
          </td>
  
          <td class="colDots">${dots}</td>
        </tr>
      `;
    }
  }
  
  html += `</tbody></table>`;
  return html;
}


let wantScrollAid = "";

document.addEventListener("click", (ev)=>{
  const btn = ev.target.closest("button.toggle");
  if(!btn) return;

  const aid = btn.getAttribute("data-aid") || "";
  if(!aid) return;

  const x = all.find(it => it.aircraft_id === aid);
  if(!x || x.status === "missing") return;

  if(expanded.has(aid)){
    expanded.clear();
    wantScrollAid = ""; // nichts scrollen
  }else{
    expanded.clear();     // nur 1 offen
    expanded.add(aid);
    wantScrollAid = aid;  // nach dem Render dahin scrollen
  }

  apply();

  // Nach dem Render: Zeile ins Sichtfeld scrollen (sanft)
  if(wantScrollAid){
    requestAnimationFrame(() => {
      const tr = document.querySelector(`tr.rowMain[data-aid="${CSS.escape(wantScrollAid)}"]`);
      if(tr) tr.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
});

async function main(){
  const res = await fetch("./data/types_overview.json", {cache:"no-store"});
  data = await res.json();
  all = data.items || [];

  document.getElementById("meta").textContent =
    `${data.master_count || all.length} Typen · fehlend: ${data.missing ?? ""}`;

  buildStaticSelects();
  buildSelect("manu", "Hersteller: alle", (data.filters?.manufacturers || []));

  // events
  document.getElementById("q").addEventListener("input", apply);
  document.getElementById("manu").addEventListener("change", apply);
  document.getElementById("wing").addEventListener("change", apply);
  document.getElementById("sort").addEventListener("change", apply);
  document.getElementById("fMissing").addEventListener("change", apply);
  document.getElementById("fOwned").addEventListener("change", apply);
  document.getElementById("fOrdered").addEventListener("change", apply);

  // Optionale Spalten initialisieren
  const visibleOptionalCols = new Set(getVisibleOptionalColumns());

  document.querySelectorAll(".colToggle").forEach(cb => {
    cb.checked = visibleOptionalCols.has(cb.value);

    cb.addEventListener("change", () => {
      const keys = Array.from(document.querySelectorAll(".colToggle"))
        .filter(x => x.checked)
        .map(x => x.value);

      setVisibleOptionalColumns(keys);
      updateMeasureModeUI();
      apply();
    });
  });

  document.getElementById("selectAllColumns")?.addEventListener("click", () => {
    const keys = OPTIONAL_COLUMNS.map(c => c.key);

    document.querySelectorAll(".colToggle").forEach(cb => {
      cb.checked = true;
    });

    setVisibleOptionalColumns(keys);
    updateMeasureModeUI();
    apply();
  });

  document.getElementById("clearAllColumns")?.addEventListener("click", () => {
    document.querySelectorAll(".colToggle").forEach(cb => {
      cb.checked = false;
    });

    setVisibleOptionalColumns([]);
    updateMeasureModeUI();
    apply();
  });

  document.getElementById("measureOriginal")?.addEventListener("click", () => {
    measureMode = "original";
    localStorage.setItem("typesOverviewMeasureMode", measureMode);
    updateMeasureModeUI();
    apply();
  });

  document.getElementById("measureScale400")?.addEventListener("click", () => {
    measureMode = "scale400";
    localStorage.setItem("typesOverviewMeasureMode", measureMode);
    updateMeasureModeUI();
    apply();
  });

  updateMeasureModeUI();

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
  
  apply();
}

main();
