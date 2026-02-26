function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function norm(s){ return String(s??"").trim(); }

let all = [];

function sortMissing(items){
  const status = norm(document.getElementById("status").value);

  // Status == "" bedeutet "Alle"
  if(!status){
    // Wunsch: bei "Alle" nach aircraft_id sortieren
    return items.slice().sort((a,b)=>
      (norm(a.aircraft_id)).localeCompare(norm(b.aircraft_id))
    );
  }

  // bei missing / ordered: Status + aircraft_id
  return items.slice().sort((a,b)=>
    norm(a.status).localeCompare(norm(b.status)) ||
    norm(a.aircraft_id).localeCompare(norm(b.aircraft_id))
  );
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

function render(){
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  const manu = norm(document.getElementById("manu").value);
  
  const status = norm(document.getElementById("status").value);

  const items = all.filter(x => {
    if(status && norm(x.status) !== status) return false;
    if(manu && norm(x.manufacturer) !== manu) return false;
    if(!q) return true;
  
    const hay = (norm(x.Typ_anzeige) + " " + norm(x.aircraft_id) + " " + norm(x.manufacturer)).toLowerCase();
    return hay.includes(q);
  });


  document.getElementById("count").textContent = `${items.length} fehlende Typen`;

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

}

async function main(){
  const res = await fetch("./data/missing_types.json", {cache:"no-store"});
  const d = await res.json();

  const meta = d.counts
    ? `Master: ${d.counts.master_types} · Vorhanden: ${d.counts.present_types} · Fehlend: ${d.counts.missing_types} · Bestellt: ${d.counts.ordered_types || 0}`
    : "";
  document.getElementById("meta").textContent = meta;

  if(d.warning){
    const w = document.getElementById("warn");
    w.style.display = "block";
    w.innerHTML = `<b>Hinweis:</b> ${esc(d.warning)}`;
  }

  all = (d.missing_types || []);
  buildOptions(all);
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
