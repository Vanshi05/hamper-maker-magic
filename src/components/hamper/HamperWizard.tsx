import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ClipboardList,
  Heart,
  SlidersHorizontal,
  FileCheck,
  Check,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
  Scale,
  Wallet,
  Zap,
  Crown,
} from "lucide-react";
import {
  type QuestionnaireData,
  DEFAULT_QUESTIONNAIRE,
  HERO_OPTIONS,
  PACKAGING_OPTIONS,
  PACKAGING_COST_MAP,
} from "./types";
import type { AirtableProduct } from "./airtableGenerator";
import { extractDynamicOptions } from "./airtableGenerator";

interface HamperWizardProps {
  onGenerate: (data: QuestionnaireData) => void;
  products?: AirtableProduct[];
  isLoadingProducts?: boolean;
}

const STEPS = [
  { label: "Basics", icon: ClipboardList },
  { label: "Preferences", icon: Heart },
  { label: "Customization", icon: SlidersHorizontal },
  { label: "Review", icon: FileCheck },
];

const BUDGET_PRESETS = [1000, 1500, 2000, 3000, 5000];

const INTENT_PRESETS: {
  value: QuestionnaireData["priorityMode"];
  label: string;
  description: string;
  icon: typeof Scale;
}[] = [
  { value: "balanced", label: "Balanced", description: "Optimized mix of price, delivery speed, and premium feel.", icon: Scale },
  { value: "budget", label: "Budget Safe", description: "Strictly stays within budget and avoids expensive premium items.", icon: Wallet },
  { value: "fast", label: "Fast Delivery", description: "Prioritizes in-stock products and shortest lead-time combinations.", icon: Zap },
  { value: "premium", label: "Premium Client", description: "Focuses on luxury items, higher perceived value, and premium packaging.", icon: Crown },
];

