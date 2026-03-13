function navCurrentFile(){
  const p = location.pathname.split("/").pop() || "index.html";
  return p;
}

function navTitleFromFile(file){
  const map = {
    "dashboard.html": "Dashboard",
    "models_overview.html": "Flugzeugmodelle",
    "postcards_overview.html": "Postkarten",
    "types_overview.html": "Typen-Übersicht",
    "missing_types.html": "Fehlende Flugzeugtypen",
    "matrix.html": "Matrix",
    "stats.html": "Stats",
    "flights.html": "Flüge",
    "heatmap.html": "Heatmap",
    "model.html": "Modell",
    "postcard.html": "Postkarte"
  };
  return map[file] || "";
}

function buildNavGroup(links, current){
  return links.map(([href, label]) =>
    `<a class="siteNavLink ${current === href ? "active" : ""}" href="./${href}">${label}</a>`
  ).join("");
}

function buildGlobalNav(){
  const current = navCurrentFile();
  const title = navTitleFromFile(current);

  const linksLeft = [
    ["dashboard.html", "Dashboard"],
    ["models_overview.html", "Modelle"],
    ["postcards_overview.html", "Postkarten"]
  ];

  const linksRight = [
    ["types_overview.html", "Typen"],
    ["missing_types.html", "Fehlende Typen"],
    ["matrix.html", "Matrix"],
    ["stats.html", "Stats"],
    ["flights.html", "Flüge"],
    ["heatmap.html", "Heatmap"]
  ];

  return `
    <nav class="siteNav">
      <div class="siteNavCol siteNavCol-left">
        <div class="siteNavGroup">
          ${buildNavGroup(linksLeft, current)}
        </div>
      </div>

      <div class="siteNavCol siteNavCol-center">
        <div class="siteNavTitle">${title}</div>
      </div>

      <div class="siteNavCol siteNavCol-right">
        <div class="siteNavGroup">
          ${buildNavGroup(linksRight, current)}
        </div>
      </div>
    </nav>
  `;
}

function injectGlobalNav(){
  document.body.insertAdjacentHTML("afterbegin", buildGlobalNav());
}

injectGlobalNav();
