import type { QuestionnaireData, GeneratedHamper, HamperItem } from "./types";

// ── Pool of items per role and preference ────────────────────────────
const HERO_POOL: Record<string, { name: string; price: number }[]> = {
  snacks: [
    { name: "Artisan Chocolate Box", price: 550 },
    { name: "Belgian Truffles", price: 680 },
    { name: "Premium Cookie Tin", price: 480 },
  ],
  accessories: [
    { name: "Leather Notebook", price: 450 },
    { name: "Premium Pen Set", price: 380 },
    { name: "Desk Organizer", price: 520 },
  ],
  "personal-care": [
    { name: "Organic Superfood Mix", price: 680 },
    { name: "Essential Oil Set", price: 450 },
    { name: "Herbal Soap Set", price: 370 },
  ],
  wellness: [
    { name: "Bamboo Tumbler", price: 420 },
    { name: "Lavender Candle", price: 350 },
    { name: "Wellness Kit", price: 600 },
  ],
  beverages: [
    { name: "Cold Brew Kit", price: 480 },
    { name: "Specialty Coffee Beans", price: 390 },
    { name: "Herbal Infusion Set", price: 310 },
  ],
  stationery: [
    { name: "Leather Notebook", price: 450 },
    { name: "Premium Pen Set", price: 380 },
    { name: "Eco Pencil Kit", price: 160 },
  ],
  general: [
    { name: "Artisan Chocolate Box", price: 550 },
    { name: "Premium Cashew Tin", price: 480 },
    { name: "Cold Brew Kit", price: 480 },
  ],
};

const SUPPORTING_POOL = [
  { name: "Green Tea Tin", price: 180 },
  { name: "Masala Chai Box", price: 220 },
  { name: "Honey Jar", price: 220 },
  { name: "Scented Candles Set", price: 280 },
  { name: "Mug", price: 200 },
  { name: "Trail Mix Jar", price: 190 },
  { name: "Dried Cranberries Pack", price: 140 },
];

const FILLER_POOL = [
  { name: "Almond Brittle", price: 180 },
  { name: "Dark Chocolate Bar Set", price: 320 },
  { name: "Sticky Notes Collection", price: 120 },
  { name: "Cookie Tin", price: 300 },
  { name: "Fig Jam", price: 180 },
  { name: "Chocolate Coated Almonds", price: 240 },
  { name: "Mixed Nuts Pouch", price: 150 },
  { name: "Herbal Tea Sachet", price: 90 },
];

const IMAGES = [
  "https://images.unsplash.com/photo-1549465220-1a8b9238f0b0?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?w=400&h=300&fit=crop",
];

const HAMPER_NAMES = [
  "Classic Delight Hamper",
  "Premium Wellness Box",
  "Festive Joy Hamper",
  "Executive Gift Set",
  "Artisan Curated Basket",
];

const WHY_CHOSEN_POOL = [
  "Matches budget range perfectly",
  "Aligns with preferred category",
  "Fastest delivery option available",
  "Best value per item ratio",
  "Premium packaging included",
  "Popular choice for corporate clients",
  "Meets dietary requirements",
  "Eco-friendly packaging option",
  "High client satisfaction rating",
  "Seasonal bestseller",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

export function generateHampers(data: QuestionnaireData): GeneratedHamper[] {
  const pref = data.heroPreference === "no-preference" || data.heroPreference === "custom"
    ? "general"
    : data.heroPreference;

  const heroPool = HERO_POOL[pref] || HERO_POOL.general;
  const perHamperBudget = data.budgetMode === "total"
    ? Math.round(data.budget / Math.max(data.quantity, 1))
    : data.budget;

  const results: GeneratedHamper[] = [];

  for (let i = 0; i < 5; i++) {
    const heroes = pickRandom(heroPool, data.heroCount);
    const supports = pickRandom(
      SUPPORTING_POOL.filter((s) => !heroes.some((h) => h.name === s.name)),
      data.supportingCount
    );
    const fillers = pickRandom(
      FILLER_POOL.filter((f) => !heroes.some((h) => h.name === f.name) && !supports.some((s) => s.name === f.name)),
      data.fillerCount
    );

    const items: HamperItem[] = [
      ...heroes.map((h) => ({ name: h.name, qty: 1, unitPrice: h.price, role: "hero" as const })),
      ...supports.map((s) => ({ name: s.name, qty: 1, unitPrice: s.price, role: "supporting" as const })),
      ...fillers.map((f) => ({ name: f.name, qty: 1, unitPrice: f.price, role: "filler" as const })),
      { name: data.packagingType === "standard" ? "Standard Box" : data.packagingType === "premium" ? "Premium Gift Box" : data.packagingType === "eco" ? "Eco-Friendly Pack" : "Luxury Hamper Basket", qty: 1, unitPrice: data.packagingCost, role: "packaging" as const },
    ];

    const totalPrice = items.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
    const withinBudget = totalPrice <= perHamperBudget * 1.15;

    const feasibility: GeneratedHamper["feasibility"] = withinBudget
      ? i < 3 ? "green" : "yellow"
      : "red";

    const badges: GeneratedHamper["badges"] = [];
    if (i === 0) badges.push("FAST DELIVERY");
    if (data.priorityMode === "premium" || i === 1) badges.push("PREMIUM");
    if (i >= 3) badges.push("LOW STOCK");

    const stockAvailable = Math.round(150 + Math.random() * 200);
    const requiredQuantity = data.quantity;

    results.push({
      id: `gen-${i}`,
      name: HAMPER_NAMES[i],
      heroProduct: heroes[0]?.name ?? "Custom Hamper",
      sideItems: [...supports.map((s) => s.name), ...fillers.map((f) => f.name)],
      totalPrice,
      image: IMAGES[i],
      badges,
      items,
      gstPercent: data.priorityMode === "premium" ? 18 : 12,
      feasibility,
      whyChosen: pickRandom(WHY_CHOSEN_POOL, 2 + (i < 3 ? 1 : 0)),
      isBackup: i >= 3,
      inventory: {
        stockAvailable,
        requiredQuantity,
        status: stockAvailable >= requiredQuantity * 1.2 ? "Safe" : stockAvailable >= requiredQuantity ? "Low" : "Out of Stock",
      },
    });
  }

  return results.sort((a, b) => {
    const fOrder = { green: 0, yellow: 1, red: 2 };
    return fOrder[a.feasibility] - fOrder[b.feasibility];
  });
}