const HamperWizard = ({ onGenerate, products = [], isLoadingProducts }: HamperWizardProps) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuestionnaireData>({ ...DEFAULT_QUESTIONNAIRE });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [mustHaveSearch, setMustHaveSearch] = useState("");
  const [mustHaveExpanded, setMustHaveExpanded] = useState(false);
  const MUST_HAVE_INITIAL_COUNT = 12;

  const dynamicOptions = useCallback(() => {
    if (products.length === 0) {
      return {
        categories: [] as string[],
        productTypes: [] as string[],
        productNames: [] as string[],
        mustHaveOptions: [] as string[],
        heroOptions: HERO_OPTIONS,
      };
    }
    return extractDynamicOptions(products);
  }, [products]);

  const options = dynamicOptions();

  const update = useCallback(<K extends keyof QuestionnaireData>(key: K, value: QuestionnaireData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {};
    if (step === 0) {
      if (!data.clientName.trim()) errs.clientName = "Required";
      if (!data.deliveryDate) errs.deliveryDate = "Required";
      if (data.budget < 200) errs.budget = "Min ₹200";
      if (data.quantity < 1) errs.quantity = "Min 1";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const prev = () => step > 0 && setStep(step - 1);

  const handleGenerate = () => {
    onGenerate(data);
  };

  const toggleArrayItem = (key: "mustHaveItems" | "forbiddenCategories", item: string) => {
    const arr = data[key];
    update(key, arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const fillerBudgetPercent = Math.max(0, 100 - data.heroBudgetPercent - data.supportingBudgetPercent);

  const intentLabel = INTENT_PRESETS.find((p) => p.value === data.priorityMode)?.label ?? data.priorityMode;
  const packagingLabel = PACKAGING_OPTIONS.find((p) => p.value === data.packagingType)?.label ?? data.packagingType;
  const categoryLabel = options.heroOptions.find((o) => o.value === data.heroPreference)?.label ?? data.heroPreference;

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Page header */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Design a Gift Hamper</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === 0 && "Enter basic details to get started"}
              {step === 1 && "Set your product and intent preferences"}
              {step === 2 && "Fine-tune constraints and hamper structure"}
              {step === 3 && "Review your selections and generate"}
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => { if (i < step) setStep(i); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                i === step
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : i < step
                    ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20"
                    : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-[0_2px_12px_-4px_hsl(var(--foreground)/0.08)] min-h-[340px]">

        {/* ═══ STEP 0: BASICS (Client + Budget merged) ═══ */}
        {step === 0 && (
          <div className="space-y-6">
            {/* Section: Client Info */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Client Name *</Label>
                  <Input
                    value={data.clientName}
                    onChange={(e) => update("clientName", e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    className={cn("h-9 text-sm", errors.clientName && "border-destructive")}
                    autoFocus
                  />
                  {errors.clientName && <p className="text-[10px] text-destructive">{errors.clientName}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={data.company}
                    onChange={(e) => update("company", e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact</Label>
                  <Input
                    value={data.contact}
                    onChange={(e) => update("contact", e.target.value)}
                    placeholder="Phone or email"
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Delivery Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left h-9 text-sm font-normal",
                          !data.deliveryDate && "text-muted-foreground",
                          errors.deliveryDate && "border-destructive"
                        )}
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                        {data.deliveryDate ? format(data.deliveryDate, "dd MMM yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.deliveryDate}
                        onSelect={(d) => update("deliveryDate", d)}
                        className="p-2 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.deliveryDate && <p className="text-[10px] text-destructive">{errors.deliveryDate}</p>}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Section: Order Details */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Details</h2>

              {/* Budget Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs">Budget Mode</Label>
                <div className="flex gap-2">
                  {(["per-hamper", "total"] as const).map((m) => (
                    <Button
                      key={m}
                      variant={data.budgetMode === m ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => update("budgetMode", m)}
                    >
                      {m === "per-hamper" ? "Per Hamper" : "Total Budget"}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Budget input */}
              <div className="space-y-2">
                <Label className="text-xs">
                  {data.budgetMode === "per-hamper" ? "Budget per hamper" : "Total budget"} (₹)
                </Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-base font-bold" onClick={() => update("budget", Math.max(100, data.budget - 100))}>−</Button>
                  <div className="relative w-[160px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                    <Input
                      type="number"
                      value={data.budget}
                      onChange={(e) => update("budget", Math.max(0, Number(e.target.value) || 0))}
                      className={cn("h-9 text-base font-semibold pl-7 text-center", errors.budget && "border-destructive")}
                    />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-base font-bold" onClick={() => update("budget", data.budget + 100)}>+</Button>
                </div>
                {errors.budget && <p className="text-[10px] text-destructive">{errors.budget}</p>}
                <div className="flex gap-1.5 flex-wrap">
                  {BUDGET_PRESETS.map((p) => (
                    <Button key={p} variant={data.budget === p ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-3 rounded-full" onClick={() => update("budget", p)}>
                      {fmt(p)}
                    </Button>
                  ))}
                </div>
                {data.budgetMode === "total" && data.quantity > 0 && (
                  <p className="text-[10px] text-muted-foreground">≈ {fmt(Math.round(data.budget / data.quantity))} per hamper</p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  value={data.quantity}
                  onChange={(e) => update("quantity", Number(e.target.value) || 1)}
                  className={cn("h-9 text-sm w-[120px]", errors.quantity && "border-destructive")}
                  min={1}
                />
                {errors.quantity && <p className="text-[10px] text-destructive">{errors.quantity}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 1: PREFERENCES (Category + Intent) ═══ */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Product Preference */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Product Preference</h2>
              <div className="space-y-1">
                <Label className="text-xs">Preferred Category</Label>
                {isLoadingProducts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading categories…
                  </div>
                ) : (
                  <Select value={data.heroPreference} onValueChange={(v) => update("heroPreference", v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.heroOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[10px] text-muted-foreground">Leave empty for broader product selection</p>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Client Intent */}
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Intent</h2>
              <p className="text-xs text-muted-foreground">Pick the intent that best matches this order.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INTENT_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = data.priorityMode === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => update("priorityMode", preset.value)}
                      className={cn(
                        "relative flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/40 hover:shadow-[0_1px_6px_-2px_hsl(var(--foreground)/0.08)]"
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <div className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className={cn("text-sm font-semibold", isSelected && "text-primary")}>{preset.label}</p>
                        <p className="text-[10px] leading-snug text-muted-foreground">{preset.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: CUSTOMIZATION (Constraints + Structure + Packaging) ═══ */}
        {step === 2 && (
          <div className="space-y-5 max-h-[420px] overflow-y-auto pr-1">
            {/* Must-have items */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Must-Have Items</h2>
              <p className="text-[10px] text-muted-foreground">Selected items must appear in hamper</p>
              {isLoadingProducts ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading products…
                </div>
              ) : (() => {
                const searchLower = mustHaveSearch.toLowerCase();
                const filtered = searchLower
                  ? options.mustHaveOptions.filter((item) => item.toLowerCase().includes(searchLower))
                  : options.mustHaveOptions;

                const selectedItems = filtered.filter((item) => data.mustHaveItems.includes(item));
                const unselectedItems = filtered.filter((item) => !data.mustHaveItems.includes(item));

                const visibleUnselected = mustHaveExpanded || searchLower
                  ? unselectedItems
                  : unselectedItems.slice(0, Math.max(0, MUST_HAVE_INITIAL_COUNT - selectedItems.length));

                const visibleItems = [...selectedItems, ...visibleUnselected];
                const totalHidden = unselectedItems.length - visibleUnselected.length;
                const showToggle = !searchLower && totalHidden > 0;

                return (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input
                        value={mustHaveSearch}
                        onChange={(e) => setMustHaveSearch(e.target.value)}
                        placeholder="Search products…"
                        className="h-7 text-xs pl-7"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap max-h-[200px] overflow-y-auto">
                      {visibleItems.map((item) => (
                        <Badge
                          key={item}
                          variant={data.mustHaveItems.includes(item) ? "default" : "outline"}
                          className="cursor-pointer text-[10px] px-2 py-0.5"
                          onClick={() => toggleArrayItem("mustHaveItems", item)}
                        >
                          {item}
                        </Badge>
                      ))}
                      {filtered.length === 0 && (
                        <p className="text-[10px] text-muted-foreground py-1">No matching products</p>
                      )}
                    </div>
                    {showToggle && (
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 w-full" onClick={() => setMustHaveExpanded(!mustHaveExpanded)}>
                        {mustHaveExpanded ? (
                          <><ChevronUp className="h-3 w-3 mr-1" /> Show Less</>
                        ) : (
                          <><ChevronDown className="h-3 w-3 mr-1" /> Show More ({totalHidden} more)</>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="border-t border-border" />

            {/* Forbidden categories */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Forbidden Categories</h2>
              <p className="text-[10px] text-muted-foreground">Selected categories will be excluded</p>
              {isLoadingProducts ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading categories…
                </div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {options.categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={data.forbiddenCategories.includes(cat) ? "destructive" : "outline"}
                      className="cursor-pointer text-[10px] px-2 py-0.5"
                      onClick={() => toggleArrayItem("forbiddenCategories", cat)}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Dietary notes */}
            <div className="space-y-1">
              <Label className="text-xs">Dietary Notes</Label>
              <Input
                value={data.dietaryNotes}
                onChange={(e) => update("dietaryNotes", e.target.value)}
                placeholder="e.g. No nuts, vegan only"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Supports: no nuts, vegan, no sugar, no gluten, no dairy</p>
            </div>

            <div className="border-t border-border" />

            {/* Hamper Structure */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hamper Structure</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Hero Products</Label>
                  <Input type="number" value={data.heroCount} onChange={(e) => update("heroCount", Math.min(3, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={3} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Supporting Products</Label>
                  <Input type="number" value={data.supportingCount} onChange={(e) => update("supportingCount", Math.min(3, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={3} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Filler Products</Label>
                  <Input type="number" value={data.fillerCount} onChange={(e) => update("fillerCount", Math.min(6, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={6} />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Budget Allocation */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Budget Allocation</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Hero Budget %</Label>
                  <Input type="number" value={data.heroBudgetPercent} onChange={(e) => update("heroBudgetPercent", Math.min(60, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={60} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Supporting Budget %</Label>
                  <Input type="number" value={data.supportingBudgetPercent} onChange={(e) => update("supportingBudgetPercent", Math.min(40, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={40} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Filler Budget %</Label>
                  <div className="h-8 flex items-center justify-center text-sm font-medium bg-muted rounded-md">{fillerBudgetPercent}%</div>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Packaging */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Packaging</h2>
              <div className="flex gap-1.5 flex-wrap">
                {PACKAGING_OPTIONS.map((p) => (
                  <Button
                    key={p.value}
                    variant={data.packagingType === p.value ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { update("packagingType", p.value); update("packagingCost", PACKAGING_COST_MAP[p.value]); }}
                  >
                    {p.label} (~{fmt(p.cost)})
                  </Button>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Custom Packaging Cost</Label>
                <Input type="number" value={data.packagingCost} onChange={(e) => update("packagingCost", Math.max(0, Number(e.target.value) || 0))} className="h-8 text-sm w-[120px]" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: REVIEW & GENERATE ═══ */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Review Your Selections</h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              <div className="text-muted-foreground text-xs">Client</div>
              <div className="font-medium text-xs">{data.clientName || "—"}{data.company ? ` · ${data.company}` : ""}</div>

              <div className="text-muted-foreground text-xs">Delivery Date</div>
              <div className="font-medium text-xs">{data.deliveryDate ? format(data.deliveryDate, "dd MMM yyyy") : "—"}</div>

              <div className="text-muted-foreground text-xs">Budget</div>
              <div className="font-medium text-xs">{fmt(data.budget)} {data.budgetMode === "per-hamper" ? "per hamper" : "total"}</div>

              <div className="text-muted-foreground text-xs">Quantity</div>
              <div className="font-medium text-xs">{data.quantity}</div>

              <div className="col-span-2 border-t border-border my-1" />

              <div className="text-muted-foreground text-xs">Category</div>
              <div className="font-medium text-xs">{categoryLabel}</div>

              <div className="text-muted-foreground text-xs">Intent</div>
              <div className="font-medium text-xs">{intentLabel}</div>

              <div className="text-muted-foreground text-xs">Packaging</div>
              <div className="font-medium text-xs">{packagingLabel} ({fmt(data.packagingCost)})</div>

              <div className="text-muted-foreground text-xs">Structure (H/S/F)</div>
              <div className="font-medium text-xs">{data.heroCount} / {data.supportingCount} / {data.fillerCount}</div>

              {data.mustHaveItems.length > 0 && (
                <>
                  <div className="col-span-2 border-t border-border my-1" />
                  <div className="text-muted-foreground text-xs">Must-have</div>
                  <div className="font-medium text-xs">{data.mustHaveItems.join(", ")}</div>
                </>
              )}

              {data.forbiddenCategories.length > 0 && (
                <>
                  <div className="text-muted-foreground text-xs">Forbidden</div>
                  <div className="font-medium text-xs">{data.forbiddenCategories.join(", ")}</div>
                </>
              )}

              {data.dietaryNotes && (
                <>
                  <div className="text-muted-foreground text-xs">Dietary</div>
                  <div className="font-medium text-xs">{data.dietaryNotes}</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-5">
        <Button variant="outline" size="sm" onClick={prev} disabled={step === 0} className="gap-1 text-xs">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={next} className="gap-1 text-xs">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button onClick={handleGenerate} className="gap-1.5 text-sm font-semibold px-6 h-10 shadow-sm">
            <Sparkles className="h-4 w-4" /> Generate Hampers
          </Button>
        )}
      </div>
    </div>
  );
};

export default HamperWizard;
