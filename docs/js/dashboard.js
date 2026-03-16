async function loadJson(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value;
}

function labelCount(n, singular, plural){
  return `${n} ${n === 1 ? singular : plural}`;
}

function countOwnedModels(items){
  return items.filter(x => !!x.model_id).length;
}

function countAirlines(items){
  const s = new Set();
  items.forEach(x => {
    const v = String(x.airline_row || x.airline || "").trim();
    if(v) s.add(v);
  });
  return s.size;
}

function countOrdered(items){
  return items.filter(x => !!x.ordered_at && !x.arrived).length;
}

function countWishlist(items){
  return items.filter(x => {
    const v = String(x.wishlist || x.Wunsch || "").trim().toLowerCase();
    return ["1","true","wahr","yes","ja","x"].includes(v);
  }).length;
}

async function main(){
  try{
    const [indexData, postcardsIndex, missingTypes] = await Promise.all([
      loadJson("index.json"),
      loadJson("data/postcards_index.json").catch(() => null),
      loadJson("data/missing_types.json").catch(() => null)
    ]);

    const models = Array.isArray(indexData?.items) ? indexData.items : [];

    if(typeof formatStandDE === "function"){
      setText("stand", formatStandDE(indexData?.generated_at || ""));
    }else{
      setText("stand", indexData?.generated_at || "");
    }

    const modelsCount = countOwnedModels(models);
    const airlinesCount = countAirlines(models);
    const orderedCount = countOrdered(models);
    const wishlistCount = countWishlist(models);
    
    const postcardCount =
      Number(postcardsIndex?.count_unique ?? postcardsIndex?.count_total ?? 0) || 0;
    
    let missingCount = 0;
    if(Array.isArray(missingTypes)) missingCount = missingTypes.length;
    else if(Array.isArray(missingTypes?.items)) missingCount = missingTypes.items.length;
    else if(Number.isFinite(missingTypes?.count)) missingCount = missingTypes.count;
    
    setText("kpiModels", String(modelsCount));
    setText("kpiPostcards", String(postcardCount));
    setText("kpiAirlines", String(airlinesCount));
    setText("kpiOrdered", String(orderedCount));
    setText("kpiWishlist", String(wishlistCount));
    setText("kpiMissingTypes", String(missingCount));
    
    setText("kpiModelsLabel", labelCount(modelsCount, "Modell", "Modelle"));
    setText("kpiPostcardsLabel", labelCount(postcardCount, "Postkarte", "Postkarten"));
    setText("kpiAirlinesLabel", labelCount(airlinesCount, "Airline", "Airlines"));
    setText("kpiOrderedLabel", labelCount(orderedCount, "Bestellung", "Bestellungen"));
    setText("kpiWishlistLabel", labelCount(wishlistCount, "Wunsch", "Wünsche"));
    setText("kpiMissingTypesLabel", labelCount(missingCount, "Fehlender Typ", "Fehlende Typen"));

  }catch(e){
    console.error(e);
    setText("stand", "Stand: Fehler beim Laden");
  }
}

main();
