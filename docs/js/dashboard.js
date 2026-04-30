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

function getStatus(x){
  return String(x.status || "").trim().toLowerCase();
}

function countOwnedModels(items){
  return items.filter(x => getStatus(x) === "owned").length;
}

function countOwnedAirlines(items){
  const s = new Set();

  items
    .filter(x => getStatus(x) === "owned")
    .forEach(x => {
      const v = String(x.airline_row || x.airline || x.airline_code || "").trim();
      if(v) s.add(v);
    });

  return s.size;
}

function countOrdered(items){
  return items.filter(x => getStatus(x) === "ordered").length;
}

function countWishlist(items){
  return items.filter(x => getStatus(x) === "wishlist" || x.wishlist === true).length;
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
    const ownedAirlinesCount = countOwnedAirlines(models);
    const orderedCount = countOrdered(models);
    const wishlistCount = countWishlist(models);
    
    const postcardCount =
      Number(postcardsIndex?.count_unique ?? postcardsIndex?.count_total ?? 0) || 0;
    
    let missingCount = 0;
    
    if(Number.isFinite(missingTypes?.counts?.missing_types)){
      missingCount = missingTypes.counts.missing_types;
    }
    else if(Array.isArray(missingTypes?.items)){
      missingCount = missingTypes.items.length;
    }
    else if(Array.isArray(missingTypes)){
      missingCount = missingTypes.length;
    }
    
    setText("kpiModels", labelCount(modelsCount, "vorhandenes Modell", "vorhandene Modelle"));
    setText("kpiOrdered", labelCount(orderedCount, "bestelltes Modell", "bestellte Modelle"));
    setText("kpiWishlist", labelCount(wishlistCount, "Wunschmodell", "Wunschmodelle"));
    setText("kpiAirlines", labelCount(ownedAirlinesCount, "Airline", "Airlines"));
    setText("kpiMissingTypes", labelCount(missingCount, "fehlender Typ", "fehlende Typen"));
    setText("kpiPostcards", labelCount(postcardCount, "vorhandene Postkarte", "vorhandene Postkarten"));

  }catch(e){
    console.error(e);
    setText("stand", "Stand: Fehler beim Laden");
  }
}

main();
