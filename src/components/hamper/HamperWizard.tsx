import { useState, useCallback, useEffect, useMemo } from "react";
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
  User,
  DollarSign,
  Heart,
  ShieldAlert,
  Target,
  Scale,
  Wallet,
  Zap,
  Crown,
  Check,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
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
  { label: "Client", icon: User },
  { label: "Budget", icon: DollarSign },
  { label: "Theme", icon: Heart },
  { label: "Constraints", icon: ShieldAlert },
  { label: "Intent", icon: Target },
];

const BUDGET_PRESETS = [1000, 1500, 2000, 3000, 5000];

const INTENT_PRESETS: {
  value: QuestionnaireData["priorityMode"];
  label: string;
  description: string;
  icon: typeof Scale;
}[] = [
  {
    value: "balanced",
    label: "Balanced",
    description: "Optimized mix of price, delivery speed, and premium feel.",
    icon: Scale,
  },
  {
    value: "budget",
    label: "Budget Safe",
    description: "Strictly stays within budget and avoids expensive premium items.",
    icon: Wallet,
  },
  {
    value: "fast",
    label: "Fast Delivery",
    description: "Prioritizes in-stock products and shortest lead-time combinations.",
    icon: Zap,
  },
  {
    value: "premium",
    label: "Premium Client",
    description: "Focuses on luxury items, higher perceived value, and premium packaging.",
    icon: Crown,
  },
];

