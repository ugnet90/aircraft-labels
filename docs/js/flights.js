let sortKey = "date";
let sortDir = "desc"; // "asc" | "desc"

function getVal(x, key){
  const v = x[key];
  return (v === null || v === undefined) ? "" : String(v);
}

function cmp(a, b){
  const va = getVal(a, sortKey);
  const vb = getVal(b, sortKey);

  // Spezial: date (YYYY-MM-DD) und time
  if(sortKey === "date"){
    // Primär: Datum
    const d = va.localeCompare(vb);
    if(d !== 0) return d * (sortDir === "asc" ? 1 : -1);
  
    // Sekundär: Zeit (gleiches Datum)
    const ta = formatTimeExcel(getVal(a, "time"));
    const tb = formatTimeExcel(getVal(b, "time"));
    return ta.localeCompare(tb) * (sortDir === "asc" ? 1 : -1);
  }

  if(sortKey === "time"){
    // Vergleich über formatTimeExcel -> Minuten
    const ta = formatTimeExcel(va);
    const tb = formatTimeExcel(vb);
    return (ta.localeCompare(tb)) * (sortDir === "asc" ? 1 : -1);
  }

  // Standard String compare
  return (va.localeCompare(vb, "de", {numeric:true, sensitivity:"base"})) * (sortDir === "asc" ? 1 : -1);
}

function setSort(key){
  if(sortKey === key){
    sortDir = (sortDir === "asc") ? "desc" : "asc";
  }else{
    sortKey = key;
    sortDir = "asc";
  }
  applyRender(); // musst du auf deine Render-Funktion mappen
}

