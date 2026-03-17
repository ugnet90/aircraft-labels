function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => (
    {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]
  ));
}

function asText(v){
  return (v ?? "").toString().trim();
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

function metaRow(label, value, opts = {}){
  if(value === undefined || value === null || value === "") return "";
  const cls = opts.mono ? "postcard-metaValue mono" : "postcard-metaValue";
  return `
    <div class="postcard-metaItem">
      <div class="postcard-metaLabel">${esc(label)}</div>
      <div class="${cls}">${value}</div>
    </div>
  `;
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
    <div class="postcard-nav">
      <a class="postcard-navBtn ${prevId ? "" : "disabled"}" ${prevId ? `href="${prevHref}"` : ""} title="Vorherige Postkarte">←</a>
      <div class="postcard-navPos">${total ? `${pos}/${total}` : ""}</div>
      <a class="postcard-navBtn ${nextId ? "" : "disabled"}" ${nextId ? `href="${nextHref}"` : ""} title="Nächste Postkarte">→</a>
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

  setPageTitle("Postkarte", id);
  
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
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">postcard.html?id=PC-AB003-01</span></div>`;
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

    document.title = id;

    document.getElementById("title").innerHTML = `
      <div class="pc-titleWrap">
        <div class="pc-titleAirline">${esc(asText(d.airline) || "Postkarte")}</div>
        <div class="pc-titleMeta">
          ${esc(
            [
              asText(d.aircraft_type_exact) || asText(d.aircraft_type),
              asText(d.registration)
            ].filter(Boolean).join(" · ")
          )}
        </div>
      </div>
    `;

    const imageHtml = asText(d.thumb_url)
      ? `
        <div class="postcard-photoCard">
          <a
            href="${esc(asText(d.source_url) || asText(d.url) || asText(d.thumb_url))}"
            class="postcard-photoLink"
            target="_blank"
            rel="noopener"
            id="pcImageLink"
          >
            <img class="postcard-thumb" src="${esc(asText(d.thumb_url))}" alt="${esc(id)}" loading="eager">
          </a>
          ${
            asText(d.source_url) || asText(d.url)
              ? `<div class="postcard-credit"><a href="${esc(asText(d.source_url) || asText(d.url))}" target="_blank" rel="noopener"><i>Quelle</i></a></div>`
              : ""
          }
        </div>
      `
      : "";

    const scraped = d.scraped_at_utc
      ? (typeof formatStandDE === "function" ? formatStandDE(d.scraped_at_utc) : d.scraped_at_utc)
      : "";

    const metaHtml = `
      <div class="postcard-card">
        <div class="postcard-sectionHead">
          <div class="postcard-sectionTitle">${esc(asText(d.label))}</div>
          ${navHtml}
        </div>
        <div class="postcard-meta-grid">
          ${d.model_id
            ? metaRow(
                "Sammelmodell",
                `<a class="postcard-linkBack" href="./model.html?id=${encodeURIComponent(d.model_id)}">${esc(d.model_id)}</a>`
              )
            : ""
          }
        
          ${metaRow("Herausgeber", esc(d.publisher_norm || d.publisher || ""))}
          ${metaRow("Airline", esc(d.airline || ""))}
          ${metaRow("Jahr", esc(d.year || ""), { mono:true })}
          ${metaRow("Hersteller", esc(d.aircraft_manufacturer || ""))}
          ${metaRow("Größe", esc(fmtSizeMm(d.size_mm) || d.size || ""), { mono:true })}
          ${metaRow("Flugzeugtyp", esc(d.aircraft_type || ""))}
          ${metaRow("Zustand", esc(d.condition || ""))}
          ${metaRow("Flugzeugtyp exakt", esc(d.aircraft_type_exact || ""))}
          ${metaRow("Preis", esc(money(d.price)), { mono:true })}
          ${metaRow("Registrierung", esc(d.registration || ""), { mono:true })}
          ${metaRow("Shop / Quelle", (asText(d.source_url) || asText(d.url))
            ? `<a href="${esc(asText(d.source_url) || asText(d.url))}" target="_blank" rel="noopener">Link öffnen</a>`
            : ""
          )}
          ${metaRow("Scraped", esc(scraped))}
</div>
      </div>
    `;

    document.getElementById("content").innerHTML = `
      <div class="postcard-layout">
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