const HamperWizard = ({ onGenerate, products = [], isLoadingProducts }: HamperWizardProps) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuestionnaireData>({ ...DEFAULT_QUESTIONNAIRE });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic options derived from products
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
    }
    if (step === 1) {
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
    if (!validateStep()) return;
    onGenerate(data);
  };

  const toggleArrayItem = (key: "mustHaveItems" | "forbiddenCategories", item: string) => {
    const arr = data[key];
    update(key, arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  };

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  const fillerBudgetPercent = Math.max(0, 100 - data.heroBudgetPercent - data.supportingBudgetPercent);

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
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
      <div className="bg-card border border-border rounded-lg p-5 shadow-sm min-h-[320px]">
        {/* Step 0: Client */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground">Client & Context</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Client Name *</Label>
                <Input
                  value={data.clientName}
                  onChange={(e) => update("clientName", e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className={cn("h-8 text-sm", errors.clientName && "border-destructive")}
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
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contact</Label>
                <Input
                  value={data.contact}
                  onChange={(e) => update("contact", e.target.value)}
                  placeholder="Phone or email"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Delivery Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left h-8 text-sm font-normal",
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
                <p className="text-[10px] text-muted-foreground">Delivery date helps ensure suggested hampers can be prepared before the required date.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Budget */}
        {step === 1 && (
          <div className="max-w-[580px] mx-auto w-full space-y-4">
            <h2 className="text-sm font-bold text-foreground">Budget & Quantity</h2>

            {/* Budget Mode toggle */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Budget Mode</Label>
              <div className="flex gap-2 justify-center">
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

            {/* Budget input group */}
            <div className="flex flex-col items-center gap-3">
              <Label className="text-xs font-medium text-muted-foreground">
                {data.budgetMode === "per-hamper" ? "Budget per hamper" : "Total budget"} (₹)
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-base font-bold"
                  onClick={() => update("budget", Math.max(100, data.budget - 100))}
                >
                  −
                </Button>
                <div className="relative w-[180px]">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">₹</span>
                  <Input
                    type="number"
                    value={data.budget}
                    onChange={(e) => update("budget", Math.max(0, Number(e.target.value) || 0))}
                    className={cn("h-10 text-lg font-semibold pl-7 text-center", errors.budget && "border-destructive")}
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-base font-bold"
                  onClick={() => update("budget", data.budget + 100)}
                >
                  +
                </Button>
              </div>

              {/* Preset chips */}
              <div className="flex gap-2 flex-wrap justify-center">
                {BUDGET_PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant={data.budget === p ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-3.5 rounded-full"
                    onClick={() => update("budget", p)}
                  >
                    {fmt(p)}
                  </Button>
                ))}
              </div>

              {data.budgetMode === "total" && data.quantity > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  ≈ {fmt(Math.round(data.budget / data.quantity))} per hamper
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="flex flex-col items-center gap-1.5 pt-2">
              <Label className="text-xs font-medium text-muted-foreground">Quantity</Label>
              <Input
                type="number"
                value={data.quantity}
                onChange={(e) => update("quantity", Number(e.target.value) || 1)}
                className={cn("h-10 text-sm w-[120px] text-center", errors.quantity && "border-destructive")}
                min={1}
              />
            </div>
          </div>
        )}

        {/* Step 2: Theme */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground">Preference & Theme</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Preferred Product Category</Label>
                {isLoadingProducts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading categories…
                  </div>
                ) : (
                  <Select value={data.heroPreference} onValueChange={(v) => update("heroPreference", v)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.heroOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Constraints */}
        {step === 3 && (
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
            <h2 className="text-sm font-bold text-foreground">Constraints</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Must-have items</Label>
                <p className="text-[10px] text-muted-foreground">Selected items must appear in hamper</p>
                {isLoadingProducts ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading products…
                  </div>
                ) : (
                  <div className="flex gap-1.5 flex-wrap max-h-[120px] overflow-y-auto">
                    {options.mustHaveOptions.map((item) => (
                      <Badge
                        key={item}
                        variant={data.mustHaveItems.includes(item) ? "default" : "outline"}
                        className="cursor-pointer text-[10px] px-2 py-0.5"
                        onClick={() => toggleArrayItem("mustHaveItems", item)}
                      >
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Forbidden categories</Label>
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
              <div className="space-y-1">
                <Label className="text-xs">Dietary notes</Label>
                <Input
                  value={data.dietaryNotes}
                  onChange={(e) => update("dietaryNotes", e.target.value)}
                  placeholder="e.g. No nuts, vegan only"
                  className="h-8 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">Supports: no nuts, vegan, no sugar, no gluten, no dairy</p>
              </div>

              {/* Hamper Structure */}
              <div className="border-t border-border pt-3 space-y-2">
                <Label className="text-xs font-bold text-foreground">Hamper Structure</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Hero Products</Label>
                    <Input
                      type="number"
                      value={data.heroCount}
                      onChange={(e) => update("heroCount", Math.min(3, Math.max(0, Number(e.target.value) || 0)))}
                      className="h-8 text-sm text-center"
                      min={0} max={3}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Supporting Products</Label>
                    <Input
                      type="number"
                      value={data.supportingCount}
                      onChange={(e) => update("supportingCount", Math.min(3, Math.max(0, Number(e.target.value) || 0)))}
                      className="h-8 text-sm text-center"
                      min={0} max={3}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Filler Products</Label>
                    <Input
                      type="number"
                      value={data.fillerCount}
                      onChange={(e) => update("fillerCount", Math.min(6, Math.max(0, Number(e.target.value) || 0)))}
                      className="h-8 text-sm text-center"
                      min={0} max={6}
                    />
                  </div>
                </div>
              </div>

              {/* Budget Allocation */}
              <div className="border-t border-border pt-3 space-y-2">
                <Label className="text-xs font-bold text-foreground">Budget Allocation</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Hero Budget %</Label>
                    <Input
                      type="number"
                      value={data.heroBudgetPercent}
                      onChange={(e) => update("heroBudgetPercent", Math.min(60, Math.max(0, Number(e.target.value) || 0)))}
                      className="h-8 text-sm text-center"
                      min={0} max={60}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Supporting Budget %</Label>
                    <Input
                      type="number"
                      value={data.supportingBudgetPercent}
                      onChange={(e) => update("supportingBudgetPercent", Math.min(40, Math.max(0, Number(e.target.value) || 0)))}
                      className="h-8 text-sm text-center"
                      min={0} max={40}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Filler Budget %</Label>
                    <div className="h-8 flex items-center justify-center text-sm font-medium bg-muted rounded-md">
                      {fillerBudgetPercent}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Packaging (moved from Theme) */}
              <div className="border-t border-border pt-3 space-y-2">
                <Label className="text-xs font-bold text-foreground">Packaging Type</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {PACKAGING_OPTIONS.map((p) => (
                    <Button
                      key={p.value}
                      variant={data.packagingType === p.value ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        update("packagingType", p.value);
                        update("packagingCost", PACKAGING_COST_MAP[p.value]);
                      }}
                    >
                      {p.label} (~{fmt(p.cost)})
                    </Button>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Packaging Cost (Approx)</Label>
                  <Input
                    type="number"
                    value={data.packagingCost}
                    onChange={(e) => update("packagingCost", Math.max(0, Number(e.target.value) || 0))}
                    className="h-8 text-sm w-[120px]"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Intent Preset */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground">What is the client's main priority?</h2>
            <p className="text-xs text-muted-foreground">Pick the intent that best matches this order.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTENT_PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = data.priorityMode === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => update("priorityMode", preset.value)}
                    className={cn(
                      "relative flex items-start gap-3 rounded-lg border-2 p-3.5 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/50"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className={cn("text-sm font-semibold", isSelected && "text-primary")}>{preset.label}</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">{preset.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <Button variant="outline" size="sm" onClick={prev} disabled={step === 0} className="gap-1 text-xs">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={next} className="gap-1 text-xs">
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" onClick={handleGenerate} className="gap-1 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> Generate Suggestions
          </Button>
        )}
      </div>
    </div>
  );
};

export default HamperWizard;
