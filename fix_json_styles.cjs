const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'scripts');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json');

const categories = {
  "Animals": ["monkey", "crane", "fox", "cheetah", "animal", "bird", "fish", "dog", "cat", "macaque", "wildlife", "macaw", "turtle", "bear", "lion", "elephant"],
  "Cities": ["city", "skyline", "building", "capital", "street", "town", "urban"],
  "Crowded Place": ["festival", "plaza", "bustling", "market", "crowd", "stadium", "parade"],
  "Food": ["sushi", "ramen", "mochi", "food", "tea", "couscous", "dates", "olives", "coffee", "meal", "dish", "breakfast", "lunch", "dinner", "plate"],
  "Monuments": ["monument", "temple", "shrine", "castle", "statue", "ruins", "pyramid", "church", "cathedral"],
  "Natural Landscapes": ["landscape", "mountain", "beach", "forest", "desert", "volcano", "springs", "tree", "river", "lake", "ocean", "sea", "waterfall", "park"],
  "People": ["people", "dancer", "player", "person", "man", "woman", "children", "crowd", "locals", "traditional clothing"],
  "Objects, instruments, things": ["object", "instrument", "thing", "ball", "trophy", "flag", "car", "bus", "train", "machine"]
};

function inferStyle(visuals, script) {
  const text = ((visuals || "") + " " + (script || "")).toLowerCase();
  
  // Contar coincidencias
  let bestCategory = "Objects, instruments, things";
  let maxMatches = 0;

  for (const [cat, keywords] of Object.entries(categories)) {
    let matches = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        matches++;
      }
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = cat;
    }
  }

  // Fallbacks adicionales basados en el número de frame si es un frame de deportes
  if (text.includes("world cup") || text.includes("soccer") || text.includes("tennis")) {
    return "Objects, instruments, things"; 
  }

  return bestCategory;
}

let modifiedFiles = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  try {
    const json = JSON.parse(content);
    let modified = false;
    for (const item of json) {
      if (!item.style) {
        item.style = inferStyle(item.visuals, item.script);
        modified = true;
      }
    }
    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf-8');
      console.log(`Fixed missing styles in ${file}`);
      modifiedFiles++;
    }
  } catch (e) {
    console.error(`Error processing ${file}: ${e.message}`);
  }
}

console.log(`\nFinished processing. Fixed ${modifiedFiles} files.`);
