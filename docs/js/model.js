function boolDE(v){
  const s = asText(v).toLowerCase();
  return (s === "wahr" || s === "true" || s === "1" || s === "ja" || s === "yes" || s === "x");
}

function getLogoSpeaking(d){
  // robust: Feld kann oben oder unter d.logo liegen
  const raw =
    asText(d?.logo_speaking) ||
    asText(d?.logo?.logo_speaking) ||
    asText(d?.logo?.speaking) ||
    asText(d?.logoSpeaking);

  return raw; // string (kann leer sein)
}

function logoSrc(d){
  if(!d || !d.logo) return "";

  const link = String(d.logo.link || "").trim();
  if(/^https?:\/\//i.test(link)) return link;

  // optional: lokale Logos (falls du sie später ablegst)
  const id = String(d.logo.id || "").trim();
  if(id) return `./assets/logos/${encodeURIComponent(id)}.png`;

  return "";
}

function hostFromUrl(u){
  const s = String(u || "").trim();
  if(!s) return "";
  try { return (new URL(s)).hostname.replace(/^www\./,""); }
  catch(e){ return ""; }
}

function hostLabel(u){
  const s = String(u || "").trim();
  if(!s) return "";
  try{
    return new URL(s).hostname.replace(/^www\./,"");
  }catch(e){
    return "Foto";
  }
}

function photoCopyright(credit, sourceUrl, imageUrl){
  const c = String(credit || "").trim();
  const host = hostFromUrl(sourceUrl) || hostFromUrl(imageUrl);
  if(c && host) return `© ${c} / ${host}`;
  if(c) return `© ${c}`;
  if(host) return host;
  return "";
}

function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function firstNonEmpty(...vals){
  for(const v of vals){
    if(v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function rowFixed(label, value){
  const v = String(value ?? "").trim();
  // immer rendern, damit die Reihenfolge stabil bleibt
  return rowHtml(label, `<span style="opacity:${v ? "1" : ".55"}">${esc(v || "—")}</span>`);
}

function renderPostcardsCard(d, enrichedById){
  const enrich = enrichedById && typeof enrichedById === "object" ? enrichedById : {};
  const arr = Array.isArray(d?.postcards) ? d.postcards : [];
  if(!arr.length) return "";

  const rows = arr.map((pc, idx) => {
    const label = String(pc?.label ?? "").trim();
    const url   = String(pc?.url ?? "").trim();
    const price = pc?.price;

    const pcId = String(pc?.id ?? "").trim();
    const e = pcId ? (enrich[pcId] || null) : null;

    // thumbnail
    const thumbUrl = e && e.thumb_url ? String(e.thumb_url).trim() : "";
    const thumbHtml = thumbUrl
      ? `<a class="pc-thumb" href="${esc(url || thumbUrl)}" target="_blank" rel="noopener">
           <img src="${esc(thumbUrl)}" alt="Postkarte Thumbnail" loading="lazy">
         </a>`
      : "";

    let linkLabel = "Link";
    if(url){
      try{ linkLabel = (new URL(url)).hostname.replace(/^www\./, ""); }catch(err){ linkLabel = "Link"; }
    }

    const head = "";

    // Enrichment-Daten
    const publisher = e?.publisher_norm || e?.publisher || "";
    const sizeTxt = fmtSizeMm(e?.size_mm) || (e?.size || "");
    
    // fixe Reihenfolge
    const publisherRow = rowFixed("Herausgeber", publisher);
    const sizeRow      = rowFixed("Grösse", sizeTxt);
    
    const priceRow = rowFixed(
      "Preis",
      (price !== null && price !== undefined && Number(price) > 0)
        ? money(price)
        : ""
    );
    
    const labelRow = rowFixed("Info", label);
    
    return `
      <div class="pc-subcard">
        <div class="pc-row">
          ${thumbHtml}
          <div class="pc-body">
            <div class="grid">
              ${head}
              ${publisherRow}
              ${sizeRow}
              ${priceRow}
              ${labelRow}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Total: -> hier sicher deaktiviert
  const totalRow = "";
  const title = arr.length > 1 ? "Postkarten" : "Postkarte";
  
  return `
    <div class="card">
      <div class="k">${title}</div>
      <div style="margin-top:10px">
        ${rows}
        ${totalRow}
      </div>
    </div>
  `;
}

function scaleBadge(scale){
  const s = String(scale ?? "").trim();
  if(!s) return "";
  const isSpecial = (s !== "1:400");
  const cls = isSpecial ? "badge badge-warn mono" : "badge mono";
  return `<span class="${cls}">${esc(s)}</span>`;
}

function rowHtml(k, vHtml){
  if(vHtml === undefined || vHtml === null || vHtml === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${vHtml}</div></div>`;
}

function row(k,v){
  if(v === undefined || v === null || v === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function prettyHost(url){
  try{
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  }catch(e){
    return "";
  }
}

function linkText(url, preferred, fallback){
  const p = asText(preferred);
  if(p) return p;
  const h = prettyHost(url);
  if(h) return h;
  return fallback || "Link";
}

function aLink(url, preferredText, fallbackText){
  const u = asText(url);
  if(!u) return "";
  const t = linkText(u, preferredText, fallbackText);
  return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
}

function rowLink(label, url, preferredText, fallbackText){
  const h = aLink(url, preferredText, fallbackText);
  return h ? rowHtml(label, h) : "";
}

function linkRow(k, url){
  if(!url) return "";
  const safe = esc(url);
  return `<div><div class="k">${esc(k)}</div><div class="v"><a href="${safe}" target="_blank" rel="noopener">${safe}</a></div></div>`;
}

function formatDateDE(iso){
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

// Globale Währungs-Konfiguration
const CURRENCY = { symbol: "€", position: "before", space: true };

function money(v){
  // Fallback, falls CURRENCY aus irgendeinem Grund nicht global verfügbar ist
  const CUR = (typeof CURRENCY !== "undefined" && CURRENCY)
    ? CURRENCY
    : { symbol: "€", position: "before", space: true };

  if(v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v);

  const amount = n.toFixed(2).replace(".", ",");
  const sp = CUR.space ? " " : "";

  return CUR.position === "before"
    ? `${CUR.symbol}${sp}${amount}`
    : `${amount}${sp}${CUR.symbol}`;
}

function boolBadge(v){
  if(v === true) return "ja";
  if(v === false) return "nein";
  return "";
}

function asText(v){
  return (v ?? "").toString().trim();
}

function renderV8Groups(obj){
  if(!obj || typeof obj !== "object") return "";

  function normListHtml(v){
    const s = String(v ?? "").trim();
    if(!s) return "";
    return s
      .split(/[|,]/g)
      .map(x => x.trim())
      .filter(Boolean)
      .join("<br>");
  }

  function translateWingtip(v){
    const x = String(v ?? "").trim().toUpperCase();
    const map = { "NONE":"Keine", "SL":"Sharklets", "WL":"Winglets", "RW":"Raked Wingtips" };
    return map[x] ? `${map[x]} (${x})` : esc(v);
  }

  function translateRumpf(v){
    const x = String(v ?? "").trim();
    const map = { "SingleAisle":"Schmalrumpf (Single Aisle)", "TwinAisle":"Großraum (Twin Aisle)" };
    return map[x] || esc(x);
  }

  function translateRole(v){
    const x = String(v ?? "").trim().toUpperCase();
    const map = { "PAX":"Passagierflugzeug (PAX)", "CARGO":"Frachtflugzeug (Cargo)" };
    return map[x] || esc(v);
  }

  function cellWiki(url){
    const u = String(url ?? "").trim();
    if(!u) return "";
    const safe = esc(u);
    // schöner Linktext statt URL
    return `<a href="${safe}" target="_blank" rel="noopener">Wikipedia</a>`;
  }

  function row(label, valueHtml){
    if(!valueHtml) return "";
    return `<tr><td>${esc(label)}</td><td>${valueHtml}</td></tr>`;
  }

  function normalizeUnit(label, valueHtml){
    const rawLabel = String(label ?? "").trim();
    const rawValue = String(valueHtml ?? "").trim();
    if(!rawLabel || !rawValue) return [rawLabel, rawValue];
  
    const m = rawLabel.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if(!m) return [rawLabel, rawValue];
  
    const cleanLabel = m[1].trim();
    const unit = m[2].trim();
  
    return [cleanLabel, `${rawValue} ${esc(unit)}`];
  }  
  
  function val(key){
    const v = obj[key];
    if(v === undefined || v === null) return "";
    const s = String(v).trim();
    return s ? esc(s) : "";
  }

  // --- Gruppen ---
  const groups = [
    {
      title: "Codes",
      rows: [
        ["ICAO-Typcode", val("ICAO")],
        ["IATA-Typcode", val("IATA")],
        ["Wikipedia", cellWiki(obj["Wiki"])],
      ]
    },
    {
      title: "Betrieb",
      rows: [
        ["Rolle", translateRole(obj["Role"])],
        ["Segment", val("MarketSegment")],
        ["Rumpf (Kategorie)", translateRumpf(obj["Rumpf"])],
        ["Wingtip / Winglets / Sharklets", translateWingtip(obj["Wingtip"])],
        ["Erstflug", val("Erstflug")],
        ["Status", val("Status")],
        ["Antrieb", val("Antrieb")],
        ["Triebwerke", val("Triebwerke")],
        ["Reichweite (Kategorie)", val("Reichweite")],
        ["Passagiere", val("Passengers")],
      ]
    },
    {
      title: "Abmessungen",
      rows: [
        ["Länge (m)", val("Length")],
        ["Spannweite (m)", val("Wingspan")],
        ["Höhe (m)", val("Height")],
      ]
    },
    {
      title: "Typ",
      rows: [
        ["Flugzeugtyp", val("Typ_anzeige")],
        ["Hersteller", val("Hersteller")],
        ["Baureihe", val("Baureihe")],
        ["Unterserie", val("Unterserie")],
        ["Marketingname", val("Marketingname")],
        ["Alternative Bezeichnungen", normListHtml(obj["Alternate_designations"])],
        ["Übergeordneter Typ (ID)", val("parent_aircraft_id")],
      ]
    }
  ];

  const rendered = groups
    .map(g => {
      const body = g.rows
        .map(([label, value]) => {
          const [nl, nv] = normalizeUnit(label, value);
          return row(nl, nv);
        })
        .filter(Boolean)
        .join("");
      if(!body) return "";
      return `
        <div class="card">
          <div class="k">${esc(g.title)}</div>
          <div class="v" style="margin-top:8px">
            <table>${body}</table>
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  return rendered ? `<div class="masonry">${rendered}</div>` : "";
}

function extractFirstHttpUrl(text){
  const s = String(text ?? "").trim();
  if(!s) return { prefix: "", url: "" };

  const m = s.match(/https?:\/\/\S+/i);
  if(!m) return { prefix: s, url: "" };

  const url = m[0];
  const prefix = s.replace(url, "").trim().replace(/[;,:]$/, "").trim();
  return { prefix, url };
}

function linkOrTextRow(label, raw){
  const s = String(raw ?? "").trim();
  if(!s) return "";

  const { prefix, url } = extractFirstHttpUrl(s);

  if(!url){
    // kein http -> reiner Text
    return row(label, s);
  }

  // schöner Linktext statt voller URL
  let linkLabel = "Link";
  try{
    const u = new URL(url);
    linkLabel = u.hostname.replace(/^www\./, "");
  }catch(e){
    linkLabel = "Link";
  }

  const prefixHtml = prefix ? `${esc(prefix)}<br>` : "";
  return rowHtml(
    label,
    `${prefixHtml}<a href="${esc(url)}" target="_blank" rel="noopener">${esc(linkLabel)}</a>`
  );
}

// --- Postcards enrichment (lazy) ---
let _postcardsEnrichedCache = null; // null=not loaded, {}=loaded/empty

async function loadPostcardsEnriched(){
  if(_postcardsEnrichedCache !== null) return _postcardsEnrichedCache;

  try{
    const res = await fetch("data/postcards_enriched.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    _postcardsEnrichedCache = (j && typeof j === "object") ? j : {};
  }catch(e){
    _postcardsEnrichedCache = {};
  }
  return _postcardsEnrichedCache;
}

function fmtSizeMm(mm){
  if(!mm || typeof mm !== "object") return "";
  const w = Number(mm.w), h = Number(mm.h);
  if(!Number.isFinite(w) || !Number.isFinite(h)) return "";
  return `${w}×${h} mm`;
}

// --- Aircraft photo enrichment (lazy) ---
let _aircraftPhotosEnrichedCache = null;

async function loadAircraftPhotosEnriched(){
  if(_aircraftPhotosEnrichedCache !== null) return _aircraftPhotosEnrichedCache;
  try{
    const res = await fetch("data/aircraft_photos_enriched.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    _aircraftPhotosEnrichedCache = (j && typeof j === "object") ? j : {};
  }catch(e){
    _aircraftPhotosEnrichedCache = {};
  }
  return _aircraftPhotosEnrichedCache;
}

// ---------- Lightbox ----------
function ensureLightbox(){
  if(document.getElementById("lightbox")) return;

  const el = document.createElement("div");
  el.id = "lightbox";
  el.className = "lb";
  el.innerHTML = `
    <div class="lb-backdrop" data-close="1"></div>
    <div class="lb-panel" role="dialog" aria-modal="true">
      <button class="lb-close" type="button" aria-label="Schließen" data-close="1">×</button>
      <img class="lb-img" alt="Foto" />
      <div class="lb-actions">
        <a class="lb-open" href="#" target="_blank" rel="noopener">In neuem Tab öffnen</a>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  // click close
  el.addEventListener("click", (ev) => {
    const t = ev.target;
    if(t && t.getAttribute && t.getAttribute("data-close") === "1"){
      closeLightbox();
    }
  });

  // ESC close
  document.addEventListener("keydown", (ev) => {
    if(ev.key === "Escape") closeLightbox();
  });
}

function openLightbox(imgUrl, openUrl){
  const src = String(imgUrl || "").trim();
  if(!src) return;
  ensureLightbox();

  const lb = document.getElementById("lightbox");
  const img = lb.querySelector(".lb-img");
  const a = lb.querySelector(".lb-open");

  img.src = src;
  a.href = (String(openUrl || "").trim() || src);

  lb.classList.add("on");
  document.body.classList.add("noscroll");
}

function closeLightbox(){
  const lb = document.getElementById("lightbox");
  if(!lb) return;
  lb.classList.remove("on");
  document.body.classList.remove("noscroll");

  const img = lb.querySelector(".lb-img");
  if(img) img.src = "";
}

async function loadIndexIds(){
  const res = await fetch("./index.json", {cache:"no-store"});
  if(!res.ok) throw new Error(`index.json HTTP ${res.status}`);
  const j = await res.json();

  // try known shapes in priority order
  let items = [];
  if(Array.isArray(j)){
    items = j;
  }else if(Array.isArray(j?.items)){
    items = j.items;
  }else if(Array.isArray(j?.index)){
    items = j.index;
  }else if(Array.isArray(j?.models)){
    items = j.models;
  }else{
    // last resort: find first array-valued property
    for(const k of Object.keys(j || {})){
      if(Array.isArray(j[k])) { items = j[k]; break; }
    }
  }

  // extract model_id in the SAME ORDER as in index.json
  const ids = [];
  for(const it of items){
    const id = String(it?.model_id ?? it?.id ?? "").trim();
    if(id) ids.push(id);
  }
  return ids; // keep order, no sorting, no de-dup (index should already be clean)
}

function navNeighbors(ids, currentId){
  const cur = String(currentId || "").trim().toUpperCase();
  const i = ids.findIndex(x => String(x || "").trim().toUpperCase() === cur);

  if(i < 0) return { prev: "", next: "", pos: 0, total: ids.length };

  return {
    prev: i > 0 ? ids[i-1] : "",
    next: i < ids.length-1 ? ids[i+1] : "",
    pos: i + 1,
    total: ids.length
  };
}

function buildNavHtml(prevId, nextId, pos, total){
  const prevHref = prevId ? `model.html?id=${encodeURIComponent(prevId)}` : "";
  const nextHref = nextId ? `model.html?id=${encodeURIComponent(nextId)}` : "";

  return `
    <div class="navWrap">
      <a class="navBtn ${prevId ? "" : "disabled"}" ${prevId ? `href="${prevHref}"` : ""} title="Vorheriges Modell">←</a>
      <div class="navPos">${total ? `${pos}/${total}` : ""}</div>
      <a class="navBtn ${nextId ? "" : "disabled"}" ${nextId ? `href="${nextHref}"` : ""} title="Nächstes Modell">→</a>
    </div>
  `;
}

function enableArrowKeys(prevId, nextId){
  document.addEventListener("keydown", (ev) => {
    // ignore when typing in inputs (future-proof)
    const t = ev.target;
    const tag = (t && t.tagName) ? t.tagName.toLowerCase() : "";
    if(tag === "input" || tag === "textarea" || tag === "select") return;

    if(ev.key === "ArrowLeft" && prevId){
      window.location.href = `model.html?id=${encodeURIComponent(prevId)}`;
    }else if(ev.key === "ArrowRight" && nextId){
      window.location.href = `model.html?id=${encodeURIComponent(nextId)}`;
    }
  });
}

// --- Aircraft families compare (lazy) ---
let _aircraftFamiliesCache = null;

async function loadAircraftFamilies(){
  if(_aircraftFamiliesCache !== null) return _aircraftFamiliesCache;

  try{
    const res = await fetch("data/aircraft_families.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    _aircraftFamiliesCache = (j && typeof j === "object") ? j : {};
  }catch(e){
    _aircraftFamiliesCache = {};
  }
  return _aircraftFamiliesCache;
}

function fmtDim(v){
  const n = Number(v);
  if(!Number.isFinite(n)) return "—";
  return `${String(v).replace(".", ",")} m`;
}

function cmpClass(val, cur){
  if(val === null || val === undefined || cur === null || cur === undefined) return "";
  const a = Number(val), b = Number(cur);
  if(!Number.isFinite(a) || !Number.isFinite(b)) return "";
  return a === b ? "famCmp-same" : "famCmp-diff";
}

function ensureFamilyCompareModal(){
  if(document.getElementById("familyCompareModal")) return;

  const el = document.createElement("div");
  el.id = "familyCompareModal";
  el.className = "famCmpModal";
  el.innerHTML = `
    <div class="famCmpBackdrop" data-close="1"></div>
    <div class="famCmpPanel" role="dialog" aria-modal="true">
      <div class="famCmpHead">
        <div class="famCmpTitle" id="familyCompareTitle">Baureihenvergleich</div>
        <div class="famCmpHeadRight">
          <div class="famCmpToggle" id="familyCompareToggle" role="tablist" aria-label="Maßstab umschalten"></div>
          <button class="famCmpClose" type="button" data-close="1" aria-label="Schließen">×</button>
        </div>
      </div>
      <div class="famCmpBody" id="familyCompareBody"></div>
    </div>
  `;
  document.body.appendChild(el);

  el.addEventListener("click", (ev) => {
    const t = ev.target;
    if(t && t.getAttribute && t.getAttribute("data-close") === "1"){
      closeFamilyCompare();
    }
  });

  document.addEventListener("keydown", (ev) => {
    if(ev.key === "Escape") closeFamilyCompare();
  });
}

function scaleDim(value, mode){
  const n = Number(value);
  if(!Number.isFinite(n)) return "—";

  if(mode === "model400"){
    const cm = n * 100 / 400;
    return `${cm.toFixed(1).replace(".", ",")} cm`;
  }

  return `${n.toFixed(2).replace(".", ",")} m`;
}

function statusSymbol(status){
  const s = String(status || "").trim();
  if(s === "owned") return "✓";
  if(s === "ordered") return "◷";
  if(s === "wish") return "★";
  return "x";
}

function statusBadge(status){
  const s = String(status || "").trim();
  const label = statusLabel(s);
  return `<span class="famStatus famStatus-${esc(s || "missing")}">${esc(label)}</span>`;
}

function statusRowClass(status){
  const s = String(status || "").trim();
  if(s === "owned") return "famRow-owned";
  if(s === "ordered") return "famRow-ordered";
  if(s === "wish") return "famRow-wish";
  return "famRow-missing";
}

function dimCellClass(val, cur, mode){
  if(val === null || val === undefined || cur === null || cur === undefined) return "";

  const a = Number(val);
  const b = Number(cur);
  if(!Number.isFinite(a) || !Number.isFinite(b)) return "";

  // Originalflugzeug: direkter Vergleich in Metern
  if(mode !== "model400"){
    return a === b ? "famCmp-same" : "famCmp-diff";
  }

  // Modell 1:400: Vergleich nach Umrechnung in cm und Rundung auf 1 Nachkommastelle
  const acm = Math.round((a * 100 / 400) * 10) / 10;
  const bcm = Math.round((b * 100 / 400) * 10) / 10;

  return acm === bcm ? "famCmp-same" : "famCmp-diff";
}

function closeFamilyCompare(){
  const el = document.getElementById("familyCompareModal");
  if(!el) return;
  el.classList.remove("on");
  document.body.classList.remove("noscroll");
}

function statusRank(status){
  const s = String(status || "").trim();
  if(s === "owned") return 4;
  if(s === "ordered") return 3;
  if(s === "wish") return 2;
  return 1;
}

function sortFamilyCompareTable(key){
  const table = document.querySelector(".famCmpTable");
  if(!table) return;

  const tbody = table.querySelector("tbody");
  if(!tbody) return;

  const currentKey = table.getAttribute("data-sort-key") || "";
  const currentDir = table.getAttribute("data-sort-dir") || "asc";
  const nextDir = (currentKey === key && currentDir === "asc") ? "desc" : "asc";

  const rows = Array.from(tbody.querySelectorAll("tr"));

  rows.sort((a, b) => {
    let av = a.getAttribute(`data-${key}`) || "";
    let bv = b.getAttribute(`data-${key}`) || "";

    let cmp = 0;

    if(key === "length" || key === "wingspan" || key === "height"){
      const an = Number(av), bn = Number(bv);
      cmp = (Number.isFinite(an) ? an : -999999) - (Number.isFinite(bn) ? bn : -999999);
    }else if(key === "status"){
      cmp = statusRank(av) - statusRank(bv);
    }else{
      cmp = av.localeCompare(bv, "de", { sensitivity: "base", numeric: true });
    }

    return nextDir === "asc" ? cmp : -cmp;
  });

  rows.forEach(r => tbody.appendChild(r));

  table.setAttribute("data-sort-key", key);
  table.setAttribute("data-sort-dir", nextDir);

  table.querySelectorAll("th[data-sort]").forEach(th => {
    const thKey = th.getAttribute("data-sort");
    th.classList.toggle("sort-active", thKey === key);
    th.classList.toggle("sort-desc", thKey === key && nextDir === "desc");
  });
}

async function openFamilyCompare(baureihe, currentAircraftId){
  const familyName = String(baureihe || "").trim();
  const currentId = String(currentAircraftId || "").trim();
  if(!familyName) return;

  ensureFamilyCompareModal();

  const data = await loadAircraftFamilies();
  const fams = data?.families || {};
  const rows = Array.isArray(fams[familyName]) ? fams[familyName] : [];
  const hasParent = rows.some(r => r.parent_type && String(r.parent_type).trim() !== "");
  const familyManufacturer = rows.length ? String(rows[0].manufacturer || "").trim() : "";
  const familyTitle = familyManufacturer ? `${familyManufacturer} ${familyName}` : familyName;
  const modalTitle = `Baureihenvergleich - ${familyTitle}`;
  const titleEl = document.getElementById("familyCompareTitle");
  if(titleEl) titleEl.textContent = modalTitle;
  
  const toggleEl = document.getElementById("familyCompareToggle");
  if(toggleEl){
    toggleEl.innerHTML = `
      <button type="button" class="famModeBtn is-on" data-fam-mode="original">Original</button>
      <button type="button" class="famModeBtn" data-fam-mode="model400">1:400</button>
    `;
  }
  
  const body = document.getElementById("familyCompareBody");
  if(!body) return;

  if(!rows.length){
    body.innerHTML = `<div class="muted">Keine Daten für diese Baureihe vorhanden.</div>`;
  }else{
    const cur = rows.find(r => String(r.aircraft_id || "").trim() === currentId) || null;
    const curLen = cur?.length ?? null;
    const curSpan = cur?.wingspan ?? null;
    const curHeight = cur?.height ?? null;

    const htmlRows = rows.map(r => {
      const isCurrent = String(r.aircraft_id || "").trim() === currentId;
      const status = String(r.status || "missing").trim();

      return `
        <tr class="${isCurrent ? "famCmp-current " : ""}${statusRowClass(status)}"
            data-aircraft-id="${esc(String(r.aircraft_id || ""))}"
            data-status="${esc(status)}"
            data-type="${esc(String(r.type || ""))}"
            data-parent_type="${esc(String(r.parent_type || ""))}"
            data-length="${esc(String(r.length ?? ""))}"
            data-wingspan="${esc(String(r.wingspan ?? ""))}"
            data-height="${esc(String(r.height ?? ""))}"
            data-wingtip="${esc(String(r.wingtip || ""))}">
          <td>${esc(String(r.type || ""))}</td>
          ${hasParent ? `<td class="famParent">${r.parent_type ? esc(String(r.parent_type)) : ""}</td>` : ``}
          <td class="num famDimCell" data-dim="length" data-raw="${esc(String(r.length ?? ""))}" data-cur="${esc(String(curLen ?? ""))}"><span class="famNowrap"></span></td>
          <td class="num famDimCell" data-dim="wingspan" data-raw="${esc(String(r.wingspan ?? ""))}" data-cur="${esc(String(curSpan ?? ""))}"><span class="famNowrap"></span></td>
          <td class="num famDimCell" data-dim="height" data-raw="${esc(String(r.height ?? ""))}" data-cur="${esc(String(curHeight ?? ""))}"><span class="famNowrap"></span></td>
          <td class="num">${String(r.wingtip || "").trim().toUpperCase() === "NONE" ? "" : esc(String(r.wingtip || ""))}</td>
          <td class="num famModelMark">${esc(statusSymbol(status))}</td>
        </tr>
      `;
    }).join("");

    body.innerHTML = `
      <table class="famCmpTable" data-sort-key="length" data-sort-dir="asc">
        <thead>
          <tr>
            <th data-sort="type">Typ</th>
            ${hasParent ? `<th class="famParent" data-sort="parent_type">Basis</th>` : ``}
            <th class="num" data-sort="length">Länge</th>
            <th class="num" data-sort="wingspan">Spannweite</th>
            <th class="num" data-sort="height">Höhe</th>
            <th class="num" data-sort="wingtip">WL/SL</th>
            <th class="num" data-sort="status">Modell</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>
    `;

    // initial values = original
    updateFamilyCompareDims("original");
  }

  const el = document.getElementById("familyCompareModal");
  if(el){
    el.classList.add("on");
    document.body.classList.add("noscroll");
  }
}

function updateFamilyCompareDims(mode){
  const body = document.getElementById("familyCompareBody");
  if(!body) return;

  body.querySelectorAll(".famDimCell").forEach(td => {
    const raw = td.getAttribute("data-raw") || "";
    const cur = td.getAttribute("data-cur") || "";

    const span = td.querySelector(".famNowrap");
    if(span){
      span.textContent = scaleDim(raw, mode);
    }

    td.classList.remove("famCmp-same", "famCmp-diff");
    td.classList.add(dimCellClass(raw, cur, mode));
  });

  // WICHTIG: Buttons jetzt global im Modal updaten, nicht nur im Body
  document.querySelectorAll("#familyCompareModal .famModeBtn").forEach(btn => {
    const m = btn.getAttribute("data-fam-mode");
    btn.classList.toggle("is-on", m === mode);
  });
}

document.addEventListener("click", (ev) => {
  const btn = ev.target && ev.target.closest ? ev.target.closest(".cmpFamilyBtn") : null;
  if(btn){
    const family = btn.getAttribute("data-family") || "";
    const aircraft = btn.getAttribute("data-aircraft") || "";
    openFamilyCompare(family, aircraft);
    return;
  }

  const modeBtn = ev.target && ev.target.closest ? ev.target.closest(".famModeBtn") : null;
  if(modeBtn){
    const mode = modeBtn.getAttribute("data-fam-mode") || "original";
    updateFamilyCompareDims(mode);
    return;
  }

  const sortTh = ev.target && ev.target.closest ? ev.target.closest(".famCmpTable th[data-sort]") : null;
  if(sortTh){
    const key = sortTh.getAttribute("data-sort") || "";
    if(key) sortFamilyCompareTable(key);
    return;
  }
  
  const tr = ev.target && ev.target.closest ? ev.target.closest(".famCmpTable tbody tr") : null;
  if(tr){
    const status = String(tr.getAttribute("data-status") || "").trim();
    const aircraftId = String(tr.getAttribute("data-aircraft-id") || "").trim();

    if((status === "owned" || status === "ordered") && aircraftId){
      window.location.href = `index.html?aircraft_id=${encodeURIComponent(aircraftId)}`;
    }
  }
});

async function main(){
  const idRaw = qs("id");
  const id = String(idRaw || "").trim().toUpperCase();

  setPageTitle("Sammelmodell", id);
  
  renderBreadcrumb([
    { label: "Dashboard", href: "./dashboard.html" },
    { label: "Flugzeugmodelle", href: "./models_overview.html" },
    { label: id }
  ]);
  
  const pill = document.getElementById("idpill");
  if(pill) pill.style.display = "none";
  document.getElementById("idpill").textContent = id ? `id=${id}` : "id=?";

  if(!id){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">model.html?id=OS016</span></div>`;
    return;
  }
  
  let prevId = "", nextId = "", pos = 0, total = 0;
  try{
    const ids = await loadIndexIds();
    console.log("current id:", id, "found index:", ids.indexOf(id), "first10:", ids.slice(0,10));
    const n = navNeighbors(ids, id);
    prevId = n.prev; nextId = n.next; pos = n.pos; total = n.total;
    enableArrowKeys(prevId, nextId);
  }catch(e){
    // index.json not critical; just skip nav if it fails
  }
  
  const url = `./data/models/${encodeURIComponent(id)}.json`;
  
  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const photosEnriched = await loadAircraftPhotosEnriched();
    const photoE = photosEnriched ? (photosEnriched[id] || null) : null;    
    const airline = asText(d.airline_row) || asText(d.airline) || asText(d.airline_code);
    const typ = asText(d.aircraft_type) || asText(d.aircraft?.type);
    const reg = asText(d.registration) || asText(d.aircraft?.registration);
    const livery = asText(d.livery_name) || asText(d.livery?.code);

    // Option A: Airline-Text nur wenn Logo NICHT "sprechend" ist
    const logoSpeakingRaw = getLogoSpeaking(d);

    // WICHTIG: Default = "sprechend" (damit Airline NICHT doppelt erscheint),
    // Airline nur anzeigen, wenn explizit als NICHT sprechend markiert
    const logoSpeaking = logoSpeakingRaw ? boolDE(logoSpeakingRaw) : true;
    const showAirlineText = !logoSpeaking;

    // temporär - dann wieder entfernen!
    // document.getElementById("subtitle").textContent = `debug: logo_speaking="${logoSpeakingRaw}", parsed=${logoSpeaking}`;

    const titleMain = [
      typ,
      reg,
      d.aircraft_name ? `„${d.aircraft_name}“` : ""
    ].filter(Boolean).join(" · ") || id;

    document.title = showAirlineText && airline ? `${airline} · ${titleMain}` : titleMain;

    const logoUrl = logoSrc(d);
    const logoHtml = logoUrl
      ? `<img class="airlineLogo" src="${esc(logoUrl)}" alt="Logo">`
      : "";
    const navHtml = (prevId || nextId) ? buildNavHtml(prevId, nextId, pos, total) : "";
    
    document.getElementById("title").innerHTML = `
      <div class="headerWrap">
        <div class="headerLeft">
          ${logoHtml}
          <div class="headerTxt">
            ${showAirlineText && airline ? `<div class="hAir">${esc(airline)}</div>` : ""}
            <div class="hTyp">${esc(typ || id)}</div>
            <div class="hMeta">
              ${reg ? `<span class="hReg">${esc(reg)}</span>` : ""}
              ${d.aircraft_name ? `<span class="hName">„${esc(d.aircraft_name)}“</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Bestellt-Hinweis
    const orderedAt = asText(d.ordered_at || "");
    const orderedText = (d.ordered && orderedAt) ? `Bestellt: ${formatDateDE(orderedAt)}` : "";
    const statusPill = document.getElementById("statuspill");
    const isOrderedNow = !!d.ordered && !!orderedAt && !asText(d.arrived);
    
    if(isOrderedNow){
      statusPill.style.display = "";
      statusPill.classList.add("ordered");
      statusPill.textContent = `Bestellt: ${formatDateDE(orderedAt)}`;
    }else{
      statusPill.style.display = "none";
      statusPill.textContent = "";
    }


    const sub = [
      (showAirlineText && airline) ? airline : "",
      livery ? `Livery: ${livery}` : "",
      d.livery_note ? `Bemalung: ${d.livery_note}` : "",
      orderedText
    ].filter(Boolean).join(" | ");

    document.getElementById("subtitle").textContent = "";

    // Blocks
    const modelBlock = `
      <div class="card sam ${isOrderedNow ? "ordered" : ""}">
        <div class="k">Sammlung</div>
        <div class="grid" style="margin-top:8px">
          ${rowHtml("Maßstab", scaleBadge(d.model?.scale || ""))}
          ${row("Hersteller", d.manufacturer || d.model?.manufacturer || "")}
          ${row("Artikel-/Modellnummer", d.model?.model_number || "")}
          ${row("Modell-Zusatz", d.model_extra || "")}
          ${linkOrTextRow("Shop", d.shop_url || d.shop || "")}
          ${row("Preis", money(d.price ?? d.model?.price))}
          ${row("Versand (anteilig)", money(d.shipping_allocated ?? d.model?.shipping_allocated))}
          ${row("Bestellt am", formatDateDE(d.ordered_at || ""))}
          ${row("Angekommen", formatDateDE(d.arrived || d.model?.arrived || ""))}
          ${row("Besonderheit", d.special_note || d.model?.special_note || "")}
        </div>
      </div>
    `;

    let postcardBlock = "";
    let enrichedById = {};
    
    if(Array.isArray(d.postcards) && d.postcards.length){
      enrichedById = await loadPostcardsEnriched();
      postcardBlock = renderPostcardsCard(d, enrichedById);
    }
    
    const photoSource0 = asText(d.photo_source_url) || asText(d.photo) || "";
    let photoSource = photoSource0;
    let photoImg    = asText(d.photo_image_url) || "";
    let photoCredit = asText(d.photo_credit) || "";
    
    // --- Fallback: Postkarte als Bild ---
    let usingPostcard = false;
    
    if(!photoImg && Array.isArray(d.postcards) && d.postcards.length){
      const pc = d.postcards[0];
      const pcId = asText(pc?.id);
      const pcE = pcId ? (enrichedById?.[pcId] || null) : null;
    
      if(pcE && pcE.thumb_url){
        photoImg = asText(pcE.thumb_url);
        usingPostcard = true;
      }
    
      if(pc && pc.url && !photoSource){
        photoSource = asText(pc.url);
      }
    }
    
    const photoHref = photoSource || photoImg;
    const copyright = (!usingPostcard && photoCredit)
      ? photoCopyright(photoCredit, photoSource, photoImg)
      : "";
    
    const aircraftPhotoHtml = photoImg
      ? `<div class="air-photo">
           <img class="air-thumb"
             src="${esc(photoImg)}"
             alt="Aircraft photo"
             loading="lazy"
             decoding="async"
             fetchpriority="low"
             style="cursor: zoom-in"
             onclick="openLightbox('${esc(photoImg)}','${esc(photoHref || photoImg)}')">
    
           ${usingPostcard ? `<div class="air-credit postcard">Postkartenmotiv</div>` : ``}
    
           ${copyright ? `<div class="air-credit">${esc(copyright)}</div>` : ``}
         </div>`
      : (photoSource
          ? `<a href="${esc(photoSource)}" target="_blank" rel="noopener">
              ${esc(hostLabel(photoSource))}
            </a>${copyright ? `<div class="air-credit">${esc(copyright)}</div>` : ``}`
          : "");

    const familyName = asText(d.aircraft_full_v8?.Baureihe || "");
    const familyCompareRow = familyName
      ? rowHtml(
          "Baureihe",
          `${esc(familyName)}
           <div style="margin-top:6px">
             <button class="cmpFamilyBtn" type="button"
               data-family="${esc(familyName)}"
               data-aircraft="${esc(asText(d.aircraft_id))}">
               Baureihe vergleichen
             </button>
           </div>`
        )
      : "";
    
    const aircraftBlock = `
      <div class="card">
        <div class="k k-nav">
          <span>Flugzeug</span>
          ${navHtml || ""}
        </div>
    
        <div class="air-layout">
          ${aircraftPhotoHtml ? `
            <div class="air-photo-box">
              ${aircraftPhotoHtml}
            </div>
          ` : ""}
    
          <div class="air-data grid">
            ${row("Flugzeugtyp", typ)}
            ${familyCompareRow}
            ${row("Registrierung", reg)}
            ${row("Taufname", d.aircraft_name || "")}
            ${row("Zusatzinfo", d.extra_info || "")}
            ${(d.flown ?? d.model?.flown)
              ? rowHtml("Mitgeflogen", `<span class="badge flown">✈️ ja</span>`)
              : ""}
          </div>
        </div>
      </div>
    `;

    const liveryName = (d.livery_full?.Livery_Name || "").trim();
    const liveryType = (d.livery_full?.Livery_Type || "").trim();
    const liveryNotes = (d.livery_full?.Notes || "").trim();
    
    const hasLivery = !!liveryName || !!liveryType || !!liveryNotes || !!livery || !!(d.livery_note || "");
    const liveryBlock = !hasLivery ? "" : `
      <div class="card">
        <div class="k">Bemalung</div>
        <div class="sectionGrid" style="margin-top:8px">
          ${livery ? row("Code", livery) : ""}
          ${d.livery_note ? row("Hinweis", d.livery_note) : ""}
          ${liveryName ? row("Bezeichnung", liveryName) : ""}
          ${liveryType ? row("Typ", liveryType) : ""}
          ${liveryNotes ? row("Erläuterung", liveryNotes) : ""}
        </div>
      </div>
    `;


    const linksBlock = "";
    
    // Optional: show raw source pointer
    const src = d.source ? `(${d.source.sheet || ""} #${d.source.row || ""})` : "";
    const sourceBlock = src ? `<div class="muted">Quelle: ${esc(src)}</div>` : "";

    const v8Table = renderV8Groups(d.aircraft_full_v8);

    const v8Block = v8Table ? `
      <div class="card">
        <div class="k">Flugzeugdaten</div>
        <div style="margin-top:10px">${v8Table}</div>
      </div>
    ` : "";

    const headBlock = `<div class="sectionGrid">${modelBlock}${aircraftBlock}</div>`;

    const tailBlocks = [liveryBlock, v8Block, sourceBlock]
      .filter(x => x && String(x).trim() !== "");
    
    const midBlocks = [postcardBlock].filter(x => x && String(x).trim() !== "");

    document.getElementById("content").innerHTML =
      `<div class="stack">` +
        `<div class="stackItem">${headBlock}</div>` +
        midBlocks.map(x => `<div class="stackItem">${x}</div>`).join("") +
        tailBlocks.map(x => `<div class="stackItem">${x}</div>`).join("") +
      `</div>`;
    
  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

main();
