function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
}

function asText(v){
  return (v ?? "").toString().trim();
}

function rowHtml(k, vHtml){
  if(vHtml === undefined || vHtml === null || vHtml === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${vHtml}</div></div>`;
}

function row(k, v){
  if(v === undefined || v === null || v === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function money(v){
  if(v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v);
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function fmtSizeMm(mm){
  if(!mm || typeof mm !== "object") return "";
  const w = Number(mm.w), h = Number(mm.h);
  if(!Number.isFinite(w) || !Number.isFinite(h)) return "";
  return `${w}×${h} mm`;
}

async function loadPostcardIndex(){
  const res = await fetch("./data/postcards_index.json", { cache:"no-store" });
  if(!res.ok) throw new Error(`postcards_index.json HTTP ${res.status}`);
  return await res.json();
}

async function loadPostcardEnriched(){
  const res = await fetch("./data/postcards_enriched.json", { cache:"no-store" });
  if(!res.ok) throw new Error(`postcards_enriched.json HTTP ${res.status}`);
  return await res.json();
}

async function loadIndexIds(){
  const j = await loadPostcardIndex();
  const items = Array.isArray(j?.items) ? j.items : [];
  return items.map(it => String(it?.id || "").trim()).filter(Boolean);
}

function navNeighbors(ids, currentId){
  const cur = String(currentId || "").trim().toUpperCase();
  const i = ids.findIndex(x => String(x || "").trim().toUpperCase() === cur);

  if(i < 0) return { prev: "", next: "", pos: 0, total: ids.length };

  return {
    prev: i > 0 ? ids[i - 1] : "",
    next: i < ids.length - 1 ? ids[i + 1] : "",
    pos: i + 1,
    total: ids.length
  };
}

function buildNavHtml(prevId, nextId, pos, total){
  const prevHref = prevId ? `postcard.html?id=${encodeURIComponent(prevId)}` : "";
  const nextHref = nextId ? `postcard.html?id=${encodeURIComponent(nextId)}` : "";

  return `
    <div class="navWrap">
      <a class="navBtn ${prevId ? "" : "disabled"}" ${prevId ? `href="${prevHref}"` : ""} title="Vorherige Postkarte">←</a>
      <div class="navPos">${total ? `${pos}/${total}` : ""}</div>
      <a class="navBtn ${nextId ? "" : "disabled"}" ${nextId ? `href="${nextHref}"` : ""} title="Nächste Postkarte">→</a>
    </div>
  `;
}

function enableArrowKeys(prevId, nextId){
  document.addEventListener("keydown", (ev) => {
    const t = ev.target;
    const tag = (t && t.tagName) ? t.tagName.toLowerCase() : "";
    if(tag === "input" || tag === "textarea" || tag === "select") return;

    if(ev.key === "ArrowLeft" && prevId){
      window.location.href = `postcard.html?id=${encodeURIComponent(prevId)}`;
    }else if(ev.key === "ArrowRight" && nextId){
      window.location.href = `postcard.html?id=${encodeURIComponent(nextId)}`;
    }
  });
}

function ensureLightbox(){
  if(document.getElementById("lightbox")) return;

  const el = document.createElement("div");
  el.id = "lightbox";
  el.className = "lb";
  el.innerHTML = `
    <div class="lb-backdrop" data-close="1"></div>
    <div class="lb-panel" role="dialog" aria-modal="true">
      <button class="lb-close" type="button" aria-label="Schließen" data-close="1">×</button>
      <img class="lb-img" alt="Postkarte" />
      <div class="lb-actions">
        <a class="lb-open" href="#" target="_blank" rel="noopener">In neuem Tab öffnen</a>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  el.addEventListener("click", (ev) => {
    const t = ev.target;
    if(t && t.getAttribute && t.getAttribute("data-close") === "1"){
      closeLightbox();
    }
  });

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
  a.href = String(openUrl || "").trim() || src;

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

async function main(){
  const idRaw = qs("id");
  const id = String(idRaw || "").trim().toUpperCase();

  renderBreadcrumb([
    { label: "Dashboard", href: "./dashboard.html" },
    { label: "Postkarten", href: "./postcards_overview.html" },
    { label: id }
  ]);

  const pill = document.getElementById("idpill");
  if(pill) pill.style.display = "none";
  document.getElementById("idpill").textContent = id ? `id=${id}` : "id=?";

  if(!id){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">postcard.html?id=PC-LX007-01</span></div>`;
    return;
  }

  let prevId = "", nextId = "", pos = 0, total = 0;

  try{
    const ids = await loadIndexIds();
    const n = navNeighbors(ids, id);
    prevId = n.prev;
    nextId = n.next;
    pos = n.pos;
    total = n.total;
    enableArrowKeys(prevId, nextId);
  }catch(e){
    // Navigation optional
  }

  try{
    const [idx, enr] = await Promise.all([
      loadPostcardIndex(),
      loadPostcardEnriched()
    ]);

    const base = (Array.isArray(idx?.items) ? idx.items : []).find(it =>
      String(it?.id || "").trim().toUpperCase() === id
    );

    const e = enr && typeof enr === "object" ? (enr[id] || null) : null;

    if(!base && !e){
      throw new Error(`Postkarte ${id} nicht gefunden`);
    }

    const d = {
      ...(base || {}),
      ...(e || {}),
      id,
      postcard_id: id
    };

    const navHtml = (prevId || nextId) ? buildNavHtml(prevId, nextId, pos, total) : "";

    const titleMain = [
      asText(d.airline),
      asText(d.aircraft_type_exact) || asText(d.aircraft_type),
      asText(d.registration)
    ].filter(Boolean).join(" · ") || id;

    document.title = titleMain;

    document.getElementById("title").innerHTML = `
      <div class="headerWrap">
        <div class="headerLeft">
          <div class="headerTxt">
            <div class="hTyp">${esc(asText(d.airline) || "Postkarte")}</div>
            <div class="hMeta">
              ${asText(d.aircraft_type_exact) || asText(d.aircraft_type) ? `<span>${esc(asText(d.aircraft_type_exact) || asText(d.aircraft_type))}</span>` : ""}
              ${asText(d.registration) ? `<span> · ${esc(asText(d.registration))}</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("subtitle").textContent =
      asText(d.label) || asText(d.publisher_norm) || "";

    const imageHtml = asText(d.thumb_url)
      ? `
        <div class="card air-photo-box">
          <a href="${esc(asText(d.source_url) || asText(d.url) || asText(d.thumb_url))}"
             class="air-photo"
             target="_blank"
             rel="noopener"
             id="pcImageLink">
            <img class="air-thumb" src="${esc(asText(d.thumb_url))}" alt="${esc(id)}" loading="eager">
          </a>
          ${
            asText(d.source_url) || asText(d.url)
              ? `<div class="air-credit postcard"><a href="${esc(asText(d.source_url) || asText(d.url))}" target="_blank" rel="noopener">Quelle</a></div>`
              : ""
          }
        </div>
      `
      : "";

    const metaHtml = `
      <div class="card">
        <div class="k-nav">
          <div class="k">Metadaten</div>
          ${navHtml}
        </div>
        <div class="grid air-data postcard-meta-grid" style="margin-top:10px">
          ${row("Postkarten-ID", d.id)}
          ${row("Modell-ID", d.model_id)}
          ${rowHtml("Modell", d.model_id ? `<a href="./model.html?id=${encodeURIComponent(d.model_id)}">${esc(d.model_id)}</a>` : "")}
          ${row("Airline", d.airline)}
          ${row("Hersteller", d.aircraft_manufacturer)}
          ${row("Flugzeugtyp", d.aircraft_type)}
          ${row("Flugzeugtyp exakt", d.aircraft_type_exact)}
          ${row("Registrierung", d.registration)}
          ${row("Herausgeber", d.publisher_norm || d.publisher)}
          ${row("Jahr", d.year)}
          ${row("Größe", fmtSizeMm(d.size_mm) || d.size)}
          ${row("Zustand", d.condition)}
          ${row("Preis", money(d.price))}
          ${row("Info", d.label)}
          ${rowHtml("Shop / Quelle", (asText(d.source_url) || asText(d.url)) ? `<a href="${esc(asText(d.source_url) || asText(d.url))}" target="_blank" rel="noopener">Link öffnen</a>` : "")}
          ${row("Scraped", d.scraped_at_utc ? formatStandDE(d.scraped_at_utc) : "")}
        </div>
      </div>
    `;

    document.getElementById("content").innerHTML = `
      <div class="air-layout">
        ${imageHtml}
        ${metaHtml}
      </div>
    `;

    const imgLink = document.getElementById("pcImageLink");
    if(imgLink && d.thumb_url){
      imgLink.addEventListener("click", (ev) => {
        ev.preventDefault();
        openLightbox(d.thumb_url, d.source_url || d.url || d.thumb_url);
      });
    }

  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte Postkarte <span class="mono">${esc(id)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

document.addEventListener("DOMContentLoaded", main);
