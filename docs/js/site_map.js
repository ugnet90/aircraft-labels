const SITE_MAP = {
  dashboard: {
    file: "dashboard.html",
    title: "Dashboard",
    group: null,
    breadcrumb: ["Dashboard"]
  },
  models_overview: {
    file: "models_overview.html",
    title: "Flugzeugmodelle",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Modelle"]
  },
  model: {
    file: "model.html",
    title: "Modell",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Modelle", "Modell"]
  },
  postcards_overview: {
    file: "postcards_overview.html",
    title: "Postkarten",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Postkarten"]
  },
  postcard: {
    file: "postcard.html",
    title: "Postkarte",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Postkarten", "Postkarte"]
  },
  types_overview: {
    file: "types_overview.html",
    title: "Typen-Übersicht",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Typen"]
  },
  missing_types: {
    file: "missing_types.html",
    title: "Fehlende Flugzeugtypen",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Fehlende Typen"]
  },
  matrix: {
    file: "matrix.html",
    title: "Matrix",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Matrix"]
  },
  stats: {
    file: "stats.html",
    title: "Stats",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Stats"]
  },
  flights: {
    file: "flights.html",
    title: "Flüge",
    group: "Flüge",
    breadcrumb: ["Dashboard", "Flüge"]
  },
  heatmap: {
    file: "heatmap.html",
    title: "Heatmap",
    group: "Flüge",
    breadcrumb: ["Dashboard", "Flüge", "Heatmap"]
  }
};

const SITE_NAV = [
  {
    type: "link",
    key: "dashboard",
    label: "Dashboard"
  },
  {
    type: "group",
    label: "Sammlung",
    items: ["models_overview", "postcards_overview"]
  },
  {
    type: "group",
    label: "Analyse",
    items: ["types_overview", "missing_types", "matrix", "stats"]
  },
  {
    type: "group",
    label: "Flüge",
    items: ["flights", "heatmap"]
  }
];

function currentSiteEntry(){
  const file = location.pathname.split("/").pop() || "dashboard.html";
  return Object.entries(SITE_MAP).find(([, v]) => v.file === file) || null;
}
