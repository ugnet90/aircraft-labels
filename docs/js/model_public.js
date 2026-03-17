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
  const s = String(v ?? "").trim().toLowerCase();
  if(["ja","yes","true","1","x"].includes(s)) return true;
  if(["nein","no","false","0"].includes(s)) return false;
  return !!v;
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

function rowHtml(label, html){
  if(!html || !String(html).trim()) return "";
  return `
    <div class="publicDataItem">
      <div class="publicDataLabel">${esc(label)}</div>
      <div class="publicDataValue">${html}</div>
    </div>
  `;
}

function logoSrc(d){
  const candidates = [
    d?.airline_logo,
    d?.logo,
    d?.airline?.logo,
    d?.airline_full?.Logo,
    d?.airline_full?.logo
  ].map(asText).filter(Boolean);

  return candidates[0] || "";
}

function getLogoSpeaking(d){
  return asText(
    d?.logo_speaking ??
    d?.airline_full?.Logo_Speaking ??
    d?.airline_full?.logo_speaking
  );
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

function buildAircraftPhotoHtml(d, photoE){
  const photoImg =
    asText(photoE?.thumb_url) ||
    asText(photoE?.image_url) ||
    asText(photoE?.url);

  const photoHref =
    asText(photoE?.source_url) ||
    asText(photoE?.url) ||
    photoImg;

  const copyright = asText(photoE?.copyright || photoE?.credit || "");

  if(!photoImg) return "";

  return `
    <div class="publicPhotoBox">
      <a class="publicPhoto" href="${esc(photoHref)}" target="_blank" rel="noopener">
        <img src="${esc(photoImg)}" alt="Flugzeugfoto" loading="lazy" decoding="async">
      </a>
      ${copyright ? `<div class="publicCredit">${esc(copyright)}</div>` : ""}
    </div>
  `;
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
    const scale = asText(d.scale) || asText(d.model?.scale);
    const material = asText(d.material) || asText(d.model?.material);
    const aircraftName = asText(d.aircraft_name);
    const extraInfo = asText(d.extra_info);
    const flown = (d.flown ?? d.model?.flown) ? true : false;

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
      ? `<img src="${esc(logoUrl)}" alt="Logo" style="height:44px;width:auto;max-width:220px;display:block;margin-bottom:10px;">`
      : "";

    document.getElementById("title").innerHTML = `
      ${logoHtml}
      ${showAirlineText && airline ? `${esc(airline)}<br>` : ""}
      ${esc(typ || id)}
      ${reg ? `<br><span style="font-size:.8em;font-weight:600">${esc(reg)}</span>` : ""}
    `;

    document.getElementById("subtitle").textContent = livery || "";

    const heroPhotoHtml =
      buildAircraftPhotoHtml(d, photoE) ||
      (photoUrlFromModel(d)
        ? `
          <div class="publicPhotoBox">
            <a class="publicPhoto" href="${esc(photoUrlFromModel(d))}" target="_blank" rel="noopener">
              <img src="${esc(photoUrlFromModel(d))}" alt="Modellfoto" loading="lazy">
            </a>
          </div>
        `
        : "");

    const publicDataHtml = `
      <div class="card">
        <div class="publicSectionTitle">Allgemeine Daten</div>
        <div class="publicData">
          ${row("Airline", airline)}
          ${row("Flugzeugtyp", typ)}
          ${row("Registrierung", reg, { mono:true })}
          ${row("Taufname", aircraftName)}
          ${row("Hersteller", manufacturer)}
          ${row("Marke", brand)}
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
        ${heroBlock}
        ${footerNote}
      </div>
    `;
  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

document.addEventListener("DOMContentLoaded", main);
