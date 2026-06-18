function airportDataUrl(reg){
  const r = String(reg || "").trim();
  if(!r) return "";

  return `https://airport-data.com/aircraft/${encodeURIComponent(r)}`;
}

function registrationLink(reg){
  const r = String(reg || "").trim();
  if(!r) return "";

  return `<a href="${esc(airportDataUrl(r))}" target="airportDataTab" rel="noopener noreferrer">${esc(r)}</a>`;
}
