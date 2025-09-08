// src/utils/recipeImport.ts
export type ImportedRecipe = {
  name: string;
  servings: number;
  ingredients: string[];
  steps: string[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
};

// Safely parse a number out of strings like "270 calories", "31 g"
function parseNum(s: any): number {
  if (s == null) return 0;
  const m = String(s).match(/(\d+(\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1])) : 0;
}

function toArray<T = any>(v: any): T[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function extractJsonLd(html: string): any[] {
  const out: any[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const json = JSON.parse(raw);
      if (Array.isArray(json)) out.push(...json);
      else out.push(json);
    } catch {
      // Some pages have multiple JSONs concatenated; try to split braces
      // Best-effort only
    }
  }
  return out;
}

function pickRecipeNode(nodes: any[]): any | null {
  for (const n of nodes) {
    const tp = n?.["@type"];
    if (!tp) continue;
    if (typeof tp === "string" && tp.toLowerCase() === "recipe") return n;
    if (Array.isArray(tp) && tp.map((x) => String(x).toLowerCase()).includes("recipe"))
      return n;
    // Some sites wrap in "@graph"
    if (Array.isArray(n?.["@graph"])) {
      const found = pickRecipeNode(n["@graph"]);
      if (found) return found;
    }
  }
  return null;
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const html = await res.text();

  const nodes = extractJsonLd(html);
  const node = pickRecipeNode(nodes);
  if (!node) {
    throw new Error("No JSON-LD Recipe schema found on this page.");
  }

  const name = String(node.name || "Imported Recipe").trim();
  const servingsRaw = node.recipeYield || node.yield || 1;
  const servings = Array.isArray(servingsRaw)
    ? parseNum(servingsRaw[0])
    : parseNum(servingsRaw) || 1;

  const ingredients: string[] = toArray<string>(node.recipeIngredient || node.ingredients).map(
    (s: any) => String(s).trim()
  );

  // Instructions could be array of strings or objects with "text"
  const instr = toArray<any>(node.recipeInstructions);
  const steps: string[] = instr
    .map((x) =>
      typeof x === "string" ? x.trim() : String(x?.text || "").trim()
    )
    .filter(Boolean);

  // Nutrition: use totals if provided
  const nutrition = node.nutrition || {};
  const totals = {
    calories: parseNum(nutrition.calories),
    protein: parseNum(nutrition.proteinContent),
    carbs: parseNum(nutrition.carbohydrateContent),
    fat: parseNum(nutrition.fatContent),
  };

  return {
    name,
    servings,
    ingredients,
    steps,
    totals,
  };
}