// ── Questionnaire types ──────────────────────────────────────────────
export interface QuestionnaireData {
  // Step 1: Client & Context
  clientName: string;
  company: string;
  contact: string;
  deliveryDate: Date | undefined;

  // Step 2: Budget & Quantity
  budgetMode: "total" | "per-hamper";
  budget: number;
  quantity: number;

  // Step 3: Theme
  heroPreference: string;

  // Step 4: Constraints
  mustHaveItems: string[];
  forbiddenCategories: string[];
  dietaryNotes: string;

  // Hamper Structure
  heroCount: number;
  supportingCount: number;
  fillerCount: number;

  // Budget Allocation
  heroBudgetPercent: number;
  supportingBudgetPercent: number;
  packagingCost: number;

  // Packaging
  packagingType: string;

  maxLeadTimeDays: number;

  // Step 5: Intent Preset
  priorityMode: "balanced" | "budget" | "fast" | "premium";
}

export const PACKAGING_COST_MAP: Record<string, number> = {
  standard: 120,
  premium: 250,
  eco: 180,
  luxury: 400,
};

export const DEFAULT_QUESTIONNAIRE: QuestionnaireData = {
  clientName: "",
  company: "",
  contact: "",
  deliveryDate: undefined,
  budgetMode: "per-hamper",
  budget: 2000,
  quantity: 10,
  heroPreference: "no-preference",
  mustHaveItems: [],
  forbiddenCategories: [],
  dietaryNotes: "",
  heroCount: 1,
  supportingCount: 1,
  fillerCount: 2,
  heroBudgetPercent: 45,
  supportingBudgetPercent: 25,
  packagingCost: 120,
  packagingType: "standard",
  maxLeadTimeDays: 7,
  priorityMode: "balanced",
};

// ── Hamper types ─────────────────────────────────────────────────────
export interface HamperItem {
  name: string;
  qty: number;
  unitPrice: number;
  role: "hero" | "supporting" | "filler" | "packaging";
}

export type BadgeType = "LOW STOCK" | "FAST DELIVERY" | "PREMIUM";
export type Feasibility = "green" | "yellow" | "red";

export interface InventoryStatus {
  stockAvailable: number;
  requiredQuantity: number;
  status: "Safe" | "Low" | "Out of Stock";
}

export interface GeneratedHamper {
  id: string;
  name: string;
  heroProduct: string;
  sideItems: string[];
  totalPrice: number;
  image: string;
  badges: BadgeType[];
  items: HamperItem[];
  gstPercent: number;
  feasibility: Feasibility;
  whyChosen: string[];
  isBackup?: boolean;
  inventory: InventoryStatus;
}

// ── Constants ────────────────────────────────────────────────────────
export const HERO_OPTIONS = [
  { value: "no-preference", label: "No Preference" },
  { value: "accessories", label: "Accessories" },
  { value: "personal-care", label: "Personal Care" },
  { value: "snacks", label: "Snacks" },
  { value: "wellness", label: "Wellness" },
  { value: "beverages", label: "Beverages" },
  { value: "stationery", label: "Stationery" },
  { value: "custom", label: "Custom" },
];

export const PACKAGING_OPTIONS = [
  { value: "standard", label: "Standard Box", cost: 120 },
  { value: "premium", label: "Premium Gift Box", cost: 250 },
  { value: "eco", label: "Eco-Friendly", cost: 180 },
  { value: "luxury", label: "Luxury Hamper Basket", cost: 400 },
];

export const CATEGORY_OPTIONS = [
  "Chocolates & Sweets",
  "Dry Fruits & Nuts",
  "Wellness & Self-Care",
  "Stationery & Desk",
  "Beverages",
  "Eco-Friendly",
];

export const MUST_HAVE_OPTIONS = [
  "Artisan Chocolate",
  "Premium Cashews",
  "Green Tea",
  "Scented Candle",
  "Bamboo Tumbler",
  "Honey Jar",
  "Trail Mix",
  "Masala Chai",
];
