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

// ── Fetch products from edge function ──
export async function fetchProducts(): Promise<AirtableProduct[]> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration. Please check environment variables.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/products`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${supabaseKey}`,
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
  const input = dietaryNotes.toLowerCase().trim();
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
function combinations<T>(arr: T[], k: number, maxCombos = 60): T[][] {
  if (k <= 0 || arr.length === 0) return [[]];
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

// ── Pick best combination: max total price within budget ────────────
function pickBestCombo(
  pool: AirtableProduct[],
  count: number,
  budget: number,
  maxCombos = 60
): AirtableProduct[] {
  if (count <= 0) return [];
  if (pool.length === 0) return [];

  // Sample up to maxCombos combinations from a shuffled pool
  const sampled = shuffle(pool).slice(0, Math.min(pool.length, count + 8));
  const combos = combinations(sampled, Math.min(count, sampled.length), maxCombos);

  let best: AirtableProduct[] = [];
  let bestTotal = -1;

  for (const combo of combos) {
    const total = combo.reduce((s, p) => s + p.pre_tax_db, 0);
    if (total <= budget && total > bestTotal) {
      best = combo;
      bestTotal = total;
    }
  }

  // Fallback: if nothing fits budget, take the cheapest combo we can
  if (best.length === 0 && combos.length > 0) {
    best = combos.reduce((min, c) => {
      const t = c.reduce((s, p) => s + p.pre_tax_db, 0);
      const mt = min.reduce((s, p) => s + p.pre_tax_db, 0);
      return t < mt ? c : min;
    });
  }
  return best;
}

// ── Pick filler combo: closest to (and ≤) filler budget ─────────────
function pickFillerCombo(
  pool: AirtableProduct[],
  count: number,
  fillerBudget: number,
  maxCombos = 80
): AirtableProduct[] {
  if (count <= 0 || pool.length === 0) return [];

  const sampled = shuffle(pool).slice(0, Math.min(pool.length, count + 10));
  const combos = combinations(sampled, Math.min(count, sampled.length), maxCombos);

  let best: AirtableProduct[] = [];
  let bestDiff = Infinity;

  for (const combo of combos) {
    const total = combo.reduce((s, p) => s + p.pre_tax_db, 0);
    if (total <= fillerBudget) {
      const diff = fillerBudget - total;
      if (diff < bestDiff) {
        best = combo;
        bestDiff = diff;
      }
    }
  }

  if (best.length === 0 && combos.length > 0) {
    // Fallback: cheapest combo
    best = combos.reduce((min, c) => {
      const t = c.reduce((s, p) => s + p.pre_tax_db, 0);
      const mt = min.reduce((s, p) => s + p.pre_tax_db, 0);
      return t < mt ? c : min;
    });
  }
  return best;
}

// ── Find closest packaging ──────────────────────────────────────────
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

// ── Compute inventory status ────────────────────────────────────────
function computeInventory(items: AirtableProduct[], quantity: number): InventoryStatus {
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

// ── Hamper signature for deduplication ───────────────────────────────
function getHamperSignature(
  heroes: AirtableProduct[],
  supporting: AirtableProduct[],
  fillers: AirtableProduct[]
): string {
  const ids = [
    ...heroes.map((p) => p.p_id),
    ...supporting.map((p) => p.p_id),
    ...fillers.map((p) => p.p_id),
  ];
  ids.sort();
  return ids.join("-");
}

// ── Must-have check ─────────────────────────────────────────────────
function satisfiesMustHave(
  selectedProducts: AirtableProduct[],
  mustHaveList: string[]
): boolean {
  if (mustHaveList.length === 0) return true;

  return mustHaveList.every((item) => {
    const lower = item.toLowerCase();
    return selectedProducts.some(
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
  const max = Math.max(...counts.values());
  return max / products.length;
}

// ── Hamper score (higher = better) ──────────────────────────────────
function scoreHamper(
  selectedProducts: AirtableProduct[],
  totalPrice: number,
  perHamperBudget: number
): number {
  if (perHamperBudget <= 0 || selectedProducts.length === 0) return 0;
  const utilization = Math.min(1, totalPrice / perHamperBudget);
  const avgPrice = totalPrice / selectedProducts.length;
  // Normalize avg price against budget per item — caps at 1
  const avgNorm = Math.min(1, avgPrice / (perHamperBudget / Math.max(selectedProducts.length, 1)));
  const consistency = dominantCategoryShare(selectedProducts);
  return 0.5 * utilization + 0.3 * avgNorm + 0.2 * consistency;
}

// ── Build a single hamper using combination optimization ────────────
function buildHamper(
  heroPool: AirtableProduct[],
  supportingPool: AirtableProduct[],
  fillerPool: AirtableProduct[],
  packaging: AirtableProduct | null,
  data: QuestionnaireData,
  perHamperBudget: number,
  index: number
): {
  hamper: GeneratedHamper;
  selectedProducts: AirtableProduct[];
  signature: string;
  score: number;
} | null {
  const packagingCost = packaging?.pre_tax_db ?? data.packagingCost;
  const remainingBudget = Math.max(0, perHamperBudget - packagingCost);
  const heroBudget = remainingBudget * (data.heroBudgetPercent / 100);
  const supportingBudget = remainingBudget * (data.supportingBudgetPercent / 100);

  // Limit pool sizes for performance
  const heroes = [...heroPool].sort((a, b) => b.pre_tax_db - a.pre_tax_db).slice(0, 10);
  const supporting = [...supportingPool].sort((a, b) => b.pre_tax_db - a.pre_tax_db).slice(0, 15);
  const fillers = [...fillerPool].sort((a, b) => a.pre_tax_db - b.pre_tax_db).slice(0, 20);

  // HERO: max-value combination within hero budget
  const selectedHeroes = pickBestCombo(heroes, data.heroCount, heroBudget, 60);
  const heroSpent = selectedHeroes.reduce((s, p) => s + p.pre_tax_db, 0);

  // SUPPORTING: max-value combination within supporting budget
  const selectedSupporting = pickBestCombo(supporting, data.supportingCount, supportingBudget, 60);
  const supportSpent = selectedSupporting.reduce((s, p) => s + p.pre_tax_db, 0);

  // FILLER: fill the actual remaining budget (smarter than fixed split)
  const remainingForFillers = Math.max(
    0,
    perHamperBudget - packagingCost - heroSpent - supportSpent
  );
  let selectedFillers = pickFillerCombo(fillers, data.fillerCount, remainingForFillers, 80);

  let allSelected = [...selectedHeroes, ...selectedSupporting, ...selectedFillers];
  if (allSelected.length === 0) return null;

  // ── Optimization loop: if utilization < 80%, try upgrades ────────
  let totalPrice = allSelected.reduce((s, p) => s + p.pre_tax_db, 0) + packagingCost;
  let attempts = 0;
  while (totalPrice < perHamperBudget * 0.8 && attempts < 4) {
    const headroom = perHamperBudget - totalPrice;
    let upgraded = false;

    // Try upgrading the cheapest filler with a higher-value one
    if (selectedFillers.length > 0) {
      const cheapestIdx = selectedFillers
        .map((p, i) => ({ p, i }))
        .sort((a, b) => a.p.pre_tax_db - b.p.pre_tax_db)[0].i;
      const cheapest = selectedFillers[cheapestIdx];
      const usedIds = new Set(allSelected.map((p) => p.p_id));
      const candidate = [...fillerPool, ...supportingPool]
        .filter((p) => !usedIds.has(p.p_id))
        .filter((p) => p.pre_tax_db > cheapest.pre_tax_db && p.pre_tax_db - cheapest.pre_tax_db <= headroom)
        .sort((a, b) => b.pre_tax_db - a.pre_tax_db)[0];
      if (candidate) {
        selectedFillers[cheapestIdx] = candidate;
        upgraded = true;
      }
    }

    // Try upgrading a supporting item
    if (!upgraded && selectedSupporting.length > 0) {
      const cheapestIdx = selectedSupporting
        .map((p, i) => ({ p, i }))
        .sort((a, b) => a.p.pre_tax_db - b.p.pre_tax_db)[0].i;
      const cheapest = selectedSupporting[cheapestIdx];
      const usedIds = new Set(allSelected.map((p) => p.p_id));
      const candidate = supportingPool
        .filter((p) => !usedIds.has(p.p_id))
        .filter((p) => p.pre_tax_db > cheapest.pre_tax_db && p.pre_tax_db - cheapest.pre_tax_db <= headroom)
        .sort((a, b) => b.pre_tax_db - a.pre_tax_db)[0];
      if (candidate) {
        selectedSupporting[cheapestIdx] = candidate;
        upgraded = true;
      }
    }

    if (!upgraded) break;
    allSelected = [...selectedHeroes, ...selectedSupporting, ...selectedFillers];
    totalPrice = allSelected.reduce((s, p) => s + p.pre_tax_db, 0) + packagingCost;
    attempts++;
  }

  // Must-have enforcement
  if (!satisfiesMustHave(allSelected, data.mustHaveItems)) return null;

  // Theme consistency: reject if dominant category share < 50% (only when pool has >1 category)
  const distinctCats = new Set(allSelected.map((p) => getCategory(p).toLowerCase()));
  if (distinctCats.size > 1 && dominantCategoryShare(allSelected) < 0.5) return null;

  // Strict minimum utilization: reject if total < 60% of budget
  if (totalPrice < perHamperBudget * 0.6) return null;

  const signature = getHamperSignature(selectedHeroes, selectedSupporting, selectedFillers);

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

  // Add packaging
  const packLabel = PACKAGING_OPTIONS.find((p) => p.value === data.packagingType)?.label ?? "Packaging";
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

  const badges: BadgeType[] = [];
  const inventory = computeInventory(allSelected, data.quantity);
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
  const fallbackImage = "https://images.unsplash.com/photo-1549465220-1a8b9238f0b0?w=400&h=300&fit=crop";

  const score = scoreHamper(allSelected, finalTotal, perHamperBudget);

  return {
    hamper: {
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
    },
    selectedProducts: allSelected,
    signature,
    score,
  };
}

// ── Main generator ──────────────────────────────────────────────────
export async function generateHampersFromAirtable(
  data: QuestionnaireData,
  cachedProducts?: AirtableProduct[]
): Promise<GeneratedHamper[]> {
  const allProducts = cachedProducts || (await fetchProducts());

  // Base filter — exclude pending tiers, empty tiers
  let filtered = allProducts.filter(
    (p) => p.product_tier.toLowerCase() !== "pending" && p.product_tier !== ""
  );

  // Forbidden categories filter
  if (data.forbiddenCategories.length > 0) {
    const forbidden = data.forbiddenCategories.map((c) => c.toLowerCase());
    filtered = filtered.filter((p) => {
      const cat = getCategory(p).toLowerCase();
      return !forbidden.some((f) => cat.includes(f) || f.includes(cat));
    });
  }

  // Dietary filter
  const dietaryBlocked = getDietaryBlockedWords(data.dietaryNotes);
  if (dietaryBlocked.length > 0) {
    filtered = filtered.filter((p) =>
      !dietaryBlocked.some((word) =>
        p.fancy_name.toLowerCase().includes(word)
      )
    );
  }

  // Inventory filter
  filtered = filtered.filter((p) => p.unsold_after_receivables >= data.quantity);

  // Split by tier
  let heroes = filtered.filter((p) => p.product_tier.toLowerCase() === "hero");
  let supporting = filtered.filter((p) => p.product_tier.toLowerCase() === "supporting");
  let fillers = filtered.filter((p) => p.product_tier.toLowerCase() === "filler");
  const packagingProducts = filtered.filter((p) => p.product_tier.toLowerCase() === "packaging");

  // Category preference filter
  const prefValue = data.heroPreference;
  if (prefValue && prefValue !== "no-preference" && prefValue !== "custom") {
    const prefSearch = prefValue.replace(/-/g, " ").toLowerCase();

    const categoryFilter = (p: AirtableProduct) => {
      const cat = getCategory(p).toLowerCase();
      const pt = getProductType(p).toLowerCase();
      return cat.includes(prefSearch) || prefSearch.includes(cat) ||
        pt.includes(prefSearch) || prefSearch.includes(pt);
    };

    const filteredHeroes = heroes.filter(categoryFilter);
    const filteredSupporting = supporting.filter(categoryFilter);
    const filteredFillers = fillers.filter(categoryFilter);

    if (filteredHeroes.length >= data.heroCount) heroes = filteredHeroes;
    if (filteredSupporting.length >= data.supportingCount) supporting = filteredSupporting;
    if (filteredFillers.length >= data.fillerCount) fillers = filteredFillers;
  }

  // Budget
  const perHamperBudget =
    data.budgetMode === "total"
      ? Math.round(data.budget / Math.max(data.quantity, 1))
      : data.budget;

  // Packaging
  const selectedPackaging = selectPackaging(packagingProducts, data.packagingCost);

  // Generate unique scored hampers
  const MAX_ATTEMPTS = 15;
  const generatedSet = new Set<string>();
  type Scored = { hamper: GeneratedHamper; score: number };
  const candidates: Scored[] = [];

  let attempts = 0;
  while (attempts < MAX_ATTEMPTS && candidates.length < 8) {
    const result = buildHamper(
      heroes,
      supporting,
      fillers,
      selectedPackaging,
      data,
      perHamperBudget,
      candidates.length
    );

    if (result && !generatedSet.has(result.signature)) {
      generatedSet.add(result.signature);
      candidates.push({ hamper: result.hamper, score: result.score });
    }

    attempts++;
  }

  // Sort by score (highest first), then by feasibility
  candidates.sort((a, b) => {
    const order = { green: 0, yellow: 1, red: 2 };
    const fDiff = order[a.hamper.feasibility] - order[b.hamper.feasibility];
    if (fDiff !== 0) return fDiff;
    return b.score - a.score;
  });

  const hampers = candidates.map((c) => c.hamper);

  // Label: top 3 main, rest backup
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
