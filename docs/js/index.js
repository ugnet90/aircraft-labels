const state = { all: [], filtered: [] };

let tableSortKey = localStorage.getItem("indexSortKey") || "model_id";     // Default-Spalte
let tableSortDir = Number(localStorage.getItem("indexSortDir") || "1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = 1;            // 1 = asc, -1 = desc

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

  const box = document.getElementById("activeFilters");
  if(box){
    box.textContent = active.length
      ? `Aktive Filter: ${active.join(", ")}`
      : "Keine Filter aktiv";
  }
}

function matchesQuery(it, q){
  if(!q) return true;
  const hay = [
    it.model_id, it.airline_code, it.airline_row, it.airline,
    it.aircraft_id, it.aircraft_type,
    it.registration, it.livery_name,
    it.livery_display,
    it.arrived,
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

function sortByColumn(items){
  if(!tableSortKey) return items.slice();

  const arr = items.slice();

  arr.sort((a,b)=>{
    let va = a[tableSortKey];
    let vb = b[tableSortKey];

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
          <th class="${thClass("livery_display","hide-m")}" data-sort="livery_display">Bemalung ${mark("livery_display")}</th>
          <th class="${thClass("arrived","hide-m")}" data-sort="arrived">Angekommen ${mark("arrived")}</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  for(const it of items){
    const link = `./model.html?id=${encodeURIComponent(it.model_id)}`;
    html += `
      <tr class="modelRow" data-id="${esc(it.model_id || "")}">
        <td class="mono">
          <a href="./model.html?id=${encodeURIComponent(it.model_id)}" title="Modell anzeigen">
            ${
              (it.model_id || "").startsWith("ORD-")
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
        <td class="hide-m">${esc(it.livery_display || it.livery_name || "")}</td>
        <td class="mono hide-m">
          ${esc(formatDateDE(it.arrived || ""))}
          ${
            it.ordered === true && !it.arrived
              ? ` <span class="badge badge-ordered">bestellt${it.ordered_at ? " " + esc(formatDateDE(it.ordered_at)) : ""}</span>`
              : ""
          }
        </td>
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
    flown: document.getElementById("flown").value
  };

  // Facetten neu aufbauen, bevor die finale Trefferliste gerendert wird
  buildFacetOptions(filters);
  updateActiveFilterUI(filters);

  const q = norm(document.getElementById("q").value);
  const group = document.getElementById("group").value;
  const airline = document.getElementById("airline").value;
  const type = document.getElementById("type").value;
  const scale = document.getElementById("scale").value;
  const flown = document.getElementById("flown").value;

  let items = state.all.filter(it => {
    if (!matchesQuery(it, q)) return false;
    if (!matchesAirline(it, airline)) return false;

    const grp = getGroupValue(it);
    if (group && grp !== group) return false;

    if (!matchesType(it, type)) return false;
    if (!matchesScale(it, scale)) return false;
    if (!matchesFlown(it, flown)) return false;
    return true;
  });

  items = sortByColumn(items);

  state.filtered = items;
  render(items);
}

async function main(){
  try{
    const res = await fetch("./index.json", {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.all = data.items || [];

    document.getElementById("meta").innerHTML =
      `<span class="pill">Stand: <span class="mono">${esc(formatStandDE(data.generated_at || ""))}</span></span>` +
      `<span class="pill">Anzahl: <span class="mono">${esc(data.count || state.all.length)}</span></span>`;
    
    document.getElementById("q").addEventListener("input", apply);
    document.getElementById("group").addEventListener("change", apply);
    document.getElementById("airline").addEventListener("change", apply);
    document.getElementById("type").addEventListener("change", apply);
    document.getElementById("scale").addEventListener("change", apply);
    document.getElementById("flown").addEventListener("change", apply);

    document.getElementById("reset").addEventListener("click", () => {
      document.getElementById("q").value = "";
      document.getElementById("group").value = "";
      document.getElementById("airline").value = "";
      document.getElementById("type").value = "";
      document.getElementById("scale").value = "";
      document.getElementById("flown").value = "";
      
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

    if (p.has("q")) {
      document.getElementById("q").value = p.get("q") || "";
    }
    if (p.has("aircraft_id")) {
      // aircraft_id hat Priorität: wir setzen den Typ-Filter NICHT,
      // sondern nutzen die Suche (matchesQuery enthält aircraft_id bereits)
      document.getElementById("q").value = p.get("aircraft_id") || "";
    }

    if (p.has("group")) {
      document.getElementById("group").value = p.get("group") || "";
    }
    if (p.has("airline")) {
      document.getElementById("airline").value = p.get("airline") || "";
    }
    if (p.has("type")) {
      document.getElementById("type").value = p.get("type") || "";
    }
    if (p.has("scale")) {
      document.getElementById("scale").value = p.get("scale") || "";
    }
    if (p.has("flown")) {
      document.getElementById("flown").value = p.get("flown") || "";
    }
    //if (p.has("sort")) {
    //  document.getElementById("sort").value = p.get("sort") || document.getElementById("sort").value;
    //}

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
