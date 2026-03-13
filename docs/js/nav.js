function navCurrentFile(){
  return location.pathname.split("/").pop() || "dashboard.html";
}

function navTitleFromFile(file){
  const map = {
    "dashboard.html":"Dashboard",
    "models_overview.html":"Flugzeugmodelle",
    "postcards_overview.html":"Postkarten",
    "types_overview.html":"Typen-Übersicht",
    "missing_types.html":"Fehlende Flugzeugtypen",
    "matrix.html":"Matrix",
    "stats.html":"Stats",
    "flights.html":"Flüge",
    "heatmap.html":"Heatmap",
    "model.html":"Modell",
    "postcard.html":"Postkarte"
  };
  return map[file] || "";
}

function buildDropdown(label, items, current){
  const active = items.some(i => i[0] === current) ? "active" : "";
  
  const children = items.map(([href, text]) =>
    `<a class="navDropdownItem ${current === href ? "active" : ""}" href="./${href}">${text}</a>`
  ).join("");

  return `
    <div class="navDropdown ${active}">
      <div class="navLink">${label}</div>
      <div class="navDropdownMenu">
        ${children}
      </div>
    </div>
  `;
}

function buildNav(){
  const current = navCurrentFile();
  const title = navTitleFromFile(current);

  return `
  <nav class="siteNav">

    <div class="navTitle">
      ${title}
    </div>

    <div class="navMenu">

      <a class="navLink ${current==="dashboard.html"?"active":""}" href="./dashboard.html">
        Dashboard
      </a>

      ${buildDropdown("Sammlung",[
        ["models_overview.html","Modelle"],
        ["postcards_overview.html","Postkarten"]
      ],current)}

      ${buildDropdown("Analyse",[
        ["types_overview.html","Typen"],
        ["missing_types.html","Fehlende Typen"],
        ["matrix.html","Matrix"],
        ["stats.html","Stats"]
      ],current)}

      ${buildDropdown("Flüge",[
        ["flights.html","Flüge"],
        ["heatmap.html","Heatmap"]
      ],current)}

    </div>

  </nav>
  `;
}

document.body.insertAdjacentHTML("afterbegin", buildNav());
