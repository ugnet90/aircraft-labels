const SITE_MAP = {
  dashboard: {
    file: "dashboard.html",
    title: "Dashboard",
    navLabel: "Dashboard",
    group: null,
    breadcrumb: ["Dashboard"]
  },

  models_overview: {
    file: "models_overview.html",
    title: "Flugzeugmodelle-Übersicht",
    navLabel: "Flugzeugmodelle-Übersicht",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Flugzeugmodelle-Übersicht"]
  },

  model: {
    file: "model.html",
    title: "Modell",
    navLabel: "Modell",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Flugzeugmodelle-Übersicht", "Modell"]
  },

  postcards_overview: {
    file: "postcards_overview.html",
    title: "Postkarten",
    navLabel: "Postkarten",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Postkarten"]
  },

  postcard: {
    file: "postcard.html",
    title: "Postkarte",
    navLabel: "Postkarte",
    group: "Sammlung",
    breadcrumb: ["Dashboard", "Postkarten", "Postkarte"]
  },

  types_overview: {
    file: "types_overview.html",
    title: "Alle Flugzeugtypen",
    navLabel: "Alle Flugzeugtypen",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Alle Flugzeugtypen"]
  },

  missing_types: {
    file: "missing_types.html",
    title: "Fehlende Flugzeugtypen",
    navLabel: "Fehlende Flugzeugtypen",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Fehlende Flugzeugtypen"]
  },

  matrix: {
    file: "matrix.html",
    title: "Matrix",
    navLabel: "Matrix",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Matrix"]
  },

  stats: {
    file: "stats.html",
    title: "Statistiken",
    navLabel: "Statistiken",
    group: "Analyse",
    breadcrumb: ["Dashboard", "Analyse", "Statistiken"]
  },

  flights: {
    file: "flights.html",
    title: "Eigene Flüge",
    navLabel: "Eigene Flüge",
    group: "Flüge",
    breadcrumb: ["Dashboard", "Eigene Flüge"]
  },

  heatmap: {
    file: "heatmap.html",
    title: "Flight Heatmap",
    navLabel: "Flight Heatmap",
    group: "Flüge",
    breadcrumb: ["Dashboard", "Flüge", "Flight Heatmap"]
  }
};

const SITE_NAV = [
  {
    type: "link",
    key: "dashboard"
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

function siteCurrentFile(){
  return location.pathname.split("/").pop() || "dashboard.html";
}

function siteCurrentEntry(){
  const file = siteCurrentFile();
  const hit = Object.entries(SITE_MAP).find(([, v]) => v.file === file);
  return hit || ["dashboard", SITE_MAP.dashboard];
}

function siteCurrentKey(){
  return siteCurrentEntry()[0];
}

function siteCurrentPage(){
  return siteCurrentEntry()[1];
}

function siteFindByFile(file){
  return Object.entries(SITE_MAP).find(([, v]) => v.file === file) || null;
}

function siteFindByBreadcrumbLabel(label){
  return Object.entries(SITE_MAP).find(([, v]) => {
    const bc = v.breadcrumb || [];
    return bc.length && bc[bc.length - 1] === label;
  }) || null;
}
