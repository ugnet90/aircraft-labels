function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

let data = null;

function checked(id, fallback=true){
  const el = document.getElementById(id);
  return el ? !!el.checked : fallback;
}

function checkedOrDefault(id, fallback){
  const el = document.getElementById(id);
  return el ? el.checked : fallback;
}

function statusFilters(){
  return {
    present: checkedOrDefault("statusPresent", true),
    ordered: checkedOrDefault("statusOrdered", true),
    wishlist: checkedOrDefault("statusWishlist", true),
    missing: checkedOrDefault("statusMissing", true)
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

function getCell(pm, om, wm, rm, groupIdx, typeIdx){
  return {
    p: Number((pm[groupIdx] && pm[groupIdx][typeIdx]) || 0),
    o: Number((om[groupIdx] && om[groupIdx][typeIdx]) || 0),
    w: Number((wm[groupIdx] && wm[groupIdx][typeIdx]) || 0),
    r: Number((rm[groupIdx] && rm[groupIdx][typeIdx]) || 0)
  };
}

function cellMatchesFilters(p, o, w, r, filters){
  if(p > 0 && filters.present) return true;
  if(o > 0 && filters.ordered) return true;
  if(w > 0 && filters.wishlist) return true;

  if(r > 0 && p === 0 && o === 0 && w === 0 && filters.missing) {
    return true;
  }

  return false;
}

function renderMatrixCell(group, aircraftId, p, o, w, r, filters){
  const showPresent = p > 0 && filters.present;
  const showOrdered = o > 0 && filters.ordered;
  const showWishlist = w > 0 && filters.wishlist;

  const showMissing =
    r > 0 &&
    p === 0 &&
    o === 0 &&
    w === 0 &&
    filters.missing;

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
  }

  if(showOrdered){
    if(!showPresent && p === 0){
      parts.push(
        `<a href="${esc(baseHref)}" title="In Übersicht öffnen">0</a>`
      );
    }

    parts.push(
      `<a class="badgeOrdered" href="${esc(orderedHref)}" title="Bestellungen in Übersicht öffnen">+${esc(o)}</a>`
    );
  }

  if(showWishlist){
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

function renderDesktop(){
  if(!data) return;

  const airQ = (document.getElementById("airQ").value || "").trim().toLowerCase();
  const typeQ = (document.getElementById("typeQ").value || "").trim().toLowerCase();

  const airlines = data.groups || data.airlines || [];
  const types = data.types || [];
  const pm = data.present_matrix || data.matrix || [];
  const om = data.ordered_matrix || [];
  const wm = data.wishlist_matrix || [];
  const rm = data.relevant_matrix || [];
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
      const {p, o, w, r} = getCell(pm, om, wm, rm, x.idx, y.idx);
      return cellMatchesFilters(p, o, w, r, filters);
    });
  });

  const ai = aiRaw.filter(x => {
    return ti.some(y => {
      const {p, o, w, r} = getCell(pm, om, wm, rm, x.idx, y.idx);
      return cellMatchesFilters(p, o, w, r, filters);
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
      const {p, o, w, r} = getCell(pm, om, wm, rm, x.idx, y.idx);
      rowCells += renderMatrixCell(x.a, y.t, p, o, w, r, filters);
    }

    html += `<tr><td class="typeCol">${typeCellHtml(y.idx)}</td>${rowCells}</tr>`;
  }

  html += "</tbody>";

  document.getElementById("tbl").innerHTML = html;

  document.getElementById("meta").textContent =
    `${ai.length} Airlines · ${ti.length} Typen (aus ${airlines.length}×${types.length})`;
}

async function main(){
  const res = await fetch("./data/matrix.json", {cache:"no-store"});
  data = await res.json();

  renderDesktop();

  document.getElementById("airQ").addEventListener("input", renderDesktop);
  document.getElementById("typeQ").addEventListener("input", renderDesktop);

  [
    "statusPresent",
    "statusOrdered",
    "statusWishlist",
    "statusMissing"
  ].forEach(id => {
    const el = document.getElementById(id);
    if(el){
      el.addEventListener("change", renderDesktop);
      el.addEventListener("click", renderDesktop);
    }
  });
}

main();
