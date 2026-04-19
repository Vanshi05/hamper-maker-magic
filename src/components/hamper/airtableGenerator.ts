import type { QuestionnaireData, GeneratedHamper, HamperItem, Feasibility, BadgeType, InventoryStatus } from "./types";
import { PACKAGING_OPTIONS } from "./types";
import { supabase } from "@/integrations/supabase/client";


// ── Airtable Product shape ──────────────────────────────────────────
export interface AirtableProduct {
  p_id: string;
  fancy_name: string;
  category: string | string[];
  product_type: string | string[];
  product_tier: string;
  pre_tax_db: number;
  unsold_after_receivables: number;
  image: string | null;
}

// Helper to normalize category to string
function getCategory(p: AirtableProduct): string {
  if (Array.isArray(p.category)) return p.category[0] || "";
  return p.category || "";
}

// Helper to normalize product_type to string
function getProductType(p: AirtableProduct): string {
  if (Array.isArray(p.product_type)) return p.product_type[0] || "";
  return p.product_type || "";
}

// ── Fetch products from edge function (resilient) ───────────────────
export async function fetchProducts(): Promise<AirtableProduct[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Path 1: direct edge-function fetch when env vars are available
  if (supabaseUrl && supabaseKey) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Edge function error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data?.success) {
        throw new Error(data?.error || "Failed to fetch products");
      }
      return data.data as AirtableProduct[];
    } catch (err) {
      console.warn("[fetchProducts] direct fetch failed, falling back to supabase client:", err);
      // fall through to client-based path
    }
  }

  // Path 2: fallback via integrated supabase client
  const { data, error } = await supabase.functions.invoke("products", {
    body: {},
  });

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
  if (!data?.success) {
    throw new Error(data?.error || "Failed to fetch products");
  }
  return data.data as AirtableProduct[];
}

// ── Extract dynamic options from products ───────────────────────────
export function extractDynamicOptions(products: AirtableProduct[]) {
  const categoriesSet = new Set<string>();
  const productTypesSet = new Set<string>();
  const productNames: string[] = [];

  for (const p of products) {
    const cat = getCategory(p);
    if (cat) categoriesSet.add(cat);

    const pt = getProductType(p);
    if (pt) productTypesSet.add(pt);

    if (p.fancy_name) productNames.push(p.fancy_name);
  }

  const categories = Array.from(categoriesSet).sort();
  const productTypes = Array.from(productTypesSet).sort();

  // Must-have options = product names + product types (deduplicated)
  const mustHaveOptions = Array.from(new Set([...productNames, ...productTypes])).sort();

  // Hero preference options from categories
  const heroOptions = [
    { value: "no-preference", label: "No Preference" },
    ...categories.map((c) => ({
      value: c.toLowerCase().replace(/[\s&]+/g, "-"),
      label: c,
    })),
    { value: "custom", label: "Custom" },
  ];

  return { categories, productTypes, productNames, mustHaveOptions, heroOptions };
}

// ── Dietary keyword map ─────────────────────────────────────────────
const DIETARY_MAP: Record<string, string[]> = {
  "no nuts": ["nuts", "almond", "cashew", "pistachio", "walnut", "peanut", "hazelnut"],
  "vegan": ["milk", "honey", "chocolate", "dairy", "ghee", "butter", "cream"],
  "no sugar": ["sugar", "sweet", "candy", "caramel", "toffee"],
  "no gluten": ["wheat", "gluten", "bread", "cookie", "biscuit"],
  "no dairy": ["milk", "dairy", "cheese", "cream", "butter", "ghee", "paneer"],
};

function getDietaryBlockedWords(dietaryNotes: string): string[] {
  const input = (dietaryNotes || "").toLowerCase().trim();
  if (!input) return [];

  const blocked: string[] = [];
  for (const [key, words] of Object.entries(DIETARY_MAP)) {
    if (input.includes(key)) {
      blocked.push(...words);
    }
  }
  return blocked;
}

// ── Shuffle helper ──────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Combination generator (k of n) — capped for performance ─────────
function combinations<T>(arr: T[], k: number, maxCombos = 200): T[][] {
  if (k <= 0) return [[]];
  if (k > arr.length) return [];
  const out: T[][] = [];
  const n = arr.length;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map((i) => arr[i]));
    if (out.length >= maxCombos) break;
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

