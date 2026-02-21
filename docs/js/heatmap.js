// docs/heatmap.js
async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

function fmtInt(n) {
  return new Intl.NumberFormat("de-AT").format(n);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function fillTable(tableId, rows) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r[0]}</td><td class="col-num">${fmtInt(r[1])}</td>`;
    tbody.appendChild(tr);
  }
}

(async function init() {
  const [points, airportsMap, flights] = await Promise.all([
    fetchJson("data/flights_points.json"),
    fetchJson("data/airports.json"),
    fetchJson("data/flights.json"),
  ]);

  // KPIs
  function extractFlights(payload) {
    // 1) Direkt Array?
    if (Array.isArray(payload)) return payload;
  
    // 2) Rekursiv nach einem Array suchen, das wie "flights" aussieht
    // Heuristik: Array von Objekten, die (from/to) oder (date/from/to) enthalten.
    const seen = new Set();
    const queue = [{ value: payload, depth: 0 }];
  
    const isFlightLikeArray = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      // Prüfe nur die ersten paar Einträge
      const sample = arr.slice(0, 10);
      let hits = 0;
      for (const x of sample) {
        if (x && typeof x === "object" && !Array.isArray(x)) {
          const hasFromTo = typeof x.from === "string" && typeof x.to === "string";
          const hasDate = typeof x.date === "string";
          if (hasFromTo || (hasFromTo && hasDate) || (hasDate && x.from && x.to)) hits++;
        }
      }
      // mind. 1 "flight-like" object im sample reicht meist
      return hits >= 1;
    };
  
    while (queue.length) {
      const { value, depth } = queue.shift();
      if (value === null || value === undefined) continue;
      if (depth > 8) continue; // Sicherheitslimit
  
      if (typeof value !== "object") continue;
      if (seen.has(value)) continue;
      seen.add(value);
  
      // Wenn ein Objekt direkt Arrays als values hat -> prüfen
      for (const v of Object.values(value)) {
        if (Array.isArray(v) && isFlightLikeArray(v)) return v;
      }
  
      // Weiter in die Tiefe gehen (Objekte und Arrays)
      for (const v of Object.values(value)) {
        if (v && typeof v === "object") queue.push({ value: v, depth: depth + 1 });
      }
    }
  
    return [];
  }

  const flightsList = extractFlights(flights);
  const segments = flightsList.length;
  setText("kpiSegments", fmtInt(segments));
  setText("kpiAirports", fmtInt(points.length));

  // Countries KPI + Top Countries
  const countryCounts = new Map();
  for (const p of points) {
    const ap = airportsMap[p.iata];
    const c = ap && ap.country ? ap.country : "??";
    countryCounts.set(c, (countryCounts.get(c) || 0) + p.w);
  }
  setText("kpiCountries", fmtInt(countryCounts.size));

  // Top tables
  const topAirports = [...points]
    .sort((a, b) => b.w - a.w)
    .slice(0, 50)
    .map(p => [p.iata, p.w]);

  const topCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  fillTable("tblAirports", topAirports);
  fillTable("tblCountries", topCountries);

  // Map
  const map = L.map("map", { worldCopyJump: true }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  const heatLatLngs = points.map(p => [p.lat, p.lon, p.w]);

  let heat = L.heatLayer(heatLatLngs, {
    radius: Number(document.getElementById("radius").value),
    blur: Number(document.getElementById("blur").value),
    maxZoom: 6,
  }).addTo(map);

  // Fit bounds to points
  if (heatLatLngs.length) {
    const latlngs = points.map(p => [p.lat, p.lon]);
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds.pad(0.2));
  }

  // Controls
  function rebuildHeat() {
    map.removeLayer(heat);
    heat = L.heatLayer(heatLatLngs, {
      radius: Number(document.getElementById("radius").value),
      blur: Number(document.getElementById("blur").value),
      maxZoom: 6,
    }).addTo(map);
  }

  document.getElementById("radius").addEventListener("input", rebuildHeat);
  document.getElementById("blur").addEventListener("input", rebuildHeat);
})();
