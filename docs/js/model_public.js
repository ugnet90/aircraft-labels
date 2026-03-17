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

function boolDE(v){
  const s = asText(v).toLowerCase();
  return (s === "wahr" || s === "true" || s === "1" || s === "ja" || s === "yes" || s === "x");
}

function row(label, value, opts = {}){
  const txt = asText(value);
  if(!txt) return "";
  const cls = opts.mono ? "publicDataValue mono" : "publicDataValue";

  return `
    <div class="publicDataItem">
      <div class="publicDataLabel">${esc(label)}</div>
      <div class="${cls}">${esc(txt)}</div>
    </div>
  `;
}

function rowHtml(label, html, opts = {}){
  if(!html || !String(html).trim()) return "";
  const cls = opts.mono ? "publicDataValue mono" : "publicDataValue";

  return `
    <div class="publicDataItem">
      <div class="publicDataLabel">${esc(label)}</div>
      <div class="${cls}">${html}</div>
    </div>
  `;
}

// --- Aircraft photo enrichment (wie model.js) ---
let _aircraftPhotosEnrichedCache = null;

async function loadAircraftPhotosEnriched(){
  if(_aircraftPhotosEnrichedCache !== null) return _aircraftPhotosEnrichedCache;
  try{
    const res = await fetch("data/aircraft_photos_enriched.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    _aircraftPhotosEnrichedCache = (j && typeof j === "object") ? j : {};
  }catch(e){
    _aircraftPhotosEnrichedCache = {};
  }
  return _aircraftPhotosEnrichedCache;
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

// ---------- Logo / Quellen ----------
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
  if(link) return link;

  const id = String(d.logo.id || "").trim();
  if(id) return `./assets/logos/${encodeURIComponent(id)}.png`;

  return "";
}

function hostFromUrl(u){
  const s = String(u || "").trim();
  if(!s) return "";
  try{
    return new URL(s).hostname.replace(/^www\./, "");
  }catch(e){
    return "";
  }
}

function photoCopyright(credit, sourceUrl){
  const c = String(credit || "").trim();
  const host = hostFromUrl(sourceUrl);
  if(c && host) return `© ${c} / ${host}`;
  if(c) return `© ${c}`;
  if(host) return host;
  return "";
}

// ---------- V8 ----------
function renderV8Groups(v8){
  if(!v8 || typeof v8 !== "object") return "";

  const groups = [
    ["Basisdaten", [
      ["Hersteller", v8.manufacturer],
      ["Musterfamilie", v8.family],
      ["Flugzeugtyp", v8.type],
      ["ICAO-Typ", v8.icao_type],
      ["IATA-Typ", v8.iata_type],
      ["Kategorie", v8.category],
      ["Status", v8.status]
    ]],
    ["Abmessungen", [
      ["Länge", v8.length_m ? `${v8.length_m} m` : ""],
      ["Spannweite", v8.wingspan_m ? `${v8.wingspan_m} m` : ""],
      ["Höhe", v8.height_m ? `${v8.height_m} m` : ""]
    ]],
    ["Leistung", [
      ["Reichweite", v8.range_km ? `${v8.range_km} km` : ""],
      ["Reisegeschwindigkeit", v8.cruise_kmh ? `${v8.cruise_kmh} km/h` : ""],
      ["Max. Geschwindigkeit", v8.max_kmh ? `${v8.max_kmh} km/h` : ""]
    ]],
    ["Kapazität", [
      ["Besatzung", v8.crew],
      ["Passagiere", v8.passengers],
      ["Fracht", v8.cargo]
    ]],
    ["Antrieb", [
      ["Triebwerksart", v8.engine_type],
      ["Triebwerke", v8.engines],
      ["Hersteller", v8.engine_manufacturer]
    ]]
  ];

  const groupHtml = groups.map(([title, rows]) => {
    const body = rows
      .filter(([, value]) => asText(value))
      .map(([label, value]) => `
        <div class="publicDataItem">
          <div class="publicDataLabel">${esc(label)}</div>
          <div class="publicDataValue">${esc(asText(value))}</div>
        </div>
      `)
      .join("");

    if(!body) return "";

    return `
      <div style="margin-bottom:18px">
        <div class="publicSectionTitle">${esc(title)}</div>
        <div class="publicData">
          ${body}
        </div>
      </div>
    `;
  }).join("");

  return groupHtml;
}

async function main(){
  const id = asText(qs("id")).toUpperCase();

  if(!id){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">model_public.html?id=BA009</span></div>`;
    return;
  }

  const url = `./data/models/${encodeURIComponent(id)}.json`;

  try{
    const res = await fetch(url, { cache:"no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);

    const d = await res.json();
    const photosEnriched = await loadAircraftPhotosEnriched();
    const photoE = photosEnriched ? (photosEnriched[id] || null) : null;

    const airline = asText(d.airline_row) || asText(d.airline) || asText(d.airline_code);
    const typ = asText(d.aircraft_type) || asText(d.aircraft?.type);
    const reg = asText(d.registration) || asText(d.aircraft?.registration);
    const livery = asText(d.livery_name) || asText(d.livery?.code);
    const manufacturer = asText(d.manufacturer) || asText(d.model?.manufacturer);
    const brand = asText(d.brand) || asText(d.model?.brand);
    const scale = asText(d.model?.scale || d.scale);
    const material = asText(d.material) || asText(d.model?.material);
    const aircraftName = asText(d.aircraft_name);
    const extraInfo = asText(d.extra_info);
    const flown = !!(d.flown ?? d.model?.flown);

    document.title = airline
      ? `${airline} · ${typ || id}${reg ? ` · ${reg}` : ""}`
      : (typ || id);

    const logoSpeakingRaw = getLogoSpeaking(d);
    const logoSpeaking = logoSpeakingRaw ? boolDE(logoSpeakingRaw) : true;
    const showAirlineText = !logoSpeaking;

    const logoUrl = logoSrc(d);
    const logoHtml = logoUrl
      ? `<img class="publicAirlineLogo" src="${esc(logoUrl)}" alt="Logo">`
      : "";

    document.getElementById("title").innerHTML = `
      ${logoHtml}
      ${showAirlineText && airline ? `<div class="publicAirline">${esc(airline)}</div>` : ""}
      <div class="publicType">${esc(typ || id)}</div>
      ${reg ? `<div class="publicReg">${esc(reg)}</div>` : ""}
    `;

    document.getElementById("subtitle").textContent = livery || "";

    // WICHTIG: zuerst aircraft_photos_enriched.json
    let photoSource = asText(photoE?.source_url) || asText(d.photo_source_url) || asText(d.photo) || "";
    let photoImg    = asText(photoE?.thumb_url)  || asText(d.photo_image_url)  || "";
    let photoCredit = asText(d.photo_credit) || "";

    const copyright = photoCopyright(photoCredit, photoSource);

    const heroPhotoHtml = photoImg
      ? `
        <div class="publicPhotoBox">
          <a class="publicPhoto" href="${esc(photoSource || photoImg)}" target="_blank" rel="noopener" id="publicPhotoLink">
            <img src="${esc(photoImg)}" alt="Flugzeugfoto" loading="lazy" decoding="async">
          </a>
          ${copyright ? `<div class="publicCredit">${esc(copyright)}</div>` : ""}
        </div>
      `
      : "";

    const generalDataHtml = `
      <div class="publicInfo">
        <div class="publicSectionTitle">Allgemeine Daten</div>
        <div class="publicData">
          ${row("Airline", airline)}
          ${row("Flugzeugtyp", typ)}
          ${row("Registrierung", reg, { mono:true })}
          ${row("Hersteller", manufacturer)}
          ${row("Marke", brand)}
          ${row("Massstab", scale, { mono:true })}
          ${row("Material", material)}
          ${row("Taufname", aircraftName)}
          ${row("Bemalung", livery)}
          ${row("Zusatzinfo", extraInfo)}
          ${flown ? rowHtml("Mitgeflogen", "ja") : ""}
        </div>
      </div>
    `;

    const v8Table = renderV8Groups(d.aircraft_full_v8);

    const v8Block = v8Table
      ? `
        <div class="publicBlock">
          <div class="publicSectionTitle">Flugzeugdaten</div>
          <div style="margin-top:10px">
            ${v8Table}
          </div>
        </div>
      `
      : "";

    const footerNote = `
      <div class="publicNote">
        Öffentlich reduzierte Modellansicht.
      </div>
    `;

    document.getElementById("content").innerHTML = `
      <div class="publicStack">
        <div class="publicHeroCard">
          <div class="publicHero">
            ${heroPhotoHtml}
            ${generalDataHtml}
          </div>
        </div>
        ${v8Block}
        ${footerNote}
      </div>
    `;

    const photoLink = document.getElementById("publicPhotoLink");
    if(photoLink && photoImg){
      photoLink.addEventListener("click", (ev) => {
        ev.preventDefault();
        openLightbox(photoImg, photoSource || photoImg);
      });
    }

  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

document.addEventListener("DOMContentLoaded", main);
