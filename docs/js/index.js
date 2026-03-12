const state = { all: [], filtered: [] };

let tableSortKey = localStorage.getItem("indexSortKey") || "model_id";     // Default-Spalte
let tableSortDir = Number(localStorage.getItem("indexSortDir") || "1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = 1;            // 1 = asc, -1 = desc

function updateSortIndicators(){
  document.querySelectorAll("#content th[data-sort]").forEach(th => {
    const key = th.dataset.sort;
    let label = th.textContent.replace(/[↑↓]/g,"").trim();

    if(key === tableSortKey){
      label += tableSortDir === 1 ? " ↑" : " ↓";
    }

    th.textContent = label;
  });
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

function formatDateTimeDE(isoUtc){
  if(!isoUtc) return "";
  const m = String(isoUtc).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if(!m) return isoUtc;
  return `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}`;
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

  let html = `
    <table>
      <thead>
        <tr>
          <th data-sort="model_id">Modell-ID</th>
          <th data-sort="airline">Airline-Gruppe</th>
          <th data-sort="airline_row">Airline</th>
          <th class="hide-m" data-sort="scale">Maßstab</th>
          <th class="hide-m" data-sort="flown">Mitgeflogen</th>
          <th data-sort="aircraft_type">Flugzeugtyp</th>
          <th data-sort="wingtip">WL/SL</th>
          <th class="hide-m" data-sort="registration">Registrierung</th>
          <th class="hide-m" data-sort="livery_display">Bemalung</th>
          <th class="hide-m" data-sort="arrived">Angekommen</th>
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

  updateSortIndicators();
}



function apply(){
  const q = norm(document.getElementById("q").value);
  const group = document.getElementById("group").value;
  const airline = document.getElementById("airline").value;
  const type = document.getElementById("type").value;
  const scale = document.getElementById("scale").value;
  const flown = document.getElementById("flown").value;

  let items = state.all.filter(it => {
    if (!matchesQuery(it, q)) return false;
    if (!matchesAirline(it, airline)) return false;
    const grp = (it.airline || it.group || it.airline_group || "");
    if (group && grp !== group) return false;   // ⭐ Airline-Gruppe

    // if (group && (it.airline || "") !== group) return false;
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
      `<span class="pill">Stand: <span class="mono">${esc(formatDateTimeDE(data.generated_at || ""))}</span></span>` +
      `<span class="pill">Anzahl: <span class="mono">${esc(data.count || state.all.length)}</span></span>`;
    
    buildOptions(state.all, "group",
      it => (it.airline || ""),   // airline = Gruppe (Sheet)
      it => (it.airline || "")
    );

    buildOptions(state.all, "airline",
      it => (it.airline_row || ""),
      it => (it.airline_row || "")
    );
    buildOptions(state.all, "type",
      it => (it.aircraft_type || ""),
      it => (it.aircraft_type || "")
    );

    buildOptions(state.all, "scale",
      it => (it.scale || ""),
      it => (it.scale || "")
    );

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
