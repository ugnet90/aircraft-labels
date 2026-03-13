function navCurrentFile(){
  const p = location.pathname.split("/").pop() || "index.html";
  return p;
}

function buildGlobalNav(){
  const current = navCurrentFile();

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

  const mk = ([href, label]) =>
    `<a class="siteNavLink ${current === href ? "active" : ""}" href="./${href}">${label}</a>`;

  return `
    <nav class="siteNav">
      <div class="siteNavLeft">
        <a class="siteNavBrand" href="./dashboard.html">Sammlung</a>
        ${linksLeft.map(mk).join("")}
      </div>
      <div class="siteNavRight">
        ${linksRight.map(mk).join("")}
      </div>
    </nav>
  `;
}

function injectGlobalNav(){
  document.body.insertAdjacentHTML("afterbegin", buildGlobalNav());
}

injectGlobalNav();
