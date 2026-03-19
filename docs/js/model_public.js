function boolDE(v){
  const s = asText(v).toLowerCase();
  return (s === "wahr" || s === "true" || s === "1" || s === "ja" || s === "yes" || s === "x");
}

function getLogoSpeaking(d){
  const raw =
    asText(d?.logo_speaking) ||
    asText(d?.logo?.logo_speaking) ||
    asText(d?.logo?.speaking) ||
    asText(d?.logoSpeaking);

  return raw;
}

function logoSrc(d){
  if(!d || !d.logo) return "";

  const link = String(d.logo.link || "").trim();
  if(/^https?:\/\//i.test(link)) return link;

  const id = String(d.logo.id || "").trim();
  if(id) return `./assets/logos/${encodeURIComponent(id)}.png`;

  return "";
}

function hostFromUrl(u){
  const s = String(u || "").trim();
  if(!s) return "";
  try { return (new URL(s)).hostname.replace(/^www\./,""); }
  catch(e){ return ""; }
}

function hostLabel(u){
  const s = String(u || "").trim();
  if(!s) return "";
  try{
    return new URL(s).hostname.replace(/^www\./,"");
  }catch(e){
    return "Foto";
  }
}

function photoCopyright(credit, sourceUrl, imageUrl){
  const c = String(credit || "").trim();
  const host = hostFromUrl(sourceUrl) || hostFromUrl(imageUrl);
  if(c && host) return `© ${c} / ${host}`;
  if(c) return `© ${c}`;
  if(host) return host;
  return "";
}

function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

async function loadSameAirlineIndexIds(currentModel){
  const res = await fetch("./index.json", { cache:"no-store" });
  if(!res.ok) throw new Error(`index.json HTTP ${res.status}`);
  const j = await res.json();

  let items = [];
  if(Array.isArray(j)){
    items = j;
  }else if(Array.isArray(j?.items)){
    items = j.items;
  }else if(Array.isArray(j?.index)){
    items = j.index;
  }else if(Array.isArray(j?.models)){
    items = j.models;
  }else{
    for(const k of Object.keys(j || {})){
      if(Array.isArray(j[k])) { items = j[k]; break; }
    }
  }

  const currentAirlineCode = String(currentModel?.airline_code || "").trim().toUpperCase();
  const currentAirline = String(currentModel?.airline || "").trim().toUpperCase();
  const currentAirlineRow = String(currentModel?.airline_row || "").trim().toUpperCase();

  const ids = [];

  for(const it of items){
    const id = String(it?.model_id ?? it?.id ?? "").trim();
    if(!id) continue;

    const itAirlineCode = String(it?.airline_code || "").trim().toUpperCase();
    const itAirline = String(it?.airline || "").trim().toUpperCase();
    const itAirlineRow = String(it?.airline_row || "").trim().toUpperCase();

    let sameAirline = false;

    if(currentAirlineCode && itAirlineCode){
      sameAirline = (itAirlineCode === currentAirlineCode);
    }else if(currentAirlineRow && itAirlineRow){
      sameAirline = (itAirlineRow === currentAirlineRow);
    }else if(currentAirline && itAirline){
      sameAirline = (itAirline === currentAirline);
    }else if(currentAirlineCode){
      // Fallback: model_id-Präfix, z. B. AB002 -> AB
      sameAirline = id.toUpperCase().startsWith(currentAirlineCode);
    }

    if(sameAirline){
      ids.push(id);
    }
  }

  return ids;
}

function buildNavHtml(prevId, nextId, pos, total){
  const prevHref = prevId ? `model_public.html?id=${encodeURIComponent(prevId)}` : "";
  const nextHref = nextId ? `model_public.html?id=${encodeURIComponent(nextId)}` : "";

  return `
    <div class="navWrap">
      <a class="navBtn ${prevId ? "" : "disabled"}" ${prevId ? `href="${prevHref}"` : ""} title="Vorheriges Modell">←</a>
      <div class="navPos">${total ? `${pos}/${total}` : ""}</div>
      <a class="navBtn ${nextId ? "" : "disabled"}" ${nextId ? `href="${nextHref}"` : ""} title="Nächstes Modell">→</a>
    </div>
  `;
}

function enableArrowKeys(prevId, nextId){
  document.addEventListener("keydown", (ev) => {
    const t = ev.target;
    const tag = (t && t.tagName) ? t.tagName.toLowerCase() : "";
    if(tag === "input" || tag === "textarea" || tag === "select") return;

    if(ev.key === "ArrowLeft" && prevId){
      window.location.href = `model_public.html?id=${encodeURIComponent(prevId)}`;
    }else if(ev.key === "ArrowRight" && nextId){
      window.location.href = `model_public.html?id=${encodeURIComponent(nextId)}`;
    }
  });
}

function rowHtml(k, vHtml){
  if(vHtml === undefined || vHtml === null || vHtml === "") return "";
  return `
    <div class="kvInlineRow">
      <span class="kvInlineLabel">${esc(k)}:</span>
      <span class="kvInlineValue">${vHtml}</span>
    </div>
  `;
}

function row(k, v){
  if(v === undefined || v === null || v === "") return "";
  return `
    <div class="kvInlineRow">
      <span class="kvInlineLabel">${esc(k)}:</span>
      <span class="kvInlineValue">${esc(v)}</span>
    </div>
  `;
}

function asText(v){
  return (v ?? "").toString().trim();
}

function formatNumberDE(v, digits = 2){
  const s = String(v ?? "").trim();
  if(!s) return "";

  const n = Number(s.replace(",", "."));
  if(!isFinite(n)) return s;

  return n.toFixed(digits).replace(".", ",");
}

function renderV8Groups(obj){
  if(!obj || typeof obj !== "object") return "";

  function translateWingtip(v){
    const x = String(v ?? "").trim().toUpperCase();
    const map = { "NONE":"Keine", "SL":"Sharklets", "WL":"Winglets", "RW":"Raked Wingtips" };
    return map[x] || esc(v);
  }

  function translateRumpf(v){
    const x = String(v ?? "").trim();
    const map = {
      "SingleAisle":"Schmalrumpf (Single Aisle)",
      "TwinAisle":"Großraum (Twin Aisle)"
    };
    return map[x] || esc(x);
  }

  function translateRole(v){
    const x = String(v ?? "").trim().toUpperCase();
    const map = {
      "PAX":"Passagierflugzeug (PAX)",
      "CARGO":"Frachtflugzeug (Cargo)"
    };
    return map[x] || esc(v);
  }

  function cellWiki(url){
    const u = String(url ?? "").trim();
    if(!u) return "";
    return `<a href="${esc(u)}" target="_blank" rel="noopener">Wikipedia</a>`;
  }

  function groupRow(label, valueHtml){
    if(!valueHtml) return "";
    return `
      <div class="kvInlineRow">
        <span class="kvInlineLabel">${esc(label)}:</span>
        <span class="kvInlineValue">${valueHtml}</span>
      </div>
    `;
  }

  const groups = [
    {
      title: "Typ",
      rows: [
        ["Flugzeugtyp", esc(String(obj["Typ_anzeige"] || "").trim())],
        ["Hersteller", esc(String(obj["Hersteller"] || "").trim())],
        ["Baureihe", esc(String(obj["Baureihe"] || "").trim())],
        ["Unterserie", esc(String(obj["Unterserie"] || "").trim())],
        ["ICAO-Typcode", esc(String(obj["ICAO"] || "").trim())],
        ["IATA-Typcode", esc(String(obj["IATA"] || "").trim())],
        ["Wikipedia", cellWiki(obj["Wiki"])]
      ]
    },
    {
      title: "Abmessungen",
      rows: [
        ["Länge", formatNumberDE(obj["Length"], 2) ? `${formatNumberDE(obj["Length"], 2)} m` : ""],
        ["Spannweite", formatNumberDE(obj["Wingspan"], 2) ? `${formatNumberDE(obj["Wingspan"], 2)} m` : ""],
        ["Höhe", formatNumberDE(obj["Height"], 2) ? `${formatNumberDE(obj["Height"], 2)} m` : ""]
      ]
    },
    {
      title: "Betrieb",
      rows: [
        ["Rolle", translateRole(obj["Role"])],
        ["Segment", esc(String(obj["MarketSegment"] || "").trim())],
        ["Rumpf", translateRumpf(obj["Rumpf"])],
        ["Wingtip", translateWingtip(obj["Wingtip"])],
        ["Erstflug", esc(String(obj["Erstflug"] || "").trim())],
        ["Status", esc(String(obj["Status"] || "").trim())],
        ["Antrieb", esc(String(obj["Antrieb"] || "").trim())],
        ["Triebwerke", esc(String(obj["Triebwerke"] || "").trim())],
        ["Reichweite", esc(String(obj["Reichweite"] || "").trim())],
        ["Passagiere", esc(String(obj["Passengers"] || "").trim())]
      ]
    }
  ];

  const html = groups.map(group => {
    const rows = group.rows
      .map(([label, value]) => groupRow(label, value))
      .filter(Boolean)
      .join("");

    if(!rows) return "";

    return `
      <section class="publicGroup">
        <h3 class="publicGroupTitle">${esc(group.title)}</h3>
        <div class="publicGroupGrid">
          ${rows}
        </div>
      </section>
    `;
  }).join("");

  return html;
}

function calcModelSizeCm(realMeters, scale){
  const m = Number(String(realMeters ?? "").replace(",", "."));
  if(!isFinite(m) || !scale) return "";

  const s = String(scale).replace("1:", "");
  const n = Number(s);
  if(!isFinite(n) || n <= 0) return "";

  return (m * 100 / n).toFixed(1).replace(".", ",");
}

// ---------- Lightbox ----------
function ensureLightbox(){
  if(document.getElementById("lightbox")) return;

  const el = document.createElement("div");
  el.id = "lightbox";
  el.className = "lb";
  el.innerHTML = `
    <div class="lb-backdrop" data-close="1"></div>
    <div class="lb-panel" role="dialog" aria-modal="true">
      <button class="lb-close" type="button" aria-label="Schließen" data-close="1">×</button>
      <img class="lb-img" alt="Foto" />
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
  a.href = (String(openUrl || "").trim() || src);

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

  if(!id){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">model_public.html?id=OS016</span></div>`;
    return;
  }

  let prevId = "", nextId = "", pos = 0, total = 0;
  try{
    const ids = await loadSameAirlineIndexIds(d);
    const n = navNeighbors(ids, id);
    prevId = n.prev;
    nextId = n.next;
    pos = n.pos;
    total = n.total;
    enableArrowKeys(prevId, nextId);
  }catch(e){
    // index.json not critical
  }
  
  const url = `./data/models/${encodeURIComponent(id)}.json`;

  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const airline = asText(d.airline_row) || asText(d.airline) || asText(d.airline_code);
    const typ = asText(d.aircraft_type) || asText(d.aircraft?.type);
    const reg = asText(d.registration) || asText(d.aircraft?.registration);
    const livery = asText(d.livery_name) || asText(d.livery?.code);

    const logoSpeakingRaw = getLogoSpeaking(d);
    const logoSpeaking = logoSpeakingRaw ? boolDE(logoSpeakingRaw) : true;
    const showAirlineText = !logoSpeaking;

    const titleMain = [
      typ,
      reg,
      d.aircraft_name ? `„${d.aircraft_name}“` : ""
    ].filter(Boolean).join(" · ") || id;

    document.title = showAirlineText && airline ? `${airline} · ${titleMain}` : titleMain;

    const logoUrl = logoSrc(d);
    const logoHtml = logoUrl
      ? `<img class="airlineLogo" src="${esc(logoUrl)}" alt="Logo">`
      : "";
    const navHtml = (prevId || nextId) ? buildNavHtml(prevId, nextId, pos, total) : "";
    
    document.getElementById("title").innerHTML = `
      <div class="headerWrap">
        <div class="headerLeft">
          ${logoHtml}
          <div class="headerTxt">
            ${showAirlineText && airline ? `<div class="hAir">${esc(airline)}</div>` : ""}
            <div class="hTyp">${esc(typ || id)}</div>
            <div class="hMeta">
              ${reg ? `<span class="hReg">${esc(reg)}</span>` : ""}
              ${d.aircraft_name ? `<span class="hName">„${esc(d.aircraft_name)}“</span>` : ""}
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("subtitle").textContent = "";

    // Foto NUR aus <model_id>.json
    const photoSource = asText(d.photo_source_url) || asText(d.photo) || "";
    const photoImg    = asText(d.photo_image_url) || "";
    const photoCredit = asText(d.photo_credit) || "";

    const photoHref = photoSource || photoImg;
    const copyright = photoCredit
      ? photoCopyright(photoCredit, photoSource, photoImg)
      : "";

    const scale = asText(d.model?.scale || d.scale);
    const manufacturer = asText(d.model?.manufacturer || d.manufacturer);
    
    const lengthCm = calcModelSizeCm(d.aircraft_full_v8?.Length, scale);
    const wingspanCm = calcModelSizeCm(d.aircraft_full_v8?.Wingspan, scale);
    const heightCm = calcModelSizeCm(d.aircraft_full_v8?.Height, scale);
    
    const aircraftPhotoHtml = photoImg
      ? `<div class="air-photo">
           <img class="air-thumb"
             src="${esc(photoImg)}"
             alt="Aircraft photo"
             loading="lazy"
             decoding="async"
             fetchpriority="low"
             style="cursor: zoom-in"
             onclick="openLightbox('${esc(photoImg)}','${esc(photoHref || photoImg)}')">
           ${copyright ? `<div class="air-credit">${esc(copyright)}</div>` : ``}
         </div>`
      : (photoSource
          ? `<a href="${esc(photoSource)}" target="_blank" rel="noopener">
              ${esc(hostLabel(photoSource))}
            </a>${copyright ? `<div class="air-credit">${esc(copyright)}</div>` : ``}`
          : "");

    const modelBlock = `
      <div class="card">
        <div class="k">
            <span>Sammelmodell</span>
            <div class="headerRight">
              ${navHtml}
            </div>

        </div>
        <div class="publicModelRow">
          <div class="modelInline">${row("Hersteller", manufacturer)}</div>
          <div class="modelInline">${row("Maßstab", scale)}</div>
          <div class="modelInline">${row("Länge", lengthCm ? `${lengthCm} cm` : "")}</div>
          <div class="modelInline">${row("Spannweite", wingspanCm ? `${wingspanCm} cm` : "")}</div>
          <div class="modelInline">${row("Höhe", heightCm ? `${heightCm} cm` : "")}</div>
        </div>
      </div>
    `;
    
    const liveryName = (d.livery_full?.Livery_Name || "").trim();
    const liveryType = (d.livery_full?.Livery_Type || "").trim();
    const liveryNotes = (d.livery_full?.Notes || "").trim();
    
    const hasLivery = !!liveryName || !!liveryType || !!liveryNotes || !!(d.livery_note || "");
    
    const aircraftBlock = `
      <div class="card">
        <div class="k">Original-Flugzeug</div>
    
        <div class="publicAircraftTop">
          <section class="publicSubgroup">
            <h3 class="publicGroupTitle">Foto</h3>
            <div class="air-photo-only">
              ${aircraftPhotoHtml || ""}
            </div>
          </section>
    
          <section class="publicSubgroup">
            <h3 class="publicGroupTitle">Bemalung</h3>
            ${
              hasLivery
                ? `
                  <div class="publicLiveryRows">
                    ${d.livery_note ? row("Hinweis", d.livery_note) : ""}
                    ${liveryName ? row("Bezeichnung", liveryName) : ""}
                    ${liveryType ? row("Typ", liveryType) : ""}
                    ${liveryNotes ? `
                      <div class="kvInlineRow kvInlineRow--stack">
                        <span class="kvInlineLabel">Erläuterung:</span>
                        <span class="kvInlineValue">${esc(liveryNotes)}</span>
                      </div>
                    ` : ""}
                  </div>
                `
                : `<div class="publicEmpty">Keine Angaben</div>`
            }
          </section>
        </div>
      </div>
    `;
    
    const v8Table = renderV8Groups(d.aircraft_full_v8);
    
    const techBlock = v8Table ? `
      <div class="card">
        <div class="k">Technische Daten</div>
        <div style="margin-top:10px">
          ${v8Table}
        </div>
      </div>
    ` : "";
    
    document.getElementById("content").innerHTML = `
      <div class="stack">
        <div class="stackItem">${modelBlock}</div>
        <div class="stackItem">${aircraftBlock}</div>
        ${techBlock ? `<div class="stackItem">${techBlock}</div>` : ""}
      </div>
    `;
    
  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

main();