function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function formatTimeExcel(v){
  if(v === null || v === undefined) return "";
  const s = String(v).trim();
  if(!s) return "";

  // "HH:MM" / "HH:MM:SS" bereits ok
  if(/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s;

  // Excel: 0,552083... oder 0.552083...
  const num = Number(s.replace(",", "."));
  if(!Number.isFinite(num)) return s;

  // Tagesanteil -> Sekunden
  const totalSeconds = Math.round(num * 24 * 60 * 60);
  const hh = Math.floor(totalSeconds / 3600) % 24;
  const mm = Math.floor((totalSeconds % 3600) / 60);
  // const ss = totalSeconds % 60; // falls du Sekunden willst

  return String(hh).padStart(2,"0") + ":" + String(mm).padStart(2,"0");
}

function formatDateDE(iso){
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}
function asText(v){ return (v??"").toString().trim(); }

let allFlights = [];
let allModels = [];
let matchSets = null;

function renderFlights(items){
  const mark = (key) => {
    if(sortKey !== key) return `<span class="sortMark">↕</span>`;
    return `<span class="sortMark active">${sortDir === "asc" ? "↑" : "↓"}</span>`;
  };

  const thClass = (key, base) => (sortKey === key ? `${base} thSort active` : `${base} thSort`);

  let html = `
    <table class="tbl">
      <thead>
        <tr>
          <th class="${thClass("date","col-date")}" data-sort="date">Datum ${mark("date")}</th>
          <th class="${thClass("route","col-route")}" data-sort="route">Route ${mark("route")}</th>
          <th class="${thClass("airline","col-air")}" data-sort="airline">Airline ${mark("airline")}</th>
          <th class="${thClass("flight_no","col-fn")}" data-sort="flight_no">Flug ${mark("flight_no")}</th>
          <th class="${thClass("aircraft_id","col-type")}" data-sort="aircraft_id">Flugzeugtyp ${mark("aircraft_id")}</th>
          <th class="${thClass("registration","col-reg")}" data-sort="registration">Reg. ${mark("registration")}</th>
        </tr>
      </thead>
      <tbody>
  `;

  for(const f of items){
    const dateRaw = asText(f.date);
    const date = formatDateDE(dateRaw);

    const time = formatTimeExcel(asText(f.time));
    const from = asText(f.from);
    const to = asText(f.to);
    const route = [from, to].filter(Boolean).join(" → ");

    const airline = asText(f.airline_row) || asText(f.logo_id);
    const fn = asText(f.flight_no);

    const typ = asText(f.typ_anzeige) || asText(f.aircraft_id);
    const aid = asText(f.aircraft_id);

    const reg = asText(f.registration);
    const regLink = f.reg_url
      ? `<a href="${esc(f.reg_url)}" target="_blank" rel="noopener">${esc(reg)}</a>`
      : esc(reg);

    html += `
      <tr class="rowFlight" data-id="${esc(f.flight_id)}">
        <td class="col-date mono" data-label="Datum">
          <div class="dDate">${esc(date)}</div>
          ${time ? `<div class="dTime">${esc(time)}</div>` : ``}
        </td>
    
        <td class="col-route mono" data-label="Route">
          <div class="routeCell">
            <span class="routeText">${esc(route)}</span>
            ${matchSets ? `<span class="routeDots">${matchDotsHtml(f, matchSets)}</span>` : ""}
          </div>
        </td>
    
        <td class="col-air" data-label="Airline">${esc(airline)}</td>
        <td class="col-fn mono" data-label="Flug">${esc(fn)}</td>
    
        <td class="col-type" data-label="Flugzeugtyp">
          <div>${esc(typ)}</div>
          <div class="muted mono">${esc(aid)}</div>
        </td>
    
        <td class="col-reg mono" data-label="Reg.">${regLink}</td>
      </tr>
    `;

  }

  html += `</tbody></table>`;
  document.getElementById("content").innerHTML =
    `<div class="card tableCard"><div class="tableWrap">${html}</div></div>`;

  document.querySelectorAll(".rowFlight").forEach(tr => {
    tr.addEventListener("click", e => {
      // keine Navigation wenn man auf externen Link klickt (Reg-Link)
      if(e.target.closest("a")) return;
  
      const id = tr.getAttribute("data-id");
      if(id){
        location.href = `./flight.html?id=${encodeURIComponent(id)}`;
      }
    });
  });
}


function applyRender(){
  const items = allFlights.slice();

  // Route + Airline-Feld virtuell fürs Sortieren (cmp benutzt getVal(x, key))
  for(const f of items){
    const from = asText(f.from);
    const to = asText(f.to);
    f.route = [from, to].filter(Boolean).join(" → ");
    //f.airline = asText(f.airline) || asText(f.logo_id);
    f.airline = asText(f.airline_row);
  }

  items.sort(cmp);
  renderFlights(items);

  document.getElementById("meta").textContent =
    `${items.length} Flüge · Sort: ${sortKey} ${sortDir === "asc" ? "↑" : "↓"}`;
}

function key3(logoId, aircraftId, reg){
  return [asText(logoId), asText(aircraftId), asText(reg)].join("||");
}
function key2(logoId, aircraftId){
  return [asText(logoId), asText(aircraftId)].join("||");
}

// "bestellt" = ordered true UND noch nicht arrived
function isOrderedModel(m){
  return m && m.ordered === true && !asText(m.arrived);
}
function getModelLogoId(m){
  // robust: je nachdem wie dein index.json aktuell aussieht
  return asText(m.logo_id) || asText(m.logo?.id) || asText(m.logoId) || "";
}
function getModelAircraftId(m){
  return asText(m.aircraft_id) || "";
}
function getModelReg(m){
  return asText(m.registration) || "";
}

function buildMatchSets(models){
  const presentExact = new Set();
  const presentType  = new Set();
  const orderedExact = new Set();
  const orderedType  = new Set();

  for(const m of (models || [])){
    const lid = getModelLogoId(m);
    const aid = getModelAircraftId(m);
    if(!lid || !aid) continue;

    const k2 = key2(lid, aid);
    const k3e = key3(lid, aid, getModelReg(m));

    if(isOrderedModel(m)){
      orderedType.add(k2);
      if(getModelReg(m)) orderedExact.add(k3e);
    }else{
      presentType.add(k2);
      if(getModelReg(m)) presentExact.add(k3e);
    }
  }
  return { presentExact, presentType, orderedExact, orderedType };
}

function matchDotsHtml(f, sets){
  const lid = asText(f.logo_id);
  const aid = asText(f.aircraft_id);
  const reg = asText(f.registration);

  if(!lid || !aid) return "";

  const k2 = key2(lid, aid);
  const k3e = key3(lid, aid, reg);

  // Priorität: exakt vor type-level
  const hasGfill = reg && sets.presentExact.has(k3e);
  const hasGopen = !hasGfill && sets.presentType.has(k2);

  const hasYfill = reg && sets.orderedExact.has(k3e);
  const hasYopen = !hasYfill && sets.orderedType.has(k2);

  const parts = [];

  if(hasGfill) parts.push(`<span class="dot dotGfill" title="Exakt vorhanden (Airline+Typ+Reg)"></span>`);
  else if(hasGopen) parts.push(`<span class="dot dotGopen" title="Vorhanden (Airline+Typ)"></span>`);

  if(hasYfill) parts.push(`<span class="dot dotYfill" title="Exakt bestellt (Airline+Typ+Reg)"></span>`);
  else if(hasYopen) parts.push(`<span class="dot dotYopen" title="Bestellt (Airline+Typ)"></span>`);

  if(parts.length === 0) return "";
  return `<span class="matchDots">${parts.join("")}</span>`;
}

async function fetchJson(url){
  const res = await fetch(url, {cache:"no-store"});
  if(!res.ok){
    throw new Error(`${url} HTTP ${res.status}`);
  }
  return await res.json();
}

async function main(){
  try{
    // 1) flights.json laden
    const flights = await fetchJson("./data/flights.json");
    allFlights = flights.items || [];

    // 2) index.json laden (für Matching)
    const idx = await fetchJson("./index.json");
    allModels = idx.items || [];
    matchSets = buildMatchSets(allModels);
    
    // 3) normal weiter
    applyRender(); // <- MUSS es bei dir geben, sonst kommt jetzt gleich der Fehler sichtbar

    // 4) Klick auf Header -> sortieren
    document.addEventListener("click", (ev)=>{
      const th = ev.target.closest("th[data-sort]");
      if(!th) return;
      setSort(th.getAttribute("data-sort"));
    });

  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> ${String(e.message || e)}</div>`;
  }
}

main();