const totalPrice = (items: AirtableProduct[]): number =>
  items.reduce((s, p) => s + (Number(p.pre_tax_db) || 0), 0);

// ── Best combination: max total price within budget ─────────────────
function bestCombination(
  pool: AirtableProduct[],
  count: number,
  budget: number
): AirtableProduct[] {
  if (count <= 0) return [];
  if (pool.length === 0) return [];

  const shuffled = shuffle(pool).slice(0, 12);
  const combos = combinations(shuffled, Math.min(count, shuffled.length), 200);
  const valid = combos.filter((c) => totalPrice(c) <= budget);

  if (valid.length === 0) {
    // Fallback: cheapest combo so downstream validation can decide
    if (combos.length === 0) return [];
    return combos.reduce((min, c) => (totalPrice(c) < totalPrice(min) ? c : min));
  }
  valid.sort((a, b) => totalPrice(b) - totalPrice(a));
  return valid[0];
}

// ── Closest packaging by price ──────────────────────────────────────
function selectPackaging(
  packagingProducts: AirtableProduct[],
  targetCost: number
): AirtableProduct | null {
  if (packagingProducts.length === 0) return null;
  return packagingProducts.reduce((closest, current) => {
    const closestDiff = Math.abs(closest.pre_tax_db - targetCost);
    const currentDiff = Math.abs(current.pre_tax_db - targetCost);
    return currentDiff < closestDiff ? current : closest;
  });
}

// ── Inventory status ────────────────────────────────────────────────
function computeInventory(items: AirtableProduct[], quantity: number): InventoryStatus {
  if (items.length === 0) {
    return { stockAvailable: 0, requiredQuantity: quantity, status: "Out of Stock" };
  }
  const minStock = Math.min(...items.map((i) => i.unsold_after_receivables));
  return {
    stockAvailable: minStock,
    requiredQuantity: quantity,
    status:
      minStock >= quantity * 1.2
        ? "Safe"
        : minStock >= quantity
        ? "Low"
        : "Out of Stock",
  };
}

// ── Signature for deduplication ─────────────────────────────────────
function getSignature(
  heroes: AirtableProduct[],
  supporting: AirtableProduct[],
  fillers: AirtableProduct[]
): string {
  return [...heroes, ...supporting, ...fillers]
    .map((p) => p.p_id)
    .sort()
    .join("-");
}

// ── Must-have enforcement ───────────────────────────────────────────
function satisfiesMustHave(
  selected: AirtableProduct[],
  mustHaveList: string[]
): boolean {
  if (mustHaveList.length === 0) return true;
  return mustHaveList.every((item) => {
    const lower = item.toLowerCase();
    return selected.some(
      (p) =>
        p.fancy_name.toLowerCase().includes(lower) ||
        getProductType(p).toLowerCase().includes(lower)
    );
  });
}

