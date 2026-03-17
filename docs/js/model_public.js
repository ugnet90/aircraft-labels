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

function rowHtml(k, vHtml){
  if(vHtml === undefined || vHtml === null || vHtml === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${vHtml}</div></div>`;
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
    // schöner Linktext statt URL
    return `<a href="${safe}" target="_blank" rel="noopener">Wikipedia</a>`;
  }

  function row(label, valueHtml){
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

  // --- Gruppen ---
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
          return row(nl, nv);
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

function photoUrlFromModel(d){
  return asText(
    d?.model_photo_url ||
    d?.photo_url ||
    d?.image_url ||
    d?.images?.model ||
    d?.images?.main
  );
}

async function loadAircraftPhotosEnriched(){
  try{
    const res = await fetch("./data/aircraft_photos_enriched.json", { cache:"no-store" });
    if(!res.ok) return {};
    const j = await res.json();
    return (j && typeof j === "object") ? j : {};
  }catch(e){
    return {};
  }
}

function hostFromUrl(u){
  const s = String(u || "").trim();
  if(!s) return "";
  try { return (new URL(s)).hostname.replace(/^www\./,""); }
  catch(e){ return ""; }
}

function photoCopyright(credit, sourceUrl, imageUrl){
  const c = String(credit || "").trim();
  const host = hostFromUrl(sourceUrl) || hostFromUrl(imageUrl);
  if(c && host) return `© ${c} / ${host}`;
  if(c) return `© ${c}`;
  if(host) return host;
  return "";
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
    
    const photoSource = asText(photoE?.source_url) || asText(d.photo_source_url) || asText(d.photo) || "";
    const photoImg = asText(photoE?.thumb_url) || asText(d.photo_image_url) || "";
    const photoCredit = asText(d.photo_credit) || "";
    const copyright = photoCopyright(photoCredit, photoSource, photoImg);
    
    const heroPhotoHtml = photoImg
      ? `
        <div class="publicPhotoBox">
          <a class="publicPhoto" href="${esc(photoSource || photoImg)}" target="_blank" rel="noopener">
            <img src="${esc(photoImg)}" alt="Flugzeugfoto" loading="lazy" decoding="async">
          </a>
          ${copyright ? `<div class="publicCredit">${esc(copyright)}</div>` : ""}
        </div>
      `
      : "";

    const airline = asText(d.airline_row) || asText(d.airline) || asText(d.airline_code);
    const typ = asText(d.aircraft_type) || asText(d.aircraft?.type);
    const reg = asText(d.registration) || asText(d.aircraft?.registration);
    const aircraftName = asText(d.aircraft_name);

    const titleMain = [
      typ,
      reg,
      aircraftName ? `„${aircraftName}“` : ""
    ].filter(Boolean).join(" · ") || id;

    document.title = airline ? `${airline} · ${titleMain}` : titleMain;

    const logoSpeakingRaw = getLogoSpeaking(d);
    const logoSpeaking = logoSpeakingRaw ? boolDE(logoSpeakingRaw) : true;
    const showAirlineText = !logoSpeaking;
    
    const logoUrl = logoSrc(d);
    const logoHtml = logoUrl
      ? `<img class="publicAirlineLogo" src="${esc(logoUrl)}" alt="Logo">`
      : "";

    const v8Table = renderV8Groups(d.aircraft_full_v8);
    
    const v8Block = v8Table ? `
      <div class="card">
        <div class="publicSectionTitle">Flugzeugdaten</div>
        <div style="margin-top:10px">${v8Table}</div>
      </div>
    ` : "";
    
    document.getElementById("title").innerHTML = `
      ${logoHtml}
      ${showAirlineText && airline ? `<div class="publicAirline">${esc(airline)}</div>` : ""}
      <div class="publicType">${esc(typ || id)}</div>
      ${reg ? `<div class="publicReg">${esc(reg)}</div>` : ""}
    `;

    document.getElementById("subtitle").textContent = livery || "";

    const livery = asText(d.livery_name) || asText(d.livery?.code);
    const manufacturer = asText(d.manufacturer) || asText(d.model?.manufacturer);
    const scale = asText(d.model?.scale || d.scale);
    const material = asText(d.material) || asText(d.model?.material);
    const extraInfo = asText(d.extra_info);
    const flown = !!(d.flown ?? d.model?.flown);
    
    const publicDataHtml = `
      <div>
        <div class="publicSectionTitle">Allgemeine Daten</div>
        <div class="publicData">
          ${row("Airline", airline)}
          ${row("Flugzeugtyp", typ)}
          ${row("Registrierung", reg, { mono:true })}
          ${row("Taufname", aircraftName)}
          ${row("Hersteller", manufacturer)}
          ${row("Maßstab", scale, { mono:true })}
          ${row("Material", material)}
          ${row("Bemalung", livery)}
          ${row("Zusatzinfo", extraInfo)}
          ${flown ? rowHtml("Mitgeflogen", `<span class="badge flown">✈️ ja</span>`) : ""}
        </div>
      </div>
    `;

    const heroBlock = `
      <div class="card">
        <div class="publicHero">
          ${heroPhotoHtml}
          ${publicDataHtml}
        </div>
      </div>
    `;

    const footerNote = `
      <div class="publicNote">
        Öffentlich reduzierte Modellansicht.
      </div>
    `;

    document.getElementById("content").innerHTML = `
      <div class="publicStack">
        <div class="card">
          <div class="publicHero">
            ${heroPhotoHtml}
            ${publicDataHtml}
          </div>
        </div>
        ${v8Block}
      </div>
    `;
    
  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

document.addEventListener("DOMContentLoaded", main);
