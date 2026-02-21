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
    if (Array.isArray(payload)) return payload;

    if (payload && typeof payload === "object") {
      // common wrappers
      for (const key of ["flights", "items", "data", "rows", "records"]) {
        if (Array.isArray(payload[key])) return payload[key];
      }
      // fallback: exactly one array value
      const arrays = Object.values(payload).filter(v => Array.isArray(v));
      if (arrays.length === 1) return arrays[0];
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
