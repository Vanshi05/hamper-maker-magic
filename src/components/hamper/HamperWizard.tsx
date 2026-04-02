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
  X,
  AlertTriangle,
  Package,
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
import { memo, useRef, useEffect } from "react";

/* ── Must-Have Product List (stable component to preserve input focus) ── */
const MustHaveProductList = memo(function MustHaveProductList({
  options, selected, search, onSearchChange, onToggle, expanded, onToggleExpand, initialCount,
}: {
  options: string[]; selected: string[]; search: string; onSearchChange: (v: string) => void;
  onToggle: (item: string) => void; expanded: boolean; onToggleExpand: () => void; initialCount: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? options.filter((item) => item.toLowerCase().includes(searchLower))
    : options;
  const unselectedFiltered = filtered.filter((item) => !selected.includes(item));
  const visibleUnselected = expanded || searchLower ? unselectedFiltered : unselectedFiltered.slice(0, initialCount);
  const totalHidden = unselectedFiltered.length - visibleUnselected.length;
  const showToggle = !searchLower && totalHidden > 0;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search products..."
          className="h-8 text-xs pl-8"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap max-h-[250px] overflow-y-auto py-0.5">
        {visibleUnselected.map((item) => (
          <Badge
            key={item}
            variant="outline"
            className="cursor-pointer text-[10px] px-2.5 py-1 rounded-full hover:bg-primary/10 hover:border-primary/30 transition-colors"
            onClick={() => onToggle(item)}
          >
            {item}
          </Badge>
        ))}
        {filtered.length === 0 && (
          <p className="text-[10px] text-muted-foreground py-1">No matching products</p>
        )}
      </div>
      {showToggle && (
        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 w-full text-muted-foreground" onClick={onToggleExpand}>
          {expanded ? (
            <><ChevronUp className="h-3 w-3 mr-1" /> Show Less</>
          ) : (
            <><ChevronDown className="h-3 w-3 mr-1" /> Show More ({totalHidden} more)</>
          )}
        </Button>
      )}
    </div>
  );
});

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

const DIETARY_PRESETS = [
  { label: "No Nuts", keyword: "no nuts" },
  { label: "Vegan", keyword: "vegan" },
  { label: "No Sugar", keyword: "no sugar" },
  { label: "Gluten Free", keyword: "no gluten" },
  { label: "No Dairy", keyword: "no dairy" },
];

const SectionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3", className)}>
    {children}
  </div>
);

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
  const [activeDietaryPresets, setActiveDietaryPresets] = useState<Set<string>>(new Set());
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

  const toggleDietaryPreset = useCallback((keyword: string) => {
    setActiveDietaryPresets((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      // Build combined dietary notes from active presets + custom text
      const presetParts = Array.from(next);
      // Preserve any custom text the user typed that isn't a preset keyword
      const currentCustom = data.dietaryNotes
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && !DIETARY_PRESETS.some((dp) => dp.keyword === s));
      const combined = [...presetParts, ...currentCustom].filter(Boolean).join(", ");
      update("dietaryNotes", combined);
      return next;
    });
  }, [data.dietaryNotes, update]);

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const fillerBudgetPercent = Math.max(0, 100 - data.heroBudgetPercent - data.supportingBudgetPercent);
  const budgetTotal = data.heroBudgetPercent + data.supportingBudgetPercent + fillerBudgetPercent;
  const budgetWarning = budgetTotal !== 100;

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

        {/* ═══ STEP 0: BASICS ═══ */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Information</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Client Name *</Label>
                  <Input value={data.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="e.g. Rahul Sharma" className={cn("h-9 text-sm", errors.clientName && "border-destructive")} autoFocus />
                  {errors.clientName && <p className="text-[10px] text-destructive">{errors.clientName}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input value={data.company} onChange={(e) => update("company", e.target.value)} placeholder="e.g. Acme Corp" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Contact</Label>
                  <Input value={data.contact} onChange={(e) => update("contact", e.target.value)} placeholder="Phone or email" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Delivery Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left h-9 text-sm font-normal", !data.deliveryDate && "text-muted-foreground", errors.deliveryDate && "border-destructive")}>
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                        {data.deliveryDate ? format(data.deliveryDate, "dd MMM yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={data.deliveryDate} onSelect={(d) => update("deliveryDate", d)} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} className="p-2 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {errors.deliveryDate && <p className="text-[10px] text-destructive">{errors.deliveryDate}</p>}
                </div>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Details</h2>
              <div className="space-y-1.5">
                <Label className="text-xs">Budget Mode</Label>
                <div className="flex gap-2">
                  {(["per-hamper", "total"] as const).map((m) => (
                    <Button key={m} variant={data.budgetMode === m ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => update("budgetMode", m)}>
                      {m === "per-hamper" ? "Per Hamper" : "Total Budget"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{data.budgetMode === "per-hamper" ? "Budget per hamper" : "Total budget"} (₹)</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-base font-bold" onClick={() => update("budget", Math.max(100, data.budget - 100))}>−</Button>
                  <div className="relative w-[160px]">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                    <Input type="number" value={data.budget} onChange={(e) => update("budget", Math.max(0, Number(e.target.value) || 0))} className={cn("h-9 text-base font-semibold pl-7 text-center", errors.budget && "border-destructive")} />
                  </div>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-base font-bold" onClick={() => update("budget", data.budget + 100)}>+</Button>
                </div>
                {errors.budget && <p className="text-[10px] text-destructive">{errors.budget}</p>}
                <div className="flex gap-1.5 flex-wrap">
                  {BUDGET_PRESETS.map((p) => (
                    <Button key={p} variant={data.budget === p ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-3 rounded-full" onClick={() => update("budget", p)}>{fmt(p)}</Button>
                  ))}
                </div>
                {data.budgetMode === "total" && data.quantity > 0 && (
                  <p className="text-[10px] text-muted-foreground">≈ {fmt(Math.round(data.budget / data.quantity))} per hamper</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input type="number" value={data.quantity} onChange={(e) => update("quantity", Number(e.target.value) || 1)} className={cn("h-9 text-sm w-[120px]", errors.quantity && "border-destructive")} min={1} />
                {errors.quantity && <p className="text-[10px] text-destructive">{errors.quantity}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 1: PREFERENCES ═══ */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Product Preference</h2>
              <div className="space-y-1">
                <Label className="text-xs">Preferred Category</Label>
                {isLoadingProducts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading categories…</div>
                ) : (
                  <Select value={data.heroPreference} onValueChange={(v) => update("heroPreference", v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {options.heroOptions.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-[10px] text-muted-foreground">Leave empty for broader product selection</p>
              </div>
            </div>
            <div className="border-t border-border" />
            <div className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client Intent</h2>
              <p className="text-xs text-muted-foreground">Pick the intent that best matches this order.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {INTENT_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = data.priorityMode === preset.value;
                  return (
                    <button key={preset.value} type="button" onClick={() => update("priorityMode", preset.value)}
                      className={cn("relative flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all",
                        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40 hover:shadow-[0_1px_6px_-2px_hsl(var(--foreground)/0.08)]"
                      )}>
                      {isSelected && (<div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center"><Check className="h-2.5 w-2.5 text-primary-foreground" /></div>)}
                      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
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

        {/* ═══ STEP 2: CUSTOMIZATION — Control Panel ═══ */}
        {step === 2 && (
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">

            {/* ── Block 1: Must-Have Products ── */}
            <SectionCard>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Must-Have Products</h2>

              {/* Selected items strip */}
              {data.mustHaveItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground">Selected ({data.mustHaveItems.length})</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {data.mustHaveItems.map((item) => (
                      <Badge key={item} variant="default" className="cursor-pointer text-[10px] pl-2 pr-1 py-0.5 gap-1 rounded-full" onClick={() => toggleArrayItem("mustHaveItems", item)}>
                        {item}
                        <X className="h-2.5 w-2.5 opacity-70 hover:opacity-100" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {isLoadingProducts ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading products…</div>
              ) : (
                <MustHaveProductList
                  options={options.mustHaveOptions}
                  selected={data.mustHaveItems}
                  search={mustHaveSearch}
                  onSearchChange={setMustHaveSearch}
                  onToggle={(item) => toggleArrayItem("mustHaveItems", item)}
                  expanded={mustHaveExpanded}
                  onToggleExpand={() => setMustHaveExpanded(!mustHaveExpanded)}
                  initialCount={MUST_HAVE_INITIAL_COUNT}
                />
              )}
            </SectionCard>

            {/* ── Block 2: Exclusions ── */}
            <SectionCard>
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Exclusions</h2>
                {data.forbiddenCategories.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-destructive" onClick={() => update("forbiddenCategories", [])}>
                    Clear all
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Selected categories will be excluded from hamper generation</p>
              {isLoadingProducts ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {options.categories.map((cat) => {
                    const isExcluded = data.forbiddenCategories.includes(cat);
                    return (
                      <Badge
                        key={cat}
                        variant={isExcluded ? "destructive" : "outline"}
                        className={cn(
                          "cursor-pointer text-[10px] px-2.5 py-1 rounded-full transition-colors",
                          !isExcluded && "hover:bg-destructive/10 hover:border-destructive/30"
                        )}
                        onClick={() => toggleArrayItem("forbiddenCategories", cat)}
                      >
                        {isExcluded && <X className="h-2.5 w-2.5 mr-0.5" />}
                        {cat}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* ── Block 3: Dietary Preferences ── */}
            <SectionCard>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dietary Preferences</h2>
              <p className="text-[10px] text-muted-foreground">These preferences will filter incompatible products</p>

              {/* Preset toggles */}
              <div className="flex gap-1.5 flex-wrap">
                {DIETARY_PRESETS.map((preset) => {
                  const isActive = activeDietaryPresets.has(preset.keyword);
                  return (
                    <Button
                      key={preset.keyword}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={cn("h-7 text-xs rounded-full gap-1", isActive && "pr-2")}
                      onClick={() => toggleDietaryPreset(preset.keyword)}
                    >
                      {isActive && <Check className="h-3 w-3" />}
                      {preset.label}
                    </Button>
                  );
                })}
              </div>

              {/* Active dietary tags */}
              {activeDietaryPresets.size > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {Array.from(activeDietaryPresets).map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full gap-1">
                      {DIETARY_PRESETS.find((d) => d.keyword === kw)?.label ?? kw}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Custom input */}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Other dietary notes</Label>
                <Input
                  value={data.dietaryNotes}
                  onChange={(e) => update("dietaryNotes", e.target.value)}
                  placeholder="e.g. No shellfish, halal only"
                  className="h-8 text-xs"
                />
              </div>
            </SectionCard>

            {/* ── Block 4: Hamper Configuration ── */}
            <SectionCard>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hamper Configuration</h2>

              {/* Sub-section: Product Structure */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground">Product Structure</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Hero</Label>
                    <Input type="number" value={data.heroCount} onChange={(e) => update("heroCount", Math.min(3, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={3} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Supporting</Label>
                    <Input type="number" value={data.supportingCount} onChange={(e) => update("supportingCount", Math.min(3, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={3} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Filler</Label>
                    <Input type="number" value={data.fillerCount} onChange={(e) => update("fillerCount", Math.min(6, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={6} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* Sub-section: Budget Distribution */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground">Budget Distribution</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Hero %</Label>
                    <Input type="number" value={data.heroBudgetPercent} onChange={(e) => update("heroBudgetPercent", Math.min(80, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={80} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Supporting %</Label>
                    <Input type="number" value={data.supportingBudgetPercent} onChange={(e) => update("supportingBudgetPercent", Math.min(60, Math.max(0, Number(e.target.value) || 0)))} className="h-8 text-sm text-center" min={0} max={60} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Filler %</Label>
                    <div className="h-8 flex items-center justify-center text-sm font-medium bg-muted rounded-md">{fillerBudgetPercent}%</div>
                  </div>
                </div>
                {budgetWarning && (
                  <div className="flex items-center gap-1.5 text-[10px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    Total must equal 100% (currently {budgetTotal}%)
                  </div>
                )}
              </div>
            </SectionCard>

            {/* ── Block 5: Packaging ── */}
            <SectionCard>
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Packaging</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PACKAGING_OPTIONS.map((p) => {
                  const isSelected = data.packagingType === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { update("packagingType", p.value); update("packagingCost", PACKAGING_COST_MAP[p.value]); }}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center transition-all",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <Package className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                      <span className={cn("text-xs font-medium", isSelected && "text-primary")}>{p.label}</span>
                      <span className="text-[10px] text-muted-foreground">~{fmt(p.cost)}</span>
                      {isSelected && (
                        <div className="h-3 w-3 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-2 w-2 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Packaging Cost (₹) — auto-filled, editable</Label>
                <Input type="number" value={data.packagingCost} onChange={(e) => update("packagingCost", Math.max(0, Number(e.target.value) || 0))} className="h-8 text-sm w-[120px]" />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══ STEP 3: REVIEW ═══ */}
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
