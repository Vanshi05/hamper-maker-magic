import type { QuestionnaireData, GeneratedHamper, HamperItem, Feasibility, BadgeType, InventoryStatus } from "./types";
import { PACKAGING_OPTIONS } from "./types";

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

// ── Fetch products from edge function (with retry for env loading) ──
export async function fetchProducts(retries = 3, delayMs = 1000): Promise<AirtableProduct[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("products");

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to fetch products");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to fetch products");
      }

      return data.data as AirtableProduct[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("supabaseUrl is required") && attempt < retries) {
        console.warn(`Supabase not ready (attempt ${attempt}/${retries}), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to fetch products after retries");
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

// ── Select items within budget ──────────────────────────────────────
function selectWithinBudget(
  pool: AirtableProduct[],
  count: number,
  budget: number,
  sortDesc: boolean
): AirtableProduct[] {
  const sorted = [...pool].sort((a, b) =>
    sortDesc ? b.pre_tax_db - a.pre_tax_db : a.pre_tax_db - b.pre_tax_db
  );

  const selected: AirtableProduct[] = [];
  let spent = 0;

  for (const item of sorted) {
    if (selected.length >= count) break;
    if (spent + item.pre_tax_db <= budget) {
      selected.push(item);
      spent += item.pre_tax_db;
    }
  }

  return selected;
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

// ── Build a single hamper ───────────────────────────────────────────
function buildHamper(
  heroes: AirtableProduct[],
  supporting: AirtableProduct[],
  fillers: AirtableProduct[],
  packaging: AirtableProduct | null,
  data: QuestionnaireData,
  perHamperBudget: number,
  index: number
): { hamper: GeneratedHamper; selectedProducts: AirtableProduct[]; signature: string } | null {
  const remainingBudget = perHamperBudget - data.packagingCost;
  const heroBudget = remainingBudget * (data.heroBudgetPercent / 100);
  const supportingBudget = remainingBudget * (data.supportingBudgetPercent / 100);
  const fillerBudget = remainingBudget - heroBudget - supportingBudget;

  const selectedHeroes = selectWithinBudget(heroes, data.heroCount, heroBudget, true);
  const selectedSupporting = selectWithinBudget(supporting, data.supportingCount, supportingBudget, true);
  const selectedFillers = selectWithinBudget(fillers, data.fillerCount, fillerBudget, false);

  const allSelected = [...selectedHeroes, ...selectedSupporting, ...selectedFillers];
  if (allSelected.length === 0) return null;

  // Must-have enforcement
  if (!satisfiesMustHave(allSelected, data.mustHaveItems)) return null;

  // Signature for dedup
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

  const totalPrice = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const withinBudget = totalPrice <= perHamperBudget * 1.15;

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

  return {
    hamper: {
      id: `gen-${index}`,
      name: `Hamper Option ${index + 1}`,
      heroProduct: selectedHeroes[0]?.fancy_name ?? "Custom Hamper",
      sideItems: [
        ...selectedSupporting.map((s) => s.fancy_name),
        ...selectedFillers.map((f) => f.fancy_name),
      ],
      totalPrice,
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
  };
}

// ── Main generator ──────────────────────────────────────────────────
export async function generateHampersFromAirtable(
  data: QuestionnaireData,
  cachedProducts?: AirtableProduct[]
): Promise<GeneratedHamper[]> {
  const allProducts = cachedProducts || (await fetchProducts());

  // Step 2: Base filter — exclude pending tiers, empty tiers
  let filtered = allProducts.filter(
    (p) => p.product_tier.toLowerCase() !== "pending" && p.product_tier !== ""
  );

  // Step 3: Forbidden categories filter
  if (data.forbiddenCategories.length > 0) {
    const forbidden = data.forbiddenCategories.map((c) => c.toLowerCase());
    filtered = filtered.filter((p) => {
      const cat = getCategory(p).toLowerCase();
      return !forbidden.some((f) => cat.includes(f) || f.includes(cat));
    });
  }

  // Step 4: Dietary filter
  const dietaryBlocked = getDietaryBlockedWords(data.dietaryNotes);
  if (dietaryBlocked.length > 0) {
    filtered = filtered.filter((p) =>
      !dietaryBlocked.some((word) =>
        p.fancy_name.toLowerCase().includes(word)
      )
    );
  }

  // Step 5: Inventory filter
  filtered = filtered.filter((p) => p.unsold_after_receivables >= data.quantity);

  // Step 6: Split by tier
  let heroes = filtered.filter((p) => p.product_tier.toLowerCase() === "hero");
  let supporting = filtered.filter((p) => p.product_tier.toLowerCase() === "supporting");
  let fillers = filtered.filter((p) => p.product_tier.toLowerCase() === "filler");
  const packagingProducts = filtered.filter((p) => p.product_tier.toLowerCase() === "packaging");

  // Category preference filter
  const prefValue = data.heroPreference;
  if (prefValue && prefValue !== "no-preference" && prefValue !== "custom") {
    const categoryFilter = (p: AirtableProduct) => {
      const cat = getCategory(p).toLowerCase();
      return cat.replace(/[\s&-]+/g, "-") === prefValue ||
        cat.includes(prefValue.replace(/-/g, " "));
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

  // Step 9-10: Generate unique hampers with deduplication
  const MAX_ATTEMPTS = 20;
  const MAX_HAMPERS = 5;
  const generatedSet = new Set<string>();
  const hampers: GeneratedHamper[] = [];

  let attempts = 0;
  while (attempts < MAX_ATTEMPTS && hampers.length < MAX_HAMPERS) {
    // Vary pools each attempt
    const heroPool = shuffle(heroes);
    const supportPool = shuffle(supporting);
    const fillerPool = shuffle(fillers);

    const result = buildHamper(
      heroPool,
      supportPool,
      fillerPool,
      selectedPackaging,
      data,
      perHamperBudget,
      hampers.length
    );

    if (result && !generatedSet.has(result.signature)) {
      generatedSet.add(result.signature);
      hampers.push(result.hamper);
    }

    attempts++;
  }

  // Sort: green first, then red
  hampers.sort((a, b) => {
    const order = { green: 0, yellow: 1, red: 2 };
    return order[a.feasibility] - order[b.feasibility];
  });

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
