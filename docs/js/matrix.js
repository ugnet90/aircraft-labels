function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

let data = null;

function checked(id, fallback=true){
  const el = document.getElementById(id);
  return el ? !!el.checked : fallback;
}

function statusFilters(prefix=""){
  return {
    present: checked(`${prefix}StatusPresent`, true),
    ordered: checked(`${prefix}StatusOrdered`, true),
    wishlist: checked(`${prefix}StatusWishlist`, true),
    missing: checked(`${prefix}StatusMissing`, false)
  };
}

function matrixTypeId(idx){
  return (data.types || [])[idx] || "";
}

function matrixTypeLabel(idx){
  const labels = data.type_labels || data.aircraft_types || [];
  return labels[idx] || matrixTypeId(idx);
}

function typeCellHtml(idx){
  const id = matrixTypeId(idx);
  const label = matrixTypeLabel(idx);

  if(label && label !== id){
    return `
      <strong>${esc(label)}</strong>
      <div class="muted mono">${esc(id)}</div>
    `;
  }

  return `<strong>${esc(id)}</strong>`;
}

function modelHref(group, aircraftId, status){
  const p = new URLSearchParams();
  p.set("group", group);
  p.set("aircraft_id", aircraftId);

  if(status){
    p.set("status", status);
  }

  return `./models_overview.html?${p.toString()}`;
}

function cellStatus(p, o, w){
  if(p > 0) return "present";
  if(o > 0) return "ordered";
  if(w > 0) return "wishlist";
  return "missing";
}

function cellMatchesFilters(p, o, w, filters){
  if(p > 0 && filters.present) return true;
  if(o > 0 && filters.ordered) return true;
  if(w > 0 && filters.wishlist) return true;
  if(p === 0 && o === 0 && w === 0 && filters.missing) return true;
  return false;
}

function cellMatchesFilters(p, o, w, filters){
  if(p > 0 && filters.present) return true;
  if(o > 0 && filters.ordered) return true;
  if(w > 0 && filters.wishlist) return true;

  if(p === 0 && o === 0 && w === 0 && filters.missing) return true;

  return false;
}

function renderMatrixCell(group, aircraftId, p, o, w, filters){
  const showPresent = p > 0 && filters.present;
  const showOrdered = o > 0 && filters.ordered;
  const showWishlist = w > 0 && filters.wishlist;
  const showMissing = p === 0 && o === 0 && w === 0 && filters.missing;

  if(!showPresent && !showOrdered && !showWishlist && !showMissing){
    return `<td class="num"></td>`;
  }

  if(showMissing){
    return `
      <td class="num cellMissing">
        <span class="matrixMissing">–</span>
      </td>
    `;
  }

  const baseHref = modelHref(group, aircraftId, "");
  const ownedHref = modelHref(group, aircraftId, "owned");
  const orderedHref = modelHref(group, aircraftId, "ordered");
  const wishlistHref = modelHref(group, aircraftId, "wishlist");

  const parts = [];

  if(showPresent){
    parts.push(
      `<a href="${esc(ownedHref)}" title="Vorhandene Modelle in Übersicht öffnen">${esc(p)}</a>`
    );
  }else if(showOrdered){
    parts.push(
      `<a href="${esc(baseHref)}" title="In Übersicht öffnen">0</a>`
    );
  }

  if(showOrdered){
    parts.push(
      `<a class="badgeOrdered" href="${esc(orderedHref)}" title="Bestellungen in Übersicht öffnen">+${esc(o)}</a>`
    );
  }

  if(showWishlist && !showPresent && !showOrdered){
    parts.push(
      `<a class="badgeWishlist" href="${esc(wishlistHref)}" title="Wunschmodelle in Übersicht öffnen">W${esc(w)}</a>`
    );
  }

  const cls = [
    "num",
    showOrdered ? "cellOrdered" : "",
    showWishlist && !showPresent && !showOrdered ? "cellWishlist" : ""
  ].filter(Boolean).join(" ");

  return `<td class="${cls}">${parts.join(" ")}</td>`;
}

  const baseHref = modelHref(group, aircraftId, "");
  const ownedHref = modelHref(group, aircraftId, "owned");
  const orderedHref = modelHref(group, aircraftId, "ordered");
  const wishlistHref = modelHref(group, aircraftId, "wishlist");

  if(p || o){
    const orderedBadge = o
      ? `<a class="badgeOrdered" href="${esc(orderedHref)}" title="Bestellungen in Übersicht öffnen">+${esc(o)}</a>`
      : "";

    const cls = o ? "num cellOrdered" : "num";

    return `
      <td class="${cls}">
        <a href="${esc(p ? ownedHref : baseHref)}" title="In Übersicht öffnen">${esc(p)}</a>
        ${orderedBadge}
      </td>
    `;
  }

  if(w){
    return `
      <td class="num cellWishlist">
        <a class="badgeWishlist" href="${esc(wishlistHref)}" title="Wunschmodelle in Übersicht öffnen">
          W${esc(w)}
        </a>
      </td>
    `;
  }

  return `<td class="num"></td>`;
}

