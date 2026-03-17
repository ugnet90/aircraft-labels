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

function rowHtml(k, vHtml){
  if(vHtml === undefined || vHtml === null || vHtml === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${vHtml}</div></div>`;
}

function row(k,v){
  if(v === undefined || v === null || v === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function asText(v){
  return (v ?? "").toString().trim();
}

function renderV8Groups(obj){
  if(!obj || typeof obj !== "object") return "";

  function normListHtml(v){
    const s = String(v ?? "").trim();
    if(!s) return "";
    return s
      .split(/[|,]/g)
      .map(x => x.trim())
      .filter(Boolean)
      .join("<br>");
  }

  function translateWingtip(v){
    const x = String(v ?? "").trim().toUpperCase();
    const map = { "NONE":"Keine", "SL":"Sharklets", "WL":"Winglets", "RW":"Raked Wingtips" };
    return map[x] ? `${map[x]} (${x})` : esc(v);
  }

  function translateRumpf(v){
    const x = String(v ?? "").trim();
    const map = { "SingleAisle":"Schmalrumpf (Single Aisle)", "TwinAisle":"Großraum (Twin Aisle)" };
    return map[x] || esc(x);
  }

  function translateRole(v){
    const x = String(v ?? "").trim().toUpperCase();
    const map = { "PAX":"Passagierflugzeug (PAX)", "CARGO":"Frachtflugzeug (Cargo)" };
    return map[x] || esc(v);
  }

  function cellWiki(url){
    const u = String(url ?? "").trim();
    if(!u) return "";
    const safe = esc(u);
    return `<a href="${safe}" target="_blank" rel="noopener">Wikipedia</a>`;
  }

  function rowT(label, valueHtml){
    if(!valueHtml) return "";
    return `<tr><td>${esc(label)}</td><td>${valueHtml}</td></tr>`;
  }

  function normalizeUnit(label, valueHtml){
    const rawLabel = String(label ?? "").trim();
    const rawValue = String(valueHtml ?? "").trim();
    if(!rawLabel || !rawValue) return [rawLabel, rawValue];

    const m = rawLabel.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if(!m) return [rawLabel, rawValue];

    const cleanLabel = m[1].trim();
    const unit = m[2].trim();

    return [cleanLabel, `${rawValue} ${esc(unit)}`];
  }

  function val(key){
    const v = obj[key];
    if(v === undefined || v === null) return "";
    const s = String(v).trim();
    return s ? esc(s) : "";
  }

  const groups = [
    {
      title: "Codes",
      rows: [
        ["ICAO-Typcode", val("ICAO")],
        ["IATA-Typcode", val("IATA")],
        ["Wikipedia", cellWiki(obj["Wiki"])],
      ]
    },
    {
      title: "Betrieb",
      rows: [
        ["Rolle", translateRole(obj["Role"])],
        ["Segment", val("MarketSegment")],
        ["Rumpf (Kategorie)", translateRumpf(obj["Rumpf"])],
        ["Wingtip / Winglets / Sharklets", translateWingtip(obj["Wingtip"])],
        ["Erstflug", val("Erstflug")],
        ["Status", val("Status")],
        ["Antrieb", val("Antrieb")],
        ["Triebwerke", val("Triebwerke")],
        ["Reichweite (Kategorie)", val("Reichweite")],
        ["Passagiere", val("Passengers")],
      ]
    },
    {
      title: "Abmessungen",
      rows: [
        ["Länge (m)", val("Length")],
        ["Spannweite (m)", val("Wingspan")],
        ["Höhe (m)", val("Height")],
      ]
    },
    {
      title: "Typ",
      rows: [
        ["Flugzeugtyp", val("Typ_anzeige")],
        ["Hersteller", val("Hersteller")],
        ["Baureihe", val("Baureihe")],
        ["Unterserie", val("Unterserie")],
        ["Marketingname", val("Marketingname")],
        ["Alternative Bezeichnungen", normListHtml(obj["Alternate_designations"])],
        ["Übergeordneter Typ (ID)", val("parent_aircraft_id")],
      ]
    }
  ];

  const rendered = groups
    .map(g => {
      const body = g.rows
        .map(([label, value]) => {
          const [nl, nv] = normalizeUnit(label, value);
          return rowT(nl, nv);
        })
        .filter(Boolean)
        .join("");
      if(!body) return "";
      return `
        <div class="card">
          <div class="k">${esc(g.title)}</div>
          <div class="v" style="margin-top:8px">
            <table>${body}</table>
          </div>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  return rendered ? `<div class="masonry">${rendered}</div>` : "";
}

// --- Aircraft photo enrichment (lazy) ---
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

async function main(){
  const idRaw = qs("id");
  const id = String(idRaw || "").trim().toUpperCase();

  if(!id){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">model_public.html?id=OS016</span></div>`;
    return;
  }

  const url = `./data/models/${encodeURIComponent(id)}.json`;

  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const photosEnriched = await loadAircraftPhotosEnriched();
    const photoE = photosEnriched ? (photosEnriched[id] || null) : null;

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

    let photoSource = asText(d.photo_source_url) || asText(d.photo) || "";
    let photoImg    = asText(d.photo_image_url) || "";
    let photoCredit = asText(d.photo_credit) || "";

    const enrichedThumb = asText(photoE?.thumb_url);
    const enrichedSource = asText(photoE?.source_url);

    if(enrichedThumb && enrichedSource){
      photoImg = enrichedThumb;
      photoSource = enrichedSource;
    }

    const photoHref = photoSource || photoImg;
    const copyright = photoCredit
      ? photoCopyright(photoCredit, photoSource, photoImg)
      : "";

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

    const aircraftBlock = `
      <div class="card">
        <div class="k">Flugzeug</div>

        <div class="air-layout">
          ${aircraftPhotoHtml ? `
            <div class="air-photo-box">
              ${aircraftPhotoHtml}
            </div>
          ` : ""}

          <div class="air-data grid">
            ${row("Flugzeugtyp", typ)}
            ${row("Registrierung", reg)}
            ${row("Taufname", d.aircraft_name || "")}
            ${row("Zusatzinfo", d.extra_info || "")}
            ${(d.flown ?? d.model?.flown)
              ? rowHtml("Mitgeflogen", `<span class="badge flown">✈️ ja</span>`)
              : ""}
          </div>
        </div>
      </div>
    `;

    const liveryName = (d.livery_full?.Livery_Name || "").trim();
    const liveryType = (d.livery_full?.Livery_Type || "").trim();
    const liveryNotes = (d.livery_full?.Notes || "").trim();

    const hasLivery = !!liveryName || !!liveryType || !!liveryNotes || !!livery || !!(d.livery_note || "");
    const liveryBlock = !hasLivery ? "" : `
      <div class="card">
        <div class="k">Bemalung</div>
        <div class="sectionGrid" style="margin-top:8px">
          ${livery ? row("Code", livery) : ""}
          ${d.livery_note ? row("Hinweis", d.livery_note) : ""}
          ${liveryName ? row("Bezeichnung", liveryName) : ""}
          ${liveryType ? row("Typ", liveryType) : ""}
          ${liveryNotes ? row("Erläuterung", liveryNotes) : ""}
        </div>
      </div>
    `;

    const v8Table = renderV8Groups(d.aircraft_full_v8);

    const v8Block = v8Table ? `
      <div class="card">
        <div class="k">Flugzeugdaten</div>
        <div style="margin-top:10px">${v8Table}</div>
      </div>
    ` : "";

    const headBlock = `<div class="sectionGrid">${aircraftBlock}</div>`;
    const tailBlocks = [liveryBlock, v8Block].filter(x => x && String(x).trim() !== "");

    document.getElementById("content").innerHTML =
      `<div class="stack">` +
        `<div class="stackItem">${headBlock}</div>` +
        tailBlocks.map(x => `<div class="stackItem">${x}</div>`).join("") +
      `</div>`;

  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

main();