// ── Theme consistency: dominant category share ──────────────────────
function dominantCategoryShare(products: AirtableProduct[]): number {
  if (products.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const p of products) {
    const cat = getCategory(p).toLowerCase() || "uncategorized";
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return Math.max(...counts.values()) / products.length;
}

// ── Hamper score ────────────────────────────────────────────────────
function scoreHamper(
  selected: AirtableProduct[],
  total: number,
  budget: number
): number {
  if (budget <= 0 || selected.length === 0) return 0;
  const utilization = Math.min(1, total / budget);
  const avgPrice = total / selected.length;
  const avgNorm = Math.min(1, avgPrice / 500);
  const consistency = dominantCategoryShare(selected);
  return 0.5 * utilization + 0.3 * avgNorm + 0.2 * consistency;
}

// ── Build final GeneratedHamper object (UI shape preserved) ─────────
function assembleHamper(
  selectedHeroes: AirtableProduct[],
  selectedSupporting: AirtableProduct[],
  selectedFillers: AirtableProduct[],
  packaging: AirtableProduct | null,
  data: QuestionnaireData,
  perHamperBudget: number,
  index: number
): GeneratedHamper {
  const items: HamperItem[] = [
    ...selectedHeroes.map((p) => ({
      name: p.fancy_name,
      qty: 1,
      unitPrice: p.pre_tax_db,
      role: "hero" as const,
    })),
    ...selectedSupporting.map((p) => ({
      name: p.fancy_name,
      qty: 1,
      unitPrice: p.pre_tax_db,
      role: "supporting" as const,
    })),
    ...selectedFillers.map((p) => ({
      name: p.fancy_name,
      qty: 1,
      unitPrice: p.pre_tax_db,
      role: "filler" as const,
    })),
  ];

  const packLabel =
    PACKAGING_OPTIONS.find((p) => p.value === data.packagingType)?.label ?? "Packaging";
  if (packaging) {
    items.push({
      name: packaging.fancy_name || packLabel,
      qty: 1,
      unitPrice: packaging.pre_tax_db || data.packagingCost,
      role: "packaging",
    });
  } else {
    items.push({
      name: packLabel,
      qty: 1,
      unitPrice: data.packagingCost,
      role: "packaging",
    });
  }

  const finalTotal = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const withinBudget = finalTotal <= perHamperBudget * 1.15;
  const feasibility: Feasibility = withinBudget ? "green" : "red";

  const allSelected = [...selectedHeroes, ...selectedSupporting, ...selectedFillers];
  const inventory = computeInventory(allSelected, data.quantity);

  const badges: BadgeType[] = [];
  if (inventory.status === "Low" || inventory.status === "Out of Stock") badges.push("LOW STOCK");
  if (data.priorityMode === "premium") badges.push("PREMIUM");
  if (data.priorityMode === "fast") badges.push("FAST DELIVERY");

  const whyChosen: string[] = [];
  if (withinBudget) whyChosen.push("Within budget");
  if (selectedHeroes.length === data.heroCount) whyChosen.push("All hero slots filled");
  if (inventory.status === "Safe") whyChosen.push("Stock available");
  if (data.mustHaveItems.length > 0) whyChosen.push("Must-have items included");

  const heroImage = selectedHeroes.find((h) => h.image)?.image;
  const anyImage = allSelected.find((p) => p.image)?.image;
  const fallbackImage =
    "https://images.unsplash.com/photo-1549465220-1a8b9238f0b0?w=400&h=300&fit=crop";

  return {
    id: `gen-${index}`,
    name: `Hamper Option ${index + 1}`,
    heroProduct: selectedHeroes[0]?.fancy_name ?? "Custom Hamper",
    sideItems: [
      ...selectedSupporting.map((s) => s.fancy_name),
      ...selectedFillers.map((f) => f.fancy_name),
    ],
    totalPrice: finalTotal,
    image: heroImage || anyImage || fallbackImage,
    badges,
    items,
    gstPercent: data.priorityMode === "premium" ? 18 : 12,
    feasibility,
    whyChosen,
    isBackup: false,
    inventory,
  };
}

// ── Main generator ──────────────────────────────────────────────────
export async function generateHampersFromAirtable(
  data: QuestionnaireData,
  cachedProducts?: AirtableProduct[]
): Promise<GeneratedHamper[]> {
  const allProducts = cachedProducts || (await fetchProducts());

  // Working copy — never mutate allProducts
  let products = [...allProducts];

  // 2a. Remove pending tier (case-insensitive) and empty tier
  products = products.filter((p) => {
    const tier = (p.product_tier || "").toLowerCase().trim();
    return tier !== "pending" && tier !== "";
  });

  // 2b. Remove insufficient stock
  products = products.filter((p) => p.unsold_after_receivables >= data.quantity);

  // 2c. Forbidden categories
  if (data.forbiddenCategories.length > 0) {
    const forbidden = data.forbiddenCategories.map((c) => c.toLowerCase().trim());
    products = products.filter((p) => {
      const cat = getCategory(p).toLowerCase().trim();
      const pt = getProductType(p).toLowerCase().trim();
      return !forbidden.some(
        (f) => cat === f || pt === f || cat.includes(f) || pt.includes(f)
      );
    });
  }

  // 2d. Dietary notes
  const dietaryBlocked = getDietaryBlockedWords(data.dietaryNotes);
  if (dietaryBlocked.length > 0) {
    products = products.filter(
      (p) => !dietaryBlocked.some((word) => p.fancy_name.toLowerCase().includes(word))
    );
  }

  // 2e. Preferred category — BEFORE tier split (critical fix)
  const prefValue = data.heroPreference;
  if (prefValue && prefValue !== "no-preference" && prefValue !== "custom") {
    const pref = prefValue.replace(/-/g, " ").toLowerCase().trim();
    const prefFiltered = products.filter((p) => {
      const cat = getCategory(p).toLowerCase().trim();
      const pt = getProductType(p).toLowerCase().trim();
      return cat.includes(pref) || pref.includes(cat) || pt.includes(pref) || pref.includes(pt);
    });
    // Only apply the preference if enough products survive to actually build hampers
    if (prefFiltered.length >= data.heroCount + data.supportingCount) {
      products = prefFiltered;
    }
  }

  // 3. Split by tier
  const heroes = products.filter((p) => (p.product_tier || "").toLowerCase().trim() === "hero");
  const supporting = products.filter(
    (p) => (p.product_tier || "").toLowerCase().trim() === "supporting"
  );
  const fillers = products.filter(
    (p) => (p.product_tier || "").toLowerCase().trim() === "filler"
  );
  const packagingProducts = products.filter(
    (p) => (p.product_tier || "").toLowerCase().trim() === "packaging"
  );

  // 4. Budget split
  const perHamperBudget =
    data.budgetMode === "total"
      ? Math.round(data.budget / Math.max(data.quantity, 1))
      : data.budget;

  const selectedPackaging = selectPackaging(packagingProducts, data.packagingCost);
  const packagingCost = selectedPackaging?.pre_tax_db ?? data.packagingCost;
  const remainingBudget = Math.max(0, perHamperBudget - packagingCost);
  const heroBudget = remainingBudget * (data.heroBudgetPercent / 100);
  const supportingBudget = remainingBudget * (data.supportingBudgetPercent / 100);
  const fillerBudget = Math.max(0, remainingBudget - heroBudget - supportingBudget);

  // 11. Generation loop
  const MAX_ATTEMPTS = 30;
  const MAX_HAMPERS = 5;
  const generatedSet = new Set<string>();
  type Scored = { hamper: GeneratedHamper; score: number };
  const candidates: Scored[] = [];
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS && candidates.length < MAX_HAMPERS) {
    attempts++;

    const selectedHeroes = bestCombination(heroes, data.heroCount, heroBudget);
    const selectedSupporting = bestCombination(
      supporting,
      data.supportingCount,
      supportingBudget
    );

    // Filler budget = whatever is actually left
    const usedSoFar =
      totalPrice(selectedHeroes) + totalPrice(selectedSupporting) + packagingCost;
    const actualFillerBudget = Math.max(
      0,
      Math.min(fillerBudget, perHamperBudget - usedSoFar)
    );
    const selectedFillers = bestCombination(fillers, data.fillerCount, actualFillerBudget);

    const allSelected = [...selectedHeroes, ...selectedSupporting, ...selectedFillers];
    if (allSelected.length === 0) continue;

    const hamperTotal = totalPrice(allSelected) + packagingCost;

    // 9. Validation
    if (hamperTotal > perHamperBudget) continue;
    if (hamperTotal < perHamperBudget * 0.5) continue;
    if (data.heroCount > 0 && selectedHeroes.length === 0) continue;
    if (!satisfiesMustHave(allSelected, data.mustHaveItems)) continue;

    // 10. Uniqueness
    const sig = getSignature(selectedHeroes, selectedSupporting, selectedFillers);
    if (generatedSet.has(sig)) continue;
    generatedSet.add(sig);

    const score = scoreHamper(allSelected, hamperTotal, perHamperBudget);
    const hamper = assembleHamper(
      selectedHeroes,
      selectedSupporting,
      selectedFillers,
      selectedPackaging,
      data,
      perHamperBudget,
      candidates.length
    );

    candidates.push({ hamper, score });
  }

  // Sort by feasibility then score
  candidates.sort((a, b) => {
    const order = { green: 0, yellow: 1, red: 2 };
    const fDiff = order[a.hamper.feasibility] - order[b.hamper.feasibility];
    if (fDiff !== 0) return fDiff;
    return b.score - a.score;
  });

  const hampers = candidates.map((c) => c.hamper);
  hampers.forEach((h, i) => {
    h.id = `gen-${i}`;
    if (i < 3) {
      h.name = `Hamper Option ${i + 1}`;
      h.isBackup = false;
    } else {
      h.name = `Backup ${i - 2}`;
      h.isBackup = true;
    }
  });

  return hampers;
}