function renderDesktop(){
  if(!data) return;

  const airQ = (document.getElementById("airQ").value || "").trim().toLowerCase();
  const typeQ = (document.getElementById("typeQ").value || "").trim().toLowerCase();

  const airlines = data.groups || data.airlines || [];
  const types = data.types || [];
  const pm = data.present_matrix || data.matrix || [];
  const om = data.ordered_matrix || [];
  const wm = data.wishlist_matrix || [];
  const filters = statusFilters();

const aiRaw = airlines
  .map((a, idx) => ({a, idx}))
  .filter(x => !airQ || x.a.toLowerCase().includes(airQ));

const tiRaw = types
  .map((t, idx) => ({
    t,
    idx,
    label: matrixTypeLabel(idx)
  }))
  .filter(x =>
    !typeQ ||
    x.t.toLowerCase().includes(typeQ) ||
    x.label.toLowerCase().includes(typeQ)
  );

const ti = tiRaw.filter(y => {
  return aiRaw.some(x => {
    const p = (pm[x.idx] && pm[x.idx][y.idx]) ? pm[x.idx][y.idx] : 0;
    const o = (om[x.idx] && om[x.idx][y.idx]) ? om[x.idx][y.idx] : 0;
    const w = (wm[x.idx] && wm[x.idx][y.idx]) ? wm[x.idx][y.idx] : 0;

    return cellMatchesFilters(p, o, w, filters);
  });
});

const ai = aiRaw.filter(x => {
  return ti.some(y => {
    const p = (pm[x.idx] && pm[x.idx][y.idx]) ? pm[x.idx][y.idx] : 0;
    const o = (om[x.idx] && om[x.idx][y.idx]) ? om[x.idx][y.idx] : 0;
    const w = (wm[x.idx] && wm[x.idx][y.idx]) ? wm[x.idx][y.idx] : 0;

    return cellMatchesFilters(p, o, w, filters);
  });
});
  
  let html = "<thead><tr><th class='typeCol'>Typ \\ Airline</th>";
  
  for(const x of ai){
    html += `<th class="colHead">${esc(x.a)}</th>`;
  }
  
  html += "</tr></thead><tbody>";
  
  for(const y of ti){
    let rowCells = "";
  
    for(const x of ai){
      const p = (pm[x.idx] && pm[x.idx][y.idx]) ? pm[x.idx][y.idx] : 0;
      const o = (om[x.idx] && om[x.idx][y.idx]) ? om[x.idx][y.idx] : 0;
      const w = (wm[x.idx] && wm[x.idx][y.idx]) ? wm[x.idx][y.idx] : 0;
  
      rowCells += renderMatrixCell(x.a, y.t, p, o, w, filters);
    }
  
    html += `<tr><td class="typeCol">${typeCellHtml(y.idx)}</td>${rowCells}</tr>`;
  }

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
  const airlines = data.groups || data.airlines || [];
  
  for(const a of airlines){
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    mAir.appendChild(opt);
  }
  
  if(airlines.length){
    mAir.value = airlines[0];
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
  const wishlist = data.wishlist_matrix || [];
  const filters = statusFilters("m");

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
    const label = matrixTypeLabel(ti);
    
    if(
      typeQ &&
      !t.toLowerCase().includes(typeQ) &&
      !label.toLowerCase().includes(typeQ)
    ){
      continue;
    }

    const n = (matrix[airlineIdx] && matrix[airlineIdx][ti]) ? matrix[airlineIdx][ti] : 0;
    const o = (ordered[airlineIdx] && ordered[airlineIdx][ti]) ? ordered[airlineIdx][ti] : 0;
    const w = (wishlist[airlineIdx] && wishlist[airlineIdx][ti]) ? wishlist[airlineIdx][ti] : 0;
    
    const status = cellStatus(n, o, w);
    
    if(!filters[status]) continue;
    if(onlyNonZero && !n && !o && !w) continue;
    
    rows.push({t, label, n, o, w, status});
  }

  rows.sort((a,b) => a.t.localeCompare(b.t));

  document.getElementById("mMeta").innerHTML =
    `<span class="pill">${esc(selectedAir)}</span> ` +
    `<span class="pill">Treffer: <span class="mono">${rows.length}</span></span>`;

  const tbody = document.querySelector("#mobileTbl tbody");
  tbody.innerHTML = rows.map(x => {
    const baseHref = modelHref(selectedAir, x.t, "");
    const ownedHref = modelHref(selectedAir, x.t, "owned");
    const orderedHref = modelHref(selectedAir, x.t, "ordered");
    const wishlistHref = modelHref(selectedAir, x.t, "wishlist");
    
    let statusHtml = "";
    
    if(x.n || x.o){
      statusHtml =
        `<a href="${esc(x.n ? ownedHref : baseHref)}" title="In Übersicht öffnen">${esc(x.n || 0)}</a>` +
        (x.o ? ` <a class="badgeOrdered" href="${esc(orderedHref)}" title="Bestellungen in Übersicht öffnen">+${esc(x.o)}</a>` : "");
    }else if(x.w){
      statusHtml = `<a class="badgeWishlist" href="${esc(wishlistHref)}" title="Wunschmodelle in Übersicht öffnen">W${esc(x.w)}</a>`;
    }else{
      statusHtml = `<span class="matrixMissing">–</span>`;
    }
    
    return `
      <tr>
        <td class="num">${statusHtml}</td>
        <td>
          <strong>${esc(x.label || x.t)}</strong>
          <div class="muted mono">${esc(x.t)}</div>
        </td>
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

  document.addEventListener("change", (ev) => {
    const el = ev.target;
  
    if(!el || !el.matches("input[type='checkbox']")){
      return;
    }
  
    if(
      el.id === "statusPresent" ||
      el.id === "statusOrdered" ||
      el.id === "statusWishlist" ||
      el.id === "statusMissing" ||
      el.id === "mStatusPresent" ||
      el.id === "mStatusOrdered" ||
      el.id === "mStatusWishlist" ||
      el.id === "mStatusMissing"
    ){
      renderDesktop();
      renderMobile();
    }
  });
}

main();
