// docs/js/heatmap.js

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

// Robust: find flights array anywhere in payload (deep nesting)
function extractFlights(payload) {
  if (Array.isArray(payload)) return payload;

  const seen = new Set();
  const queue = [{ value: payload, depth: 0 }];

  const isFlightLikeArray = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const sample = arr.slice(0, 10);
    let hits = 0;
    for (const x of sample) {
      if (x && typeof x === "object" && !Array.isArray(x)) {
        const hasFrom = typeof x.from === "string";
        const hasTo = typeof x.to === "string";
        const hasDate = typeof x.date === "string";
        if ((hasFrom && hasTo) || (hasFrom && hasTo && hasDate) || (hasDate && x.from && x.to)) hits++;
      }
    }
    return hits >= 1;
  };

  while (queue.length) {
    const { value, depth } = queue.shift();
    if (value === null || value === undefined) continue;
    if (depth > 10) continue;

    if (typeof value !== "object") continue;
    if (seen.has(value)) continue;
    seen.add(value);

    for (const v of Object.values(value)) {
      if (Array.isArray(v) && isFlightLikeArray(v)) return v;
    }
    for (const v of Object.values(value)) {
      if (v && typeof v === "object") queue.push({ value: v, depth: depth + 1 });
    }
  }

  return [];
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

(async function init() {
  const [points, airportsMap, flightsPayload, routes] = await Promise.all([
    fetchJson("data/flights_points.json"),
    fetchJson("data/airports.json"),
    fetchJson("data/flights.json"),
    fetchJson("data/flights_routes.json"),
  ]);

  // --- KPIs ---
  const flightsList = extractFlights(flightsPayload);
  setText("kpiSegments", fmtInt(flightsList.length));
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
    .map((p) => [p.iata, p.w]);

  const topCountries = [...countryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  fillTable("tblAirports", topAirports);
  fillTable("tblCountries", topCountries);

  // --- Map base ---
  const map = L.map("map", { worldCopyJump: true }).setView([20, 0], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // --- Heat layer ---
  const heatLatLngs = points.map((p) => [p.lat, p.lon, p.w]);

  function makeHeatLayer() {
    return L.heatLayer(heatLatLngs, {
      radius: Number(document.getElementById("radius").value),
      blur: Number(document.getElementById("blur").value),
      maxZoom: 6,
    });
  }

  let heat = makeHeatLayer().addTo(map);

  // Fit bounds to points
  if (heatLatLngs.length) {
    const latlngs = points.map((p) => [p.lat, p.lon]);
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds.pad(0.2));
  }

  function rebuildHeat() {
    if (map.hasLayer(heat)) map.removeLayer(heat);
    heat = makeHeatLayer();
    // do not add here; applyViewMode decides
    applyViewMode();
  }

  // --- Routes layer ---
  const routesLayer = L.layerGroup().addTo(map);

  function renderRoutes() {
    routesLayer.clearLayers();

    const maxRoutesEl = document.getElementById("maxRoutes");
    const maxRoutesLabelEl = document.getElementById("maxRoutesLabel");

    const maxRoutes = maxRoutesEl ? Number(maxRoutesEl.value) : 300;
    if (maxRoutesLabelEl) maxRoutesLabelEl.textContent = String(maxRoutes);

    const list = Array.isArray(routes) ? routes.slice(0) : [];
    list.sort((x, y) => (y.w || 0) - (x.w || 0));

    const slice = list.slice(0, maxRoutes);
    if (!slice.length) return;

    const maxW = slice[0].w || 1;

    for (const r of slice) {
      const w = r.w || 1;

      // thickness/opacity scaling (leave default Leaflet color)
      const weight = clamp(1 + 6 * Math.sqrt(w / maxW), 1, 7);
      const opacity = clamp(0.15 + 0.75 * (w / maxW), 0.15, 0.9);

      const latlngs = [
        [r.a_lat, r.a_lon],
        [r.b_lat, r.b_lon],
      ];

      const line = L.polyline(latlngs, { weight, opacity });
      line.bindTooltip(`${r.a}-${r.b}: ${fmtInt(w)}`, { sticky: true });
      line.addTo(routesLayer);
    }
  }

  renderRoutes();

  // --- View toggle ---
  function applyViewMode() {
    const modeEl = document.getElementById("viewMode");
    const mode = modeEl ? modeEl.value : "combined";

    const showHeat = mode === "airports" || mode === "combined";
    const showRoutes = mode === "routes" || mode === "combined";

    if (showHeat) {
      if (!map.hasLayer(heat)) heat.addTo(map);
    } else {
      if (map.hasLayer(heat)) map.removeLayer(heat);
    }

    if (showRoutes) {
      if (!map.hasLayer(routesLayer)) routesLayer.addTo(map);
    } else {
      if (map.hasLayer(routesLayer)) map.removeLayer(routesLayer);
    }

    const maxRoutesEl = document.getElementById("maxRoutes");
    if (maxRoutesEl) maxRoutesEl.disabled = !showRoutes;
  }

  // --- Controls wiring ---
  const radiusEl = document.getElementById("radius");
  const blurEl = document.getElementById("blur");
  const viewModeEl = document.getElementById("viewMode");
  const maxRoutesEl = document.getElementById("maxRoutes");

  if (radiusEl) radiusEl.addEventListener("input", rebuildHeat);
  if (blurEl) blurEl.addEventListener("input", rebuildHeat);

  if (viewModeEl) viewModeEl.addEventListener("change", applyViewMode);

  if (maxRoutesEl) {
    maxRoutesEl.addEventListener("input", () => {
      renderRoutes();
      applyViewMode();
    });
  }

  applyViewMode();
})();
