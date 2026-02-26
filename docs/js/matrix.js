function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

let data = null;

function renderDesktop(){
  if(!data) return;

  const airQ = (document.getElementById("airQ").value || "").trim().toLowerCase();
  const typeQ = (document.getElementById("typeQ").value || "").trim().toLowerCase();

  const airlines = data.groups || data.airlines || [];
  const types = data.types || [];
  const pm = data.present_matrix || data.matrix || [];
  const om = data.ordered_matrix || [];


  const ai = airlines
    .map((a, idx) => ({a, idx}))
    .filter(x => !airQ || x.a.toLowerCase().includes(airQ));

  const ti = types
    .map((t, idx) => ({t, idx}))
    .filter(x => !typeQ || x.t.toLowerCase().includes(typeQ));

  let html = "<thead><tr><th class='typeCol'>Typ \\ Airline</th>";
  for(const x of ai){
    html += `<th class="colHead">${esc(x.a)}</th>`;
  }

  html += "</tr></thead><tbody>";

  for(const y of ti){
    html += `<tr><td class="typeCol">${esc(y.t)}</td>`;
    for(const x of ai){
      const p = (pm[x.idx] && pm[x.idx][y.idx]) ? pm[x.idx][y.idx] : 0;
      const o = (om[x.idx] && om[x.idx][y.idx]) ? om[x.idx][y.idx] : 0;


      // optional: click to jump to index.html filtered (airline + type)
      if(p || o){
        const href = `./index.html?group=${encodeURIComponent(x.a)}&aircraft_id=${encodeURIComponent(y.t)}`;
        const badge = o ? `<span class="badgeOrdered">+${o}</span>` : "";
        const cls = o ? "num cellOrdered" : "num";
        html += `<td class="${cls}"><a href="${esc(href)}" title="In Übersicht öffnen">${p}</a>${badge}</td>`;
      }else{
        html += `<td class="num"></td>`;
      }

    }
    html += "</tr>";
  }
  html += "</tbody>";

  document.getElementById("tbl").innerHTML = html;
  document.getElementById("meta").textContent =
    `${ai.length} Airlines · ${ti.length} Typen (aus ${airlines.length}×${types.length})`;

  // Sync top scrollbar width + scroll position
  requestAnimationFrame(() => {
    const wrap = document.getElementById("tableWrap");
    const top = document.getElementById("topScroll");
    const inner = document.getElementById("topScrollInner");
    const tbl = document.getElementById("tbl");
    if(!wrap || !top || !inner || !tbl) return;

    inner.style.width = tbl.scrollWidth + "px";

    top.onscroll = () => { wrap.scrollLeft = top.scrollLeft; };
    wrap.onscroll = () => { top.scrollLeft = wrap.scrollLeft; };
  });
}

function initMobile(){
  if(!data) return;
  const mAir = document.getElementById("mAir");

  // build airline dropdown
  mAir.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Alle Airlines";
  mAir.appendChild(optAll);

  const airlines = data.groups || data.airlines || [];
  for(const a of airlines){
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    mAir.appendChild(opt);
  }

  document.getElementById("mAir").addEventListener("change", renderMobile);
  document.getElementById("mTypeQ").addEventListener("input", renderMobile);
  document.getElementById("mOnlyNonZero").addEventListener("change", renderMobile);

  renderMobile();
}

function renderMobile(){
  if(!data) return;

  const airlines = data.groups || data.airlines || [];
  const types = data.types || [];
  const matrix = data.present_matrix || data.matrix || [];
  const ordered = data.ordered_matrix || [];


  const selectedAir = (document.getElementById("mAir").value || "");
  const typeQ = (document.getElementById("mTypeQ").value || "").trim().toLowerCase();
  const onlyNonZero = (document.getElementById("mOnlyNonZero").value === "true");

  let airlineIdx = -1;
  if(selectedAir){
    airlineIdx = airlines.indexOf(selectedAir);
  }

  // If no airline selected: show top airlines summary
  // But simpler: require selection for meaningful list
  if(airlineIdx < 0){
    document.getElementById("mMeta").innerHTML =
      `<span class="pill">Bitte Airline wählen</span> <span class="muted">(${airlines.length} verfügbar)</span>`;
    document.querySelector("#mobileTbl tbody").innerHTML = "";
    return;
  }

  const rows = [];
  for(let ti = 0; ti < types.length; ti++){
    const t = types[ti];
    if(typeQ && !t.toLowerCase().includes(typeQ)) continue;

    const n = (matrix[airlineIdx] && matrix[airlineIdx][ti]) ? matrix[airlineIdx][ti] : 0;
    const o = (ordered[airlineIdx] && ordered[airlineIdx][ti]) ? ordered[airlineIdx][ti] : 0;
    if(onlyNonZero && !n) continue;

     rows.push({t, n, o});
  }

  rows.sort((a,b) => a.t.localeCompare(b.t));

  document.getElementById("mMeta").innerHTML =
    `<span class="pill">${esc(selectedAir)}</span> ` +
    `<span class="pill">Treffer: <span class="mono">${rows.length}</span></span>`;

  const tbody = document.querySelector("#mobileTbl tbody");
  tbody.innerHTML = rows.map(x => {
    const href = `./index.html?group=${encodeURIComponent(selectedAir)}&aircraft_id=${encodeURIComponent(x.t)}`;
    const n = x.n ? x.n : 0;
  
    return `
      <tr>
        <td class="num">
          <a href="${esc(href)}" title="In Übersicht öffnen">${esc(n)}</a>${x.o ? ` <span class="badgeOrdered">+${esc(x.o)}</span>` : ""}
        </td>
        <td>${esc(x.t)}</td>
      </tr>
    `;
  }).join("");
}

async function main(){
  const res = await fetch("./data/matrix.json", {cache:"no-store"});
  data = await res.json();

  renderDesktop();
  initMobile();

  document.getElementById("airQ").addEventListener("input", renderDesktop);
  document.getElementById("typeQ").addEventListener("input", renderDesktop);
}

main();
