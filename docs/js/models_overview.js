const state = { all: [], filtered: [], postcards: {} };

let tableSortKey = localStorage.getItem("indexSortKey") || "model_id";     // Default-Spalte
let tableSortDir = Number(localStorage.getItem("indexSortDir") || "1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = 1;            // 1 = asc, -1 = desc

const OPTIONAL_COLUMNS = [
  { key: "shop", label: "Shop" },
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

let measureMode = localStorage.getItem("modelsOverviewMeasureMode") || "scale400";
if(measureMode !== "original" && measureMode !== "scale400"){
  measureMode = "scale400";
}

function getVisibleOptionalColumns(){
  try{
    const raw = localStorage.getItem("modelsOverviewOptionalColumns");
    const arr = JSON.parse(raw || "[]");
    if(!Array.isArray(arr)) return [];
    const allowed = new Set(OPTIONAL_COLUMNS.map(c => c.key));
    return arr.filter(x => allowed.has(x));
  }catch(e){
    return [];
  }
}

function setVisibleOptionalColumns(keys){
  localStorage.setItem("modelsOverviewOptionalColumns", JSON.stringify(keys || []));
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function norm(s){ return String(s ?? "").toLowerCase().trim(); }

function formatDateDE(iso){
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return iso; // fallback
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function parseDateISO(s){
  if(!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

function scaleBadge(scale){
  const s = String(scale ?? "").trim();
  if(!s) return "";
  const isSpecial = (s !== "1:400");
  const cls = isSpecial ? "badge badge-warn mono" : "badge mono";
  return `<span class="${cls}">${esc(s)}</span>`;
}

function buildOptions(items, selectId, keyFn, labelFn){
  const sel = document.getElementById(selectId);
  const map = new Map();
  for(const it of items){
    const key = keyFn(it);
    if(!key) continue;
    if(!map.has(key)) map.set(key, labelFn(it));
  }

  const pairs = Array.from(map.entries()); // [key, label]
  pairs.sort((a,b)=> String(a[1]).localeCompare(String(b[1]))); // nach Label

  for(const [k, label] of pairs){
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = label;
    sel.appendChild(opt);
  }
}

function getGroupValue(it){
  return (it.airline || it.group || it.airline_group || "");
}

function passesFilters(it, filters, excludeKey = ""){
  if(excludeKey !== "q" && !matchesQuery(it, filters.q)) return false;
  if(excludeKey !== "airline" && !matchesAirline(it, filters.airline)) return false;

  const grp = getGroupValue(it);
  if(excludeKey !== "group" && filters.group && grp !== filters.group) return false;

  if(excludeKey !== "type" && !matchesType(it, filters.type)) return false;
  if(excludeKey !== "scale" && !matchesScale(it, filters.scale)) return false;
  if(excludeKey !== "flown" && !matchesFlown(it, filters.flown)) return false;
  if(excludeKey !== "status" && !matchesStatus(it, filters)) return false;

  return true;
}

function refillSelect(selectId, firstLabel, pairs, currentValue){
  const sel = document.getElementById(selectId);
  if(!sel) return;

  sel.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  sel.appendChild(first);

  pairs.forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  });

  const allowed = new Set(pairs.map(([value]) => value));
  if(currentValue && allowed.has(currentValue)){
    sel.value = currentValue;
  }else{
    sel.value = "";
  }
}

function buildFacetOptions(filters){
  // group
  {
    const items = state.all.filter(it => passesFilters(it, filters, "group"));
    const map = new Map();
    for(const it of items){
      const key = getGroupValue(it);
      if(key && !map.has(key)) map.set(key, key);
    }
    const pairs = Array.from(map.entries()).sort((a,b)=> String(a[1]).localeCompare(String(b[1]), "de"));
    refillSelect("group", "Alle Airline-Gruppen", pairs, filters.group);
  }

  // airline
  {
    const items = state.all.filter(it => passesFilters(it, filters, "airline"));
    const map = new Map();
    for(const it of items){
      const key = (it.airline_row || "");
      if(key && !map.has(key)) map.set(key, key);
    }
    const pairs = Array.from(map.entries()).sort((a,b)=> String(a[1]).localeCompare(String(b[1]), "de"));
    refillSelect("airline", "Alle Airlines", pairs, filters.airline);
  }

  // type
  {
    const items = state.all.filter(it => passesFilters(it, filters, "type"));
    const map = new Map();
    for(const it of items){
      const key = (it.aircraft_type || "");
      if(key && !map.has(key)) map.set(key, key);
    }
    const pairs = Array.from(map.entries()).sort((a,b)=> String(a[1]).localeCompare(String(b[1]), "de"));
    refillSelect("type", "Alle Flugzeugtypen", pairs, filters.type);
  }

  // scale
  {
    const items = state.all.filter(it => passesFilters(it, filters, "scale"));
    const map = new Map();
    for(const it of items){
      const key = (it.scale || "");
      if(key && !map.has(key)) map.set(key, key);
    }
    const pairs = Array.from(map.entries()).sort((a,b)=> String(a[1]).localeCompare(String(b[1]), "de"));
    refillSelect("scale", "Alle Maßstäbe", pairs, filters.scale);
  }

  // flown
  {
    const items = state.all.filter(it => passesFilters(it, filters, "flown"));
    const hasTrue = items.some(it => it.flown === true);
    const hasFalse = items.some(it => it.flown === false);

    const pairs = [];
    if(hasTrue) pairs.push(["true", "Mitgeflogen: ja"]);
    if(hasFalse) pairs.push(["false", "Mitgeflogen: nein"]);

    refillSelect("flown", "Mitgeflogen: egal", pairs, filters.flown);
  }
}

function updateActiveFilterUI(filters){
  const map = [
    ["q", "Suche"],
    ["group", "Airline-Gruppe"],
    ["airline", "Airline"],
    ["type", "Flugzeugtyp"],
    ["scale", "Maßstab"],
    ["flown", "Mitgeflogen"]
  ];

  const active = [];

  map.forEach(([key, label]) => {
    const el = document.getElementById(key);
    const on = !!filters[key];
    if(el) el.classList.toggle("is-active", on);
    if(on) active.push(label);
  });

  const defaultStatusOn = filters.owned && filters.ordered && !filters.wishlist;
  document.querySelector(".statusBox")?.classList.toggle("is-active", !defaultStatusOn);
  
  if(!defaultStatusOn){
    active.push("Status");
  }
  
  const box = document.getElementById("activeFilters");
  if(box){
    box.textContent = active.length
      ? `Aktive Filter: ${active.join(", ")}`
      : "Keine Filter aktiv";
  }
}

function normalizeShopKeyForSearch(raw){
  let s = String(raw || "").trim();
  if(!s) return "";

  const looksLikeDomainOrUrl =
    /^https?:\/\//i.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s);

  if(looksLikeDomainOrUrl){
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

  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesQuery(it, q){
  if(!q) return true;
  const hay = [
    it.model_id, it.airline_code, it.airline_row, it.airline,
    it.aircraft_id, it.aircraft_type,
    it.registration, it.livery_name,
    it.livery_display,
    it.arrived,
    it.shop,
    it.shop_url,
    normalizeShopKeyForSearch(it.shop),
    normalizeShopKeyForSearch(it.shop_url),
    (!String(it.shop || it.Shop || "").trim() ? "__shop_missing__" : ""),
    it.ordered ? "bestellt" : "",
    it.ordered_at,
    it.scale,
    (it.flown===true?"mitgeflogen":it.flown===false?"nicht mitgeflogen":"")
  ].map(norm).join(" | ");

  return hay.includes(q);
}

function matchesAirline(it, code){
  if(!code) return true;
  return (it.airline_row || "") === code;
}

function matchesType(it, t){
  if(!t) return true;
  return (it.aircraft_type || "") === t;
}

function matchesScale(it, s){
  if(!s) return true;
  return (it.scale || "") === s;
}

function matchesFlown(it, v){
  if(!v) return true;
  if(v === "true") return it.flown === true;
  if(v === "false") return it.flown === false;
  return true;
}

function matchesStatus(it, filters){
  const s = String(it.status || "").trim().toLowerCase();

  const ownedOn = filters.owned !== false;
  const orderedOn = filters.ordered !== false;
  const wishlistOn = filters.wishlist !== false;

  if(s === "owned") return ownedOn;
  if(s === "ordered") return orderedOn;
  if(s === "wishlist" || it.wishlist === true) return wishlistOn;

  return false;
}

function sortByColumn(items){
  if(!tableSortKey) return items.slice();

  const arr = items.slice();

  arr.sort((a,b)=>{
    let va = a[tableSortKey];
    let vb = b[tableSortKey];

    if(tableSortKey === "airline"){
      va = getGroupValue(a);
      vb = getGroupValue(b);
    }

    if(tableSortKey === "airline_row"){
      va = a.airline_row || a.airline || a.airline_code || "";
      vb = b.airline_row || b.airline || b.airline_code || "";
    }    

    if(tableSortKey === "model_id"){
      const sa = String(a.status || "").toLowerCase();
      const sb = String(b.status || "").toLowerCase();

      if(sa === "wishlist" && sb === "wishlist"){
        const pa = Number(a.wishlist_prio || 9);
        const pb = Number(b.wishlist_prio || 9);

        if(pa !== pb) return (pa - pb) * tableSortDir;
      }
    }

    if(tableSortKey === "wingtip"){
      va = ((a.has_wingtip === true) || ((a.wingtip || "").toUpperCase() && (a.wingtip || "").toUpperCase() !== "NONE")) ? "ja" : "";
      vb = ((b.has_wingtip === true) || ((b.wingtip || "").toUpperCase() && (b.wingtip || "").toUpperCase() !== "NONE")) ? "ja" : "";
    }

    if(tableSortKey === "flown"){
      va = a.flown === true ? 1 : a.flown === false ? 0 : -1;
      vb = b.flown === true ? 1 : b.flown === false ? 0 : -1;
    }

    if(tableSortKey === "arrived"){
      va = parseDateISO(a.arrived)?.getTime() ?? -1;
      vb = parseDateISO(b.arrived)?.getTime() ?? -1;
    }

    if(["engines", "passengers", "first_flight"].includes(tableSortKey)){
      const toNum = (v) => {
        const s = String(v ?? "").replace(",", ".").trim();
        const n = Number(s);
        return Number.isFinite(n) ? n : -1;
      };
      va = toNum(va);
      vb = toNum(vb);
    }
    
    if(MEASURE_COLUMNS.has(tableSortKey)){
      const toMeasureSort = (it) => {
        const val = formatMeasureValue(it, tableSortKey);
        const n = parseDecimalDE(val);
        return n === null ? -1 : n;
      };
    
      va = toMeasureSort(a);
      vb = toMeasureSort(b);
    }

    if(va == null) va = "";
    if(vb == null) vb = "";

    if(typeof va === "string") va = va.toLowerCase();
    if(typeof vb === "string") vb = vb.toLowerCase();

    if(va < vb) return -1 * tableSortDir;
    if(va > vb) return  1 * tableSortDir;

    return (a.model_id || "").localeCompare(b.model_id || "");
  });

  return arr;
}

function getRowStatusClass(it){
  const s = String(it.status || "").toLowerCase();

  if(s === "ordered") return "row-ordered";
  if(s === "wishlist" || it.wishlist === true) return "row-wishlist";

  return "";
}

function getVisualGroupKey(it){
  if(tableSortKey === "airline"){
    return String(getGroupValue(it) || "").trim();
  }

  if(tableSortKey === "airline_row"){
    return String(it.airline_row || it.airline || it.airline_code || "").trim();
  }

  if(tableSortKey === "aircraft_type"){
    return String(it.aircraft_type || "").trim();
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
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getScaleDenominator(scale){
  const m = String(scale || "").match(/1\s*:\s*(\d+)/);
  if(!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatNumberDE(n, digits){
  if(!Number.isFinite(n)) return "";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMeasureValue(it, key){
  const originalM = parseDecimalDE(it[key]);
  if(originalM === null) return "";

  if(measureMode === "original"){
    return formatNumberDE(originalM, 2);
  }

  // 1:400-Modellmaß nur für tatsächliche 1:400-Modelle anzeigen
  const scale = String(it.scale || "").trim();
  if(scale !== "1:400") return "";

  // Original in m -> Modell in cm:
  // m * 100 / 400 = cm
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

function getShopName(it){
  return String(it.shop || it.Shop || "").trim();
}

function getShopUrl(it){
  return String(it.shop_url || it.Shop_url || it.Shop_URL || "").trim();
}

function getModelItem(modelId){
  const id = String(modelId || "").trim();
  if(!id) return null;

  return state.all.find(x => String(x.model_id || "").trim() === id) || null;
}

function getModelPhotoUrl(modelId){
  const it = getModelItem(modelId);
  if(!it) return "";

  return String(
    it.photo_image_url ||
    it.photo_img_url ||
    ""
  ).trim();
}

function getModelPhotoSourceUrl(modelId){
  const it = getModelItem(modelId);
  if(!it) return "";

  return String(
    it.photo_source_url ||
    it.photo ||
    ""
  ).trim();
}

function getPostcardEntriesForModel(modelId){
  const id = String(modelId || "").trim();
  if(!id || !state.postcards || typeof state.postcards !== "object") return [];

  return Object.values(state.postcards).filter(pc => {
    if(!pc || typeof pc !== "object") return false;
    return String(pc.model_id || "").trim() === id;
  });
}

function getPostcardImageUrl(modelId){
  const entries = getPostcardEntriesForModel(modelId);

  for(const pc of entries){
    const url = String(
      pc.thumb_url ||
      pc.image_url ||
      pc.img_url ||
      pc.image ||
      pc.thumbnail_url ||
      ""
    ).trim();

    if(url) return url;
  }

  return "";
}

function getPostcardSourceUrl(modelId){
  const entries = getPostcardEntriesForModel(modelId);

  for(const pc of entries){
    const url = String(
      pc.source_url ||
      pc.url ||
      ""
    ).trim();

    if(url) return url;
  }

  return "";
}

function getBestModelImage(modelId){
  const photoUrl = getModelPhotoUrl(modelId);

  if(photoUrl){
    return {
      kind: "photo",
      image_url: photoUrl,
      source_url: getModelPhotoSourceUrl(modelId),
      label: "Originalfoto"
    };
  }

  const postcardUrl = getPostcardImageUrl(modelId);

  if(postcardUrl){
    return {
      kind: "postcard",
      image_url: postcardUrl,
      source_url: getPostcardSourceUrl(modelId),
      label: "Postkartenbild"
    };
  }

  return null;
}

function hasModelImage(modelId){
  return !!getBestModelImage(modelId);
}

function ensurePhotoOverlay(){
  if(document.getElementById("photoOverlay")) return;

  const html = `
    <div id="photoOverlayBackdrop" class="photoOverlayBackdrop" hidden></div>
    <div id="photoOverlay" class="photoOverlay" hidden>
      <div class="photoOverlayHead">
        <div id="photoOverlayTitle" class="photoOverlayTitle">Foto</div>
        <button type="button" id="photoOverlayClose" class="photoOverlayClose" aria-label="Schließen">×</button>
      </div>
      <div class="photoOverlayBody">
        <img id="photoOverlayImg" alt="Originalflugzeug">
      
        <div class="photoOverlayFooter">
          <div id="photoOverlayModelLink" class="photoOverlayModelLink"></div>
          <div id="photoOverlayMeta" class="photoOverlayMeta"></div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  document.getElementById("photoOverlayClose")?.addEventListener("click", closePhotoOverlay);
  document.getElementById("photoOverlayBackdrop")?.addEventListener("click", closePhotoOverlay);

  document.addEventListener("keydown", (ev) => {
    if(ev.key === "Escape"){
      closePhotoOverlay();
    }
  });
}

function openPhotoOverlay(modelId){
  ensurePhotoOverlay();

  const imgInfo = getBestModelImage(modelId);
  if(!imgInfo?.image_url) return;

  const item = state.all.find(x => String(x.model_id || "") === String(modelId || ""));

  const titleParts = [
    item?.airline_row || item?.airline || "",
    item?.aircraft_type || "",
    item?.registration || ""
  ].filter(Boolean);

  document.getElementById("photoOverlayTitle").textContent =
    titleParts.length
      ? `${imgInfo.label}: ${titleParts.join(" · ")}`
      : imgInfo.label;

  const img = document.getElementById("photoOverlayImg");
  img.src = imgInfo.image_url;
  img.alt = titleParts.length ? titleParts.join(" · ") : imgInfo.label;

  document.getElementById("photoOverlayModelLink").innerHTML =
    modelId
      ? `<a href="./model.html?id=${encodeURIComponent(modelId)}">Zur Modellseite</a>`
      : "";
  
  document.getElementById("photoOverlayMeta").innerHTML = imgInfo.source_url
    ? `<a href="${esc(imgInfo.source_url)}" target="_blank" rel="noopener noreferrer">Quelle öffnen</a>`
    : "";

  document.getElementById("photoOverlayBackdrop").hidden = false;
  document.getElementById("photoOverlay").hidden = false;
  document.body.classList.add("noscroll");
}

function closePhotoOverlay(){
  const img = document.getElementById("photoOverlayImg");
  if(img) img.src = "";

  const modelLink = document.getElementById("photoOverlayModelLink");
  if(modelLink) modelLink.innerHTML = "";

  const meta = document.getElementById("photoOverlayMeta");
  if(meta) meta.innerHTML = "";
  
  const backdrop = document.getElementById("photoOverlayBackdrop");
  const overlay = document.getElementById("photoOverlay");

  if(backdrop) backdrop.hidden = true;
  if(overlay) overlay.hidden = true;

  document.body.classList.remove("noscroll");
}

function render(items){
  document.getElementById("count").textContent = (items.length === 1) ? "1 Modell" : `${items.length} Modelle`;

  if(items.length === 0){
    document.getElementById("content").innerHTML = `<div class="err">Keine Treffer.</div>`;
    return;
  }

  const mark = (key) => {
    if(tableSortKey !== key) return `<span class="sortMark">↕</span>`;
    return `<span class="sortMark active">${tableSortDir === 1 ? "↑" : "↓"}</span>`;
  };

  const thClass = (key, base = "") =>
    (tableSortKey === key ? `${base} thSort active` : `${base} thSort`).trim();

  const visibleOptionalCols = getVisibleOptionalColumns();
  const optionalHeaders = visibleOptionalCols.map(key => {
    const col = OPTIONAL_COLUMNS.find(c => c.key === key);
    if(!col) return "";
  
    const cls = isRightAlignedOptionalColumn(key)
      ? "hide-m optionalNum"
      : "hide-m";
  
    const label = getMeasureColumnLabel(col.label, key);
  
    return `<th class="${thClass(key, cls)}" data-sort="${esc(key)}">${esc(label)} ${mark(key)}</th>`;
  }).join("");
    
  let html = `
    <table>
      <thead>
        <tr>
          <th class="${thClass("model_id")}" data-sort="model_id">Modell-ID ${mark("model_id")}</th>
          <th class="${thClass("airline")}" data-sort="airline">Airline-Gruppe ${mark("airline")}</th>
          <th class="${thClass("airline_row")}" data-sort="airline_row">Airline ${mark("airline_row")}</th>
          <th class="${thClass("scale","hide-m")}" data-sort="scale">Maßstab ${mark("scale")}</th>
          <th class="${thClass("flown","hide-m")}" data-sort="flown">Mitgeflogen ${mark("flown")}</th>
          <th class="${thClass("aircraft_type")}" data-sort="aircraft_type">Flugzeugtyp ${mark("aircraft_type")}</th>
          <th class="${thClass("wingtip")}" data-sort="wingtip">WL/SL ${mark("wingtip")}</th>
          <th class="${thClass("registration","hide-m")}" data-sort="registration">Registrierung ${mark("registration")}</th>
          <th class="${thClass("aircraft_name","hide-m")}" data-sort="aircraft_name">Name ${mark("aircraft_name")}</th>
          <th class="hide-m photoCol">Foto</th>
          <th class="${thClass("livery_display","hide-m")}" data-sort="livery_display">Bemalung ${mark("livery_display")}</th>
          <th class="${thClass("arrived","hide-m")}" data-sort="arrived">Angekommen ${mark("arrived")}</th>
          ${optionalHeaders}
        </tr>
      </thead>
      <tbody>
  `;
  
  let lastVisualGroupKey = null;
  
  for(const it of items){
    const link = `./model.html?id=${encodeURIComponent(it.model_id)}`;
  
    const visualGroupKey = getVisualGroupKey(it);
    const isGroupStart =
      visualGroupKey &&
      lastVisualGroupKey !== null &&
      visualGroupKey !== lastVisualGroupKey;
  
    if(visualGroupKey){
      lastVisualGroupKey = visualGroupKey;
    }

    const optionalCells = visibleOptionalCols.map(key => {
      const cls = isRightAlignedOptionalColumn(key)
        ? "hide-m optionalNum"
        : "hide-m";
    
      if(key === "shop"){
        const shop = getShopName(it);
        const url = getShopUrl(it);
    
        if(!shop) return `<td class="${cls}"></td>`;
    
        if(url){
          return `
            <td class="${cls}">
              <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">
                ${esc(shop)}
              </a>
            </td>
          `;
        }
    
        return `<td class="${cls}">${esc(shop)}</td>`;
      }
    
      const value = MEASURE_COLUMNS.has(key)
        ? formatMeasureValue(it, key)
        : (it[key] || "");
    
      return `<td class="${cls}">${esc(value)}</td>`;
    }).join("");
  
    html += `
      <tr class="modelRow ${getRowStatusClass(it)} ${isGroupStart ? "groupStart" : ""}" data-id="${esc(it.model_id || "")}">
        <td class="mono">
          <a href="./model.html?id=${encodeURIComponent(it.model_id)}" title="Modell anzeigen">
            ${
              (it.status === "wishlist" || it.wishlist === true || (it.model_id || "").startsWith("WIS-"))
                ? `<span class="badge-id wish wish-prio-${esc(it.wishlist_prio || "x")}" title="${esc(it.model_id)}">W${esc(it.wishlist_prio || "")}</span>`
                : (it.model_id || "").startsWith("ORD-")
                  ? `<span class="badge-id ord" title="${esc(it.model_id)}">ORD</span>`
                  : `${esc(it.model_id || "")}`
            }
          </a>
        </td>
        <td>
          <a href="#" data-group="${esc(it.airline || "")}">
            ${esc(it.airline || "")}
          </a>
        </td>
        <td>
          <a href="#" data-airline="${esc(it.airline_row || "")}">
            ${esc(it.airline_row || it.airline || it.airline_code || "")}
          </a>
        </td>
        <td class="hide-m">${scaleBadge(it.scale || "")}</td>
        <td class="mono hide-m">${it.flown === true ? "ja" : it.flown === false ? "nein" : ""}</td>
        <td>
          <a href="#" data-aircraft-id="${esc(it.aircraft_id || "")}" data-type="${esc(it.aircraft_type || "")}">
            ${esc(it.aircraft_type || "")}
          </a>
        </td>
        <td class="mono">
          ${
            (it.has_wingtip === true) || ((it.wingtip || "").toUpperCase() && (it.wingtip || "").toUpperCase() !== "NONE")
              ? `<span class="badge">ja</span>`
              : ""
          }
        </td>
        <td class="mono hide-m">${esc(it.registration || "")}</td>
        <td class="hide-m">${esc(it.aircraft_name || "")}</td>
        <td class="hide-m photoCol">
          ${
            hasModelImage(it.model_id)
              ? `<button type="button" class="photoBtn" data-photo-model-id="${esc(it.model_id)}" title="Foto anzeigen">📷</button>`
              : ""
          }
        </td>
        <td class="hide-m">${esc(it.livery_display || it.livery_name || "")}</td>
        <td class="mono hide-m">
          ${esc(formatDateDE(it.arrived || ""))}
          ${
            it.ordered === true && !it.arrived
              ? ` <span class="badge badge-ordered">bestellt${it.ordered_at ? " " + esc(formatDateDE(it.ordered_at)) : ""}</span>`
              : ""
          }
        </td>
        ${optionalCells}
      </tr>
    `;
  }

  html += `</tbody></table>`;
  document.getElementById("content").innerHTML = html;

  document.querySelectorAll("#content .modelRow").forEach(tr => {
    tr.addEventListener("click", (e) => {
      if(e.target.closest("a")) return; // Links normal lassen
      const id = tr.getAttribute("data-id");
      if(id) location.href = `./model.html?id=${encodeURIComponent(id)}`;
    });
  });

  document.querySelectorAll("#content .photoBtn").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
  
      const modelId = btn.getAttribute("data-photo-model-id") || "";
      openPhotoOverlay(modelId);
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
  
      localStorage.setItem("indexSortKey", tableSortKey);
      localStorage.setItem("indexSortDir", String(tableSortDir));
  
      apply();
    });
  });
}

function apply(){
  const filters = {
    q: norm(document.getElementById("q").value),
    group: document.getElementById("group").value,
    airline: document.getElementById("airline").value,
    type: document.getElementById("type").value,
    scale: document.getElementById("scale").value,
    flown: document.getElementById("flown").value,
    owned: document.getElementById("fOwned")?.checked ?? true,
    ordered: document.getElementById("fOrdered")?.checked ?? true,
    wishlist: document.getElementById("fWishlist")?.checked ?? true
  };

  buildFacetOptions(filters);
  updateActiveFilterUI(filters);

  let items = state.all.filter(it => passesFilters(it, filters));
  items = sortByColumn(items);

  state.filtered = items;
  render(items);
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
    // nicht ziehen, wenn auf Button geklickt wird
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

function setSelectValueFromUrl(id, value){
  const sel = document.getElementById(id);
  if(!sel || value == null || value === "") return;

  const exists = Array.from(sel.options).some(opt => opt.value === value);

  if(!exists){
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    sel.appendChild(opt);
  }

  sel.value = value;
}

async function main(){
  try{
    const res = await fetch("./index.json", {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.all = data.items || [];

    try{
      const pcRes = await fetch("./data/postcards_enriched.json", {cache:"no-store"});
      if(pcRes.ok){
        state.postcards = await pcRes.json();
      }
    }catch(e){
      state.postcards = {};
    }    
    
    const collectionCount = state.all.filter(it => {
      const s = String(it.status || "").toLowerCase();
      return s === "owned" || s === "ordered";
    }).length;
    
    document.getElementById("meta").innerHTML =
      `<span class="mono">${esc(formatStandDE(data.generated_at || ""))}</span>` +
      ` · Anzahl: <span class="mono">${esc(collectionCount)}</span>`;
    
    document.getElementById("q").addEventListener("input", apply);
    document.getElementById("group").addEventListener("change", apply);
    document.getElementById("airline").addEventListener("change", apply);
    document.getElementById("type").addEventListener("change", apply);
    document.getElementById("scale").addEventListener("change", apply);
    document.getElementById("flown").addEventListener("change", apply);
    document.getElementById("fOwned")?.addEventListener("change", apply);
    document.getElementById("fOrdered")?.addEventListener("change", apply);
    document.getElementById("fWishlist")?.addEventListener("change", apply);

    // Optionale Spalten initialisieren und speichern
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
      localStorage.setItem("modelsOverviewMeasureMode", measureMode);
      updateMeasureModeUI();
      apply();
    });
    
    document.getElementById("measureScale400")?.addEventListener("click", () => {
      measureMode = "scale400";
      localStorage.setItem("modelsOverviewMeasureMode", measureMode);
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
    
    document.getElementById("reset").addEventListener("click", () => {
      document.getElementById("q").value = "";
      document.getElementById("group").value = "";
      document.getElementById("airline").value = "";
      document.getElementById("type").value = "";
      document.getElementById("scale").value = "";
      document.getElementById("flown").value = "";
      if(document.getElementById("fOwned")) document.getElementById("fOwned").checked = true;
      if(document.getElementById("fOrdered")) document.getElementById("fOrdered").checked = true;
      if(document.getElementById("fWishlist")) document.getElementById("fWishlist").checked = false;
      
      tableSortKey = "model_id";
      tableSortDir = 1;
      localStorage.removeItem("indexSortKey");
      localStorage.removeItem("indexSortDir");
      
      apply();

      // URL bereinigen (Query-Parameter entfernen)
      history.replaceState(null, "", location.pathname);
    });

    // =========================
    // URL-Parameter -> Filter setzen (Matrix / Mobile Links)
    // =========================
    const p = new URLSearchParams(location.search);
    
    if(p.has("status")){
      const statuses = String(p.get("status") || "")
        .split(",")
        .map(x => x.trim().toLowerCase())
        .filter(Boolean);
    
      const hasOwned = statuses.includes("owned");
      const hasOrdered = statuses.includes("ordered");
      const hasWishlist = statuses.includes("wishlist");
    
      if(document.getElementById("fOwned")) document.getElementById("fOwned").checked = hasOwned;
      if(document.getElementById("fOrdered")) document.getElementById("fOrdered").checked = hasOrdered;
      if(document.getElementById("fWishlist")) document.getElementById("fWishlist").checked = hasWishlist;
    }
    
    if (p.has("q")) {
      document.getElementById("q").value = p.get("q") || "";
    }
    if (p.has("aircraft_id")) {
      // aircraft_id hat Priorität: wir setzen den Typ-Filter NICHT,
      // sondern nutzen die Suche (matchesQuery enthält aircraft_id bereits)
      document.getElementById("q").value = p.get("aircraft_id") || "";
    }

    if(p.has("group")){
      setSelectValueFromUrl("group", p.get("group") || "");
    }
    
    if(p.has("airline")){
      setSelectValueFromUrl("airline", p.get("airline") || "");
    }
    
    if(p.has("type")){
      setSelectValueFromUrl("type", p.get("type") || "");
    }
    
    if(p.has("scale")){
      setSelectValueFromUrl("scale", p.get("scale") || "");
    }
    
    if(p.has("flown")){
      setSelectValueFromUrl("flown", p.get("flown") || "");
    }

    if(p.has("sort")){
      const sort = p.get("sort") || "";
      const allowedSorts = new Set([
        "model_id",
        "airline",
        "airline_row",
        "scale",
        "flown",
        "aircraft_type",
        "wingtip",
        "registration",
        "aircraft_name",
        "livery_display",
        "arrived"
      ]);
    
      if(allowedSorts.has(sort)){
        tableSortKey = sort;
        tableSortDir = 1;
        localStorage.setItem("indexSortKey", tableSortKey);
        localStorage.setItem("indexSortDir", String(tableSortDir));
      }
    }

    apply();

  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">docs/index.json</span> nicht laden. (${esc(e.message)})</div>`;
    document.getElementById("meta").textContent = "";
  }
}

document.addEventListener("click", (ev) => {
  const a = ev.target.closest("a[data-airline], a[data-type], a[data-group], a[data-aircraft-id]");
  if(!a) return;

  ev.preventDefault();

  const aid = a.getAttribute("data-aircraft-id");
  const airline = a.getAttribute("data-airline");
  const type = a.getAttribute("data-type");
  const group = a.getAttribute("data-group");

  // "Fresh" start: alle Filter zurücksetzen
  document.getElementById("q").value = "";
  document.getElementById("group").value = "";
  document.getElementById("airline").value = "";
  document.getElementById("type").value = "";
  document.getElementById("scale").value = "";
  document.getElementById("flown").value = "";
  if(document.getElementById("fOwned")) document.getElementById("fOwned").checked = true;
  if(document.getElementById("fOrdered")) document.getElementById("fOrdered").checked = true;
  if(document.getElementById("fWishlist")) document.getElementById("fWishlist").checked = false;
  
  // sort NICHT zwingend resetten – wenn du willst, nächste Zeile aktivieren:
  // document.getElementById("sort").value = "group_model";

  // Nur den geklickten Filter setzen
  if(group !== null){
    document.getElementById("group").value = group;
  }
  if(airline !== null){
    document.getElementById("airline").value = airline;
  }
  if(aid){
    document.getElementById("q").value = aid;   // aircraft_id als Suchfilter
    document.getElementById("type").value = ""; // Typ-Text bewusst leeren
  }

  if(!aid && type !== null){
    document.getElementById("type").value = type;
  }

  apply();
});

main();
