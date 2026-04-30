function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function norm(s){ return String(s??"").trim(); }

let all = [];

let tableSortKey = localStorage.getItem("missingTypesSortKey") || "aircraft_id";
let tableSortDir = Number(localStorage.getItem("missingTypesSortDir") || "1");
if(tableSortDir !== 1 && tableSortDir !== -1) tableSortDir = 1;

function sortMissing(items){
  const arr = items.slice();

  arr.sort((a,b) => {
    let va = a[tableSortKey];
    let vb = b[tableSortKey];

    if(va == null) va = "";
    if(vb == null) vb = "";

    va = norm(va).toLowerCase();
    vb = norm(vb).toLowerCase();

    if(va < vb) return -1 * tableSortDir;
    if(va > vb) return  1 * tableSortDir;

    return norm(a.aircraft_id).localeCompare(norm(b.aircraft_id), "de");
  });

  return arr;
}

function buildOptions(items){
  const sel = document.getElementById("manu");
  // keep first option ("Alle"), rebuild the rest
  sel.innerHTML = '<option value="">Alle</option>';

  const set = new Set();
  for(const x of items){
    const m = norm(x.manufacturer);
    if(m) set.add(m);
  }
  const list = Array.from(set).sort((a,b)=>a.localeCompare(b));
  for(const m of list){
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  }
}

function updateActiveFilterUI(){
  const filters = [
    ["q", "Suche"],
    ["manu", "Hersteller"],
    ["status", "Status"]
  ];

  const active = [];

  filters.forEach(([id, label]) => {
    const el = document.getElementById(id);
    const on = !!norm(el?.value || "");
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

function render(){
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  const manu = norm(document.getElementById("manu").value);
  
  const status = norm(document.getElementById("status").value);

  updateActiveFilterUI();

  const items = all.filter(x => {
    if(status && norm(x.status) !== status) return false;
    if(manu && norm(x.manufacturer) !== manu) return false;
    if(!q) return true;
  
    const hay = (norm(x.Typ_anzeige) + " " + norm(x.aircraft_id) + " " + norm(x.manufacturer)).toLowerCase();
    return hay.includes(q);
  });


  document.getElementById("count").textContent = `${items.length} fehlende Typen`;

  const mark = (key) => {
    if(tableSortKey !== key) return `<span class="sortMark">↕</span>`;
    return `<span class="sortMark active">${tableSortDir === 1 ? "↑" : "↓"}</span>`;
  };
  
  document.querySelectorAll("#tbl thead th[data-sort]").forEach(th => {
    const key = th.dataset.sort;
    const label = th.getAttribute("data-label") || th.textContent.replace(/[↕↑↓]/g, "").trim();
    th.setAttribute("data-label", label);
    th.innerHTML = `${esc(label)} ${mark(key)}`;
  });
  
  const tbody = document.querySelector("#tbl tbody");
  const sorted = sortMissing(items);
  tbody.innerHTML = sorted.map(x => `
    <tr class="${esc(norm(x.status))}">
      <td>
        <span class="badge ${esc(norm(x.status))}">
          ${esc(norm(x.status) === "ordered" ? "bestellt" : "fehlend")}
        </span>
      </td>
      <td>${esc(norm(x.manufacturer) || "—")}</td>
      <td>${esc(norm(x.Typ_anzeige) || "—")}</td>
      <td class="mono">${esc(norm(x.aircraft_id) || "")}</td>
    </tr>
  `).join("");
  
  document.querySelectorAll("#tbl thead th[data-sort]").forEach(th => {
    th.onclick = () => {
      const key = th.dataset.sort;
      if(tableSortKey === key){
        tableSortDir *= -1;
      }else{
        tableSortKey = key;
        tableSortDir = 1;
      }
  
      localStorage.setItem("missingTypesSortKey", tableSortKey);
      localStorage.setItem("missingTypesSortDir", String(tableSortDir));
  
      render();
    };
  });
}

async function main(){
  const res = await fetch("./data/missing_types.json", {cache:"no-store"});
  const d = await res.json();

  const meta = d.counts
    ? `Gesamtanzahl Typen: ${d.counts.master_types} · davon [vorhanden: ${d.counts.present_types}] · [fehlend: ${d.counts.missing_types}] · [bestellt: ${d.counts.ordered_types || 0}]`
    : "";
  document.getElementById("meta").textContent = meta;

  if(d.warning){
    const w = document.getElementById("warn");
    w.style.display = "block";
    w.innerHTML = `<b>Hinweis:</b> ${esc(d.warning)}`;
  }

  all = (d.missing_types || []);
  buildOptions(all);
  
  // URL-Parameter übernehmen, z.B. missing_types.html?status=missing
  const p = new URLSearchParams(location.search);
  
  if(p.has("status")){
    const status = p.get("status") || "";
    const statusEl = document.getElementById("status");
  
    if(statusEl){
      statusEl.value = status;
    }
  }
  
  render();

  document.getElementById("q").addEventListener("input", render);
  document.getElementById("manu").addEventListener("change", render);
  document.getElementById("status").addEventListener("change", render);
  document.getElementById("reset").addEventListener("click", () => {
    document.getElementById("q").value = "";
    document.getElementById("manu").value = "";
    document.getElementById("status").value = "";
    render();
  });

}

main();
