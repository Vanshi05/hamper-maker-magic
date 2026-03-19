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

// ── Fetch products from edge function ───────────────────────────────
export async function fetchProducts(): Promise<AirtableProduct[]> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const url = `https://${projectId}.supabase.co/functions/v1/products`;

  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Failed to fetch products");
  }

  return result.data as AirtableProduct[];
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

// ── Build a single hamper ───────────────────────────────────────────
function buildHamper(
  heroes: AirtableProduct[],
  supporting: AirtableProduct[],
  fillers: AirtableProduct[],
  packaging: AirtableProduct | null,
  data: QuestionnaireData,
  perHamperBudget: number,
  index: number
): GeneratedHamper | null {
  const remainingBudget = perHamperBudget - data.packagingCost;
  const heroBudget = remainingBudget * (data.heroBudgetPercent / 100);
  const supportingBudget = remainingBudget * (data.supportingBudgetPercent / 100);
  const fillerBudget = remainingBudget - heroBudget - supportingBudget;

  const selectedHeroes = selectWithinBudget(heroes, data.heroCount, heroBudget, true);
  const selectedSupporting = selectWithinBudget(supporting, data.supportingCount, supportingBudget, true);
  const selectedFillers = selectWithinBudget(fillers, data.fillerCount, fillerBudget, false);

  const allSelected = [...selectedHeroes, ...selectedSupporting, ...selectedFillers];
  if (allSelected.length === 0) return null;

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

  const heroImage = selectedHeroes.find((h) => h.image)?.image;
  const anyImage = allSelected.find((p) => p.image)?.image;
  const fallbackImage = "https://images.unsplash.com/photo-1549465220-1a8b9238f0b0?w=400&h=300&fit=crop";

  return {
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
  };
}

// ── Main generator ──────────────────────────────────────────────────
export async function generateHampersFromAirtable(
  data: QuestionnaireData
): Promise<GeneratedHamper[]> {
  const allProducts = await fetchProducts();

  // Step 2: Filter
  const filtered = allProducts.filter(
    (p) => p.product_tier !== "pending" && p.unsold_after_receivables >= data.quantity
  );

  // Step 3: Split by tier
  let heroes = filtered.filter((p) => p.product_tier === "hero");
  let supporting = filtered.filter((p) => p.product_tier === "supporting");
  let fillers = filtered.filter((p) => p.product_tier === "filler");
  const packagingProducts = filtered.filter((p) => p.product_tier === "packaging");

  // Step 5: Category filter
  const prefValue = data.heroPreference;
  if (prefValue && prefValue !== "no-preference" && prefValue !== "custom") {
    const categoryFilter = (p: AirtableProduct) =>
      p.category.toLowerCase().replace(/[\s&-]+/g, "-") === prefValue ||
      p.category.toLowerCase().includes(prefValue.replace(/-/g, " "));

    const filteredHeroes = heroes.filter(categoryFilter);
    const filteredSupporting = supporting.filter(categoryFilter);
    const filteredFillers = fillers.filter(categoryFilter);

    // Only apply if we have enough products after filtering
    if (filteredHeroes.length >= data.heroCount) heroes = filteredHeroes;
    if (filteredSupporting.length >= data.supportingCount) supporting = filteredSupporting;
    if (filteredFillers.length >= data.fillerCount) fillers = filteredFillers;
  }

  // Step 6: Budget
  const perHamperBudget =
    data.budgetMode === "total"
      ? Math.round(data.budget / Math.max(data.quantity, 1))
      : data.budget;

  // Step 10: Packaging
  const selectedPackaging = selectPackaging(packagingProducts, data.packagingCost);

  // Step 13: Generate 5 variations
  const hampers: GeneratedHamper[] = [];

  for (let i = 0; i < 5; i++) {
    let heroPool = [...heroes];
    let supportPool = shuffle(supporting);
    let fillerPool = shuffle(fillers);

    // Variation strategies
    if (i === 1 && heroPool.length > 1) {
      heroPool = heroPool.slice(1); // Skip first hero
    }
    if (i === 2) {
      heroPool = shuffle(heroPool);
    }
    if (i >= 3) {
      heroPool = shuffle(heroPool);
      supportPool = shuffle(supportPool);
      fillerPool = shuffle(fillerPool);
    }

    const hamper = buildHamper(
      heroPool,
      supportPool,
      fillerPool,
      selectedPackaging,
      data,
      perHamperBudget,
      i
    );

    if (hamper) {
      if (i >= 3) hamper.isBackup = true;
      hampers.push(hamper);
    }
  }

  // Sort: green first, then yellow, then red
  hampers.sort((a, b) => {
    const order = { green: 0, yellow: 1, red: 2 };
    return order[a.feasibility] - order[b.feasibility];
  });

  // Return top 3 as main + rest as backups
  hampers.forEach((h, i) => {
    if (i >= 3) h.isBackup = true;
    h.id = `gen-${i}`;
    h.name = i < 3 ? `Hamper Option ${i + 1}` : `Backup ${i - 2}`;
  });

  return hampers;
}
