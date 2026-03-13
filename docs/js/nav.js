function buildNavLink(key, currentKey){
  const page = SITE_MAP[key];
  if(!page) return "";

  return `
    <a class="navLink ${key === currentKey ? "active" : ""}"
       href="./${page.file}">
      ${page.navLabel || page.title}
    </a>
  `;
}

function buildNavDropdown(group, currentKey){
  const isActive = group.items.includes(currentKey);

  const itemsHtml = group.items.map(key => {
    const page = SITE_MAP[key];
    if(!page) return "";
    return `
      <a class="navDropdownItem ${key === currentKey ? "active" : ""}"
         href="./${page.file}">
        ${page.navLabel || page.title}
      </a>
    `;
  }).join("");

  return `
    <div class="navDropdown ${isActive ? "active" : ""}">
      <button class="navLink navDropdownToggle ${isActive ? "active" : ""}" type="button" aria-expanded="false">
        ${group.label}
      </button>
      <div class="navDropdownMenu">
        ${itemsHtml}
      </div>
    </div>
  `;
}

function buildBreadcrumb(){
  const [, page] = siteCurrentEntry();
  const items = page.breadcrumb || [];
  if(items.length <= 1) return "";

  const html = items.map((label, i) => {
    if(i === 0){
      return `<a href="./${SITE_MAP.dashboard.file}">${label}</a>`;
    }

    const hit = siteFindByBreadcrumbLabel(label);
    const isLast = i === items.length - 1;

    if(hit && !isLast){
      const [, p] = hit;
      return `<a href="./${p.file}">${label}</a>`;
    }

    return `<span>${label}</span>`;
  }).join(`<span class="crumbSep">›</span>`);

  return `<div class="breadcrumb">${html}</div>`;
}

function buildGlobalNav(){
  const currentKey = siteCurrentKey();
  const page = siteCurrentPage();

  const navHtml = SITE_NAV.map(item => {
    if(item.type === "link"){
      return buildNavLink(item.key, currentKey);
    }
    if(item.type === "group"){
      return buildNavDropdown(item, currentKey);
    }
    return "";
  }).join("");

  return `
    <nav class="siteNav">
      <div class="navTitle">${page.title || ""}</div>

      <="navHamburger" type="button" aria-label="Menü öffnen" aria-expanded="false">
        ☰
      </button>

      <div class="navMenu">
        ${navHtml}
      </div>
    </nav>
    ${buildBreadcrumb()}
  `;
}

function bindNav(){
  const burger = document.querySelector(".navHamburger");
  const menu = document.querySelector(".navMenu");

  if(burger && menu){
    burger.addEventListener("click", () => {
      const isOpen = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  document.querySelectorAll(".navDropdownToggle").forEach(btn => {
    btn.addEventListener("click", (ev) => {
      if(window.innerWidth > 900) return;
      ev.preventDefault();
      ev.stopPropagation();

      const dd = btn.closest(".navDropdown");
      if(!dd) return;

      const willOpen = !dd.classList.contains("open");

      // andere mobile Dropdowns schließen
      document.querySelectorAll(".navDropdown.open").forEach(x => {
        if(x !== dd) x.classList.remove("open");
        const b = x.querySelector(".navDropdownToggle");
        if(b) b.setAttribute("aria-expanded", "false");
      });

      dd.classList.toggle("open", willOpen);
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    });
  });

  document.addEventListener("click", (ev) => {
    if(window.innerWidth > 900) return;

    const insideNav = ev.target.closest(".siteNav");
    if(!insideNav){
      document.querySelectorAll(".navDropdown.open").forEach(dd => dd.classList.remove("open"));
      if(menu) menu.classList.remove("open");
      if(burger) burger.setAttribute("aria-expanded", "false");
    }
  });
}

function injectGlobalNav(){
  document.body.insertAdjacentHTML("afterbegin", buildGlobalNav());
  bindNav();
}

injectGlobalNav();
