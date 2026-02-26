function boolDE(v){
  const s = asText(v).toLowerCase();
  return (s === "wahr" || s === "true" || s === "1" || s === "ja" || s === "yes" || s === "x");
}

function getLogoSpeaking(d){
  // robust: Feld kann oben oder unter d.logo liegen
  const raw =
    asText(d?.logo_speaking) ||
    asText(d?.logo?.logo_speaking) ||
    asText(d?.logo?.speaking) ||
    asText(d?.logoSpeaking);

  return raw; // string (kann leer sein)
}

function logoSrc(d){
  if(!d || !d.logo) return "";

  const link = String(d.logo.link || "").trim();
  if(/^https?:\/\//i.test(link)) return link;

  // optional: lokale Logos (falls du sie später ablegst)
  const id = String(d.logo.id || "").trim();
  if(id) return `./assets/logos/${encodeURIComponent(id)}.png`;

  return "";
}

function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function firstNonEmpty(...vals){
  for(const v of vals){
    if(v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function rowFixed(label, value){
  const v = String(value ?? "").trim();
  // immer rendern, damit die Reihenfolge stabil bleibt
  return rowHtml(label, `<span style="opacity:${v ? "1" : ".55"}">${esc(v || "—")}</span>`);
}

function renderPostcardsCard(d, enrichedById){
  const enrich = enrichedById && typeof enrichedById === "object" ? enrichedById : {};
  const arr = Array.isArray(d?.postcards) ? d.postcards : [];
  if(!arr.length) return "";

  const rows = arr.map((pc, idx) => {
    const label = String(pc?.label ?? "").trim();
    const url   = String(pc?.url ?? "").trim();
    const price = pc?.price;

    const pcId = String(pc?.id ?? "").trim();
    const e = pcId ? (enrich[pcId] || null) : null;

    // thumbnail
    const thumbUrl = e && e.thumb_url ? String(e.thumb_url).trim() : "";
    const thumbHtml = thumbUrl
      ? `<a class="pc-thumb" href="${esc(url || thumbUrl)}" target="_blank" rel="noopener">
           <img src="${esc(thumbUrl)}" alt="Postkarte Thumbnail" loading="lazy">
         </a>`
      : "";

    let linkLabel = "Link";
    if(url){
      try{ linkLabel = (new URL(url)).hostname.replace(/^www\./, ""); }catch(err){ linkLabel = "Link"; }
    }

    const head = "";

    const labelRow = rowFixed("Info", label);

    // Hersteller + Größe aus Enrichment
    const manu = e?.aircraft_manufacturer || "";
    const sizeTxt = fmtSizeMm(e?.size_mm) || (e?.size || "");
    
    const manuRow = rowFixed("Hersteller", manu);
    const sizeRow = rowFixed("Grösse", sizeTxt);
    
    // Preis stabil (auch wenn leer)
    const priceRow = rowFixed("Preis", (price !== null && price !== undefined && Number(price) > 0) ? money(price) : "");

    return `
      <div class="pc-subcard">
        <div class="pc-row">
          ${thumbHtml}
          <div class="pc-body">
            <div class="grid">
              ${head}
              ${labelRow}
              ${manuRow}
              ${sizeRow}
              ${priceRow}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Total: du wolltest es eigentlich nicht mehr -> hier sicher deaktiviert
  const totalRow = "";
  const title = arr.length > 1 ? "Postkarten" : "Postkarte";
  
  return `
    <div class="card">
      <div class="k">${title}</div>
      <div style="margin-top:10px">
        ${rows}
        ${totalRow}
      </div>
    </div>
  `;
}

function scaleBadge(scale){
  const s = String(scale ?? "").trim();
  if(!s) return "";
  const isSpecial = (s !== "1:400");
  const cls = isSpecial ? "badge badge-warn mono" : "badge mono";
  return `<span class="${cls}">${esc(s)}</span>`;
}

function rowHtml(k, vHtml){
  if(vHtml === undefined || vHtml === null || vHtml === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${vHtml}</div></div>`;
}

function row(k,v){
  if(v === undefined || v === null || v === "") return "";
  return `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`;
}

function prettyHost(url){
  try{
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  }catch(e){
    return "";
  }
}

function linkText(url, preferred, fallback){
  const p = asText(preferred);
  if(p) return p;
  const h = prettyHost(url);
  if(h) return h;
  return fallback || "Link";
}

function aLink(url, preferredText, fallbackText){
  const u = asText(url);
  if(!u) return "";
  const t = linkText(u, preferredText, fallbackText);
  return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`;
}

function rowLink(label, url, preferredText, fallbackText){
  const h = aLink(url, preferredText, fallbackText);
  return h ? rowHtml(label, h) : "";
}

function linkRow(k, url){
  if(!url) return "";
  const safe = esc(url);
  return `<div><div class="k">${esc(k)}</div><div class="v"><a href="${safe}" target="_blank" rel="noopener">${safe}</a></div></div>`;
}

function formatDateDE(iso){
  if(!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

// Globale Währungs-Konfiguration
const CURRENCY = { symbol: "€", position: "before", space: true };

function money(v){
  // Fallback, falls CURRENCY aus irgendeinem Grund nicht global verfügbar ist
  const CUR = (typeof CURRENCY !== "undefined" && CURRENCY)
    ? CURRENCY
    : { symbol: "€", position: "before", space: true };

  if(v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if(!Number.isFinite(n)) return String(v);

  const amount = n.toFixed(2).replace(".", ",");
  const sp = CUR.space ? " " : "";

  return CUR.position === "before"
    ? `${CUR.symbol}${sp}${amount}`
    : `${amount}${sp}${CUR.symbol}`;
}

function boolBadge(v){
  if(v === true) return "ja";
  if(v === false) return "nein";
  return "";
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
    // schöner Linktext statt URL
    return `<a href="${safe}" target="_blank" rel="noopener">Wikipedia</a>`;
  }

  function row(label, valueHtml){
    if(!valueHtml) return "";
    return `<tr><td>${esc(label)}</td><td>${valueHtml}</td></tr>`;
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
        .map(([label, value]) => row(label, value))
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


function extractFirstHttpUrl(text){
  const s = String(text ?? "").trim();
  if(!s) return { prefix: "", url: "" };

  const m = s.match(/https?:\/\/\S+/i);
  if(!m) return { prefix: s, url: "" };

  const url = m[0];
  const prefix = s.replace(url, "").trim().replace(/[;,:]$/, "").trim();
  return { prefix, url };
}

function linkOrTextRow(label, raw){
  const s = String(raw ?? "").trim();
  if(!s) return "";

  const { prefix, url } = extractFirstHttpUrl(s);

  if(!url){
    // kein http -> reiner Text
    return row(label, s);
  }

  // schöner Linktext statt voller URL
  let linkLabel = "Link";
  try{
    const u = new URL(url);
    linkLabel = u.hostname.replace(/^www\./, "");
  }catch(e){
    linkLabel = "Link";
  }

  const prefixHtml = prefix ? `${esc(prefix)}<br>` : "";
  return rowHtml(
    label,
    `${prefixHtml}<a href="${esc(url)}" target="_blank" rel="noopener">${esc(linkLabel)}</a>`
  );
}

// --- Postcards enrichment (lazy) ---
let _postcardsEnrichedCache = null; // null=not loaded, {}=loaded/empty

async function loadPostcardsEnriched(){
  if(_postcardsEnrichedCache !== null) return _postcardsEnrichedCache;

  try{
    const res = await fetch("data/postcards_enriched.json", { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    _postcardsEnrichedCache = (j && typeof j === "object") ? j : {};
  }catch(e){
    _postcardsEnrichedCache = {};
  }
  return _postcardsEnrichedCache;
}

function fmtSizeMm(mm){
  if(!mm || typeof mm !== "object") return "";
  const w = Number(mm.w), h = Number(mm.h);
  if(!Number.isFinite(w) || !Number.isFinite(h)) return "";
  return `${w}×${h} mm`;
}

async function main(){
  const id = qs("id");
  const pill = document.getElementById("idpill");
  if(pill) pill.style.display = "none";
  document.getElementById("idpill").textContent = id ? `id=${id}` : "id=?";

  if(!id){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Keine <span class="mono">id</span> in der URL. Beispiel: <span class="mono">model.html?id=OS016</span></div>`;
    return;
  }

  const url = `./data/${encodeURIComponent(id)}.json`;

  try{
    const res = await fetch(url, {cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();

    const airline = asText(d.airline_row) || asText(d.airline) || asText(d.airline_code);
    const typ = asText(d.aircraft_type) || asText(d.aircraft?.type);
    const reg = asText(d.registration) || asText(d.aircraft?.registration);
    const livery = asText(d.livery_name) || asText(d.livery?.code);

    // Option A: Airline-Text nur wenn Logo NICHT "sprechend" ist
    const logoSpeakingRaw = getLogoSpeaking(d);

    // WICHTIG: Default = "sprechend" (damit Airline NICHT doppelt erscheint),
    // Airline nur anzeigen, wenn explizit als NICHT sprechend markiert
    const logoSpeaking = logoSpeakingRaw ? boolDE(logoSpeakingRaw) : true;
    const showAirlineText = !logoSpeaking;

    // temporär - dann wieder entfernen!
    document.getElementById("subtitle").textContent = `debug: logo_speaking="${logoSpeakingRaw}", parsed=${logoSpeaking}`;

    const titleMain = [
      typ,
      reg,
      d.aircraft_name ? `„${d.aircraft_name}“` : ""
    ].filter(Boolean).join(" · ") || id;

    document.title = showAirlineText && airline ? `${airline} · ${titleMain}` : titleMain;

    const logoUrl = logoSrc(d);
    const logoHtml = logoUrl
      ? `<img src="${esc(logoUrl)}" alt="Logo" style="height:44px;vertical-align:middle;margin-right:10px">`
      : "";

    document.getElementById("title").innerHTML = `
      <div class="headerWrap">
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
    `;

    // Bestellt-Hinweis
    const orderedAt = asText(d.ordered_at || "");
    const orderedText = (d.ordered && orderedAt) ? `Bestellt: ${formatDateDE(orderedAt)}` : "";
    const statusPill = document.getElementById("statuspill");
    const isOrderedNow = !!d.ordered && !!orderedAt && !asText(d.arrived);
    
    if(isOrderedNow){
      statusPill.style.display = "";
      statusPill.classList.add("ordered");
      statusPill.textContent = `Bestellt: ${formatDateDE(orderedAt)}`;
    }else{
      statusPill.style.display = "none";
      statusPill.textContent = "";
    }


    const sub = [
      (showAirlineText && airline) ? airline : "",
      livery ? `Livery: ${livery}` : "",
      d.livery_note ? `Bemalung: ${d.livery_note}` : "",
      orderedText
    ].filter(Boolean).join(" | ");

    document.getElementById("subtitle").textContent = "";

    // Blocks
    const modelBlock = `
      <div class="card sam ${isOrderedNow ? "ordered" : ""}">
        <div class="k">Sammlung</div>
        <div class="grid" style="margin-top:8px">
          ${rowHtml("Maßstab", scaleBadge(d.model?.scale || ""))}
          ${row("Hersteller", d.manufacturer || d.model?.manufacturer || "")}
          ${row("Artikel-/Modellnummer", d.model?.model_number || "")}
          ${row("Modell-Zusatz", d.model_extra || "")}
          ${linkOrTextRow("Shop", d.shop_url || d.shop || "")}
          ${row("Preis", money(d.price ?? d.model?.price))}
          ${row("Versand (anteilig)", money(d.shipping_allocated ?? d.model?.shipping_allocated))}
          ${row("Bestellt am", formatDateDE(d.ordered_at || ""))}
          ${row("Angekommen", formatDateDE(d.arrived || d.model?.arrived || ""))}
          ${row("Besonderheit", d.special_note || d.model?.special_note || "")}
        </div>
      </div>
    `;

    let postcardBlock = "";
    if(Array.isArray(d.postcards) && d.postcards.length){
      const enrichedById = await loadPostcardsEnriched();
      postcardBlock = renderPostcardsCard(d, enrichedById);
    }
    
    const aircraftBlock = `
      <div class="card">
        <div class="k">Flugzeug</div>
        <div class="grid" style="margin-top:8px">
          ${row("Flugzeugtyp", typ)}
          ${row("Registrierung", reg)}
          ${row("Taufname", d.aircraft_name || "")}
          ${row("Zusatzinfo", d.extra_info || "")}
          ${(d.flown ?? d.model?.flown) ? rowHtml("Mitgeflogen", `<span class="badge flown">✈️ ja</span>`) : ""}
          ${rowLink("Foto", d.photo || d.links?.photo || "", "", "Foto")}
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


    const linksBlock = "";
    
    // Optional: show raw source pointer
    const src = d.source ? `(${d.source.sheet || ""} #${d.source.row || ""})` : "";
    const sourceBlock = src ? `<div class="muted">Quelle: ${esc(src)}</div>` : "";

    const v8Table = renderV8Groups(d.aircraft_full_v8);

    const v8Block = v8Table ? `
      <div class="card">
        <div class="k">Flugzeugdaten</div>
        <div style="margin-top:10px">${v8Table}</div>
      </div>
    ` : "";

    const headBlock = `<div class="sectionGrid">${modelBlock}${aircraftBlock}</div>`;

    const tailBlocks = [liveryBlock, v8Block, sourceBlock]
      .filter(x => x && String(x).trim() !== "");
    
    const midBlocks = [postcardBlock].filter(x => x && String(x).trim() !== "");

    document.getElementById("content").innerHTML =
      `<div class="stack">` +
        `<div class="stackItem">${headBlock}</div>` +
        midBlocks.map(x => `<div class="stackItem">${x}</div>`).join("") +
        tailBlocks.map(x => `<div class="stackItem">${x}</div>`).join("") +
      `</div>`;
    
  }catch(e){
    document.getElementById("content").innerHTML =
      `<div class="err"><b>Fehler:</b> Konnte <span class="mono">${esc(url)}</span> nicht laden. (${esc(e.message)})</div>`;
  }
}

main();
