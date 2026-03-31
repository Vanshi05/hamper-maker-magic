import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Crown, Package, Zap, Star, ChevronDown, Shield, AlertTriangle,
  XCircle, Eye, RefreshCw, Settings2, Lightbulb, TrendingUp,
  TrendingDown, PlusCircle, Gauge,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { GeneratedHamper, QuestionnaireData } from "./types";
import {
  budgetUtilization,
  hamperTypeLabel,
  confidenceScore,
  whyThisHamper,
  smartWarnings,
} from "./hamperIntelligence";

interface HamperCardListProps {
  hampers: GeneratedHamper[];
  selectedId: string;
  onSelect: (h: GeneratedHamper) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  questionnaire?: QuestionnaireData | null;
  compareIds?: string[];
  onToggleCompare?: (id: string) => void;
}

/* ── helpers ─────────────────────────────────── */

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const badgeStyle = (label: string) => {
  switch (label) {
    case "LOW STOCK":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "FAST DELIVERY":
      return "bg-[hsl(var(--eco-green)/0.12)] text-[hsl(var(--eco-green))] border-[hsl(var(--eco-green)/0.25)]";
    case "PREMIUM":
      return "bg-primary/10 text-primary border-primary/20";
    default:
      return "";
  }
};

const badgeIcon = (label: string) => {
  switch (label) {
    case "LOW STOCK":
      return <Package className="h-3 w-3" />;
    case "FAST DELIVERY":
      return <Zap className="h-3 w-3" />;
    case "PREMIUM":
      return <Star className="h-3 w-3" />;
    default:
      return null;
  }
};

const inventoryBadge = (status: string) => {
  switch (status) {
    case "Safe":
      return { icon: <Shield className="h-3 w-3" />, cls: "bg-[hsl(var(--eco-green)/0.12)] text-[hsl(var(--eco-green))] border-[hsl(var(--eco-green)/0.25)]", label: "Safe" };
    case "Low":
      return { icon: <AlertTriangle className="h-3 w-3" />, cls: "bg-accent/15 text-accent-foreground border-accent/30", label: "Limited" };
    default:
      return { icon: <XCircle className="h-3 w-3" />, cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Risk" };
  }
};

const ROLE_LABELS: Record<string, { label: string; cls: string }> = {
  hero: { label: "Hero", cls: "text-primary font-semibold text-sm" },
  supporting: { label: "Supporting", cls: "text-foreground font-medium text-xs" },
  filler: { label: "Filler", cls: "text-muted-foreground text-xs" },
  packaging: { label: "Packaging", cls: "text-muted-foreground text-xs italic" },
};
const ROLE_ORDER = ["hero", "supporting", "filler", "packaging"] as const;

const scoreColor = (s: number) => {
  if (s >= 80) return "text-[hsl(var(--eco-green))]";
  if (s >= 60) return "text-accent-foreground";
  return "text-destructive";
};

const budgetBarColor = (pct: number) => {
  if (pct >= 85 && pct <= 100) return "bg-[hsl(var(--eco-green))]";
  if (pct >= 70) return "bg-primary";
  if (pct > 100) return "bg-destructive";
  return "bg-accent";
};

/* ── Loading skeletons ───────────────────────── */

export function HamperCardSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-40 w-full rounded-none" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-4/6" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Empty state ─────────────────────────────── */

export function HamperEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <Package className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-lg font-semibold text-foreground">Couldn't find a perfect match</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Try increasing your budget, removing strict constraints, or reducing quantity.
        </p>
      </div>
    </div>
  );
}

/* ── Comparison table ────────────────────────── */

function ComparisonTable({ hampers, q }: { hampers: GeneratedHamper[]; q: QuestionnaireData }) {
  if (hampers.length !== 2) return null;
  const [a, b] = hampers;
  const buA = budgetUtilization(a, q);
  const buB = budgetUtilization(b, q);
  const scoreA = confidenceScore(a, q);
  const scoreB = confidenceScore(b, q);

  const rows = [
    { label: "Price", a: fmt(a.totalPrice), b: fmt(b.totalPrice) },
    { label: "Items", a: String(a.items.length), b: String(b.items.length) },
    { label: "Hero", a: a.heroProduct, b: b.heroProduct },
    { label: "Budget Used", a: `${buA.pct}%`, b: `${buB.pct}%` },
    { label: "Inventory", a: a.inventory.status, b: b.inventory.status },
    { label: "Score", a: `${scoreA}/100`, b: `${scoreB}/100` },
  ];

  return (
    <Card className="border-primary/20">
      <CardContent className="p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Comparison</p>
        <div className="grid grid-cols-3 gap-1 text-xs">
          <span className="text-muted-foreground font-medium">Feature</span>
          <span className="font-semibold truncate text-center">{a.name}</span>
          <span className="font-semibold truncate text-center">{b.name}</span>
          {rows.map((r) => (
            <>
              <span key={`l-${r.label}`} className="text-muted-foreground">{r.label}</span>
              <span key={`a-${r.label}`} className="text-center tabular-nums">{r.a}</span>
              <span key={`b-${r.label}`} className="text-center tabular-nums">{r.b}</span>
            </>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main component ──────────────────────────── */

const HamperCardList = ({
  hampers, selectedId, onSelect, onRegenerate, isRegenerating,
  questionnaire, compareIds = [], onToggleCompare,
}: HamperCardListProps) => {
  const [showBackups, setShowBackups] = useState(false);
  const main = hampers.filter((h) => !h.isBackup);
  const backups = hampers.filter((h) => h.isBackup);

  const compareHampers = useMemo(
    () => hampers.filter((h) => compareIds.includes(h.id)),
    [hampers, compareIds]
  );

  if (hampers.length === 0) return <HamperEmptyState />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {main.length} Recommendation{main.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          {compareIds.length === 2 && (
            <Badge variant="outline" className="text-[10px] gap-1">
              Comparing {compareIds.length}
            </Badge>
          )}
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
              {isRegenerating ? "Trying better combinations…" : "Find better options"}
            </Button>
          )}
        </div>
      </div>

      {/* Comparison table */}
      {compareIds.length === 2 && questionnaire && (
        <ComparisonTable hampers={compareHampers} q={questionnaire} />
      )}

      {/* Main hamper grid */}
      <div className={cn(
        "grid grid-cols-1 md:grid-cols-2 gap-5 transition-opacity duration-300",
        isRegenerating && "opacity-50 pointer-events-none"
      )}>
        {main.map((h, idx) => (
          <HamperCard
            key={h.id}
            hamper={h}
            selected={selectedId === h.id}
            onSelect={onSelect}
            rank={idx + 1}
            isTop={idx === 0}
            questionnaire={questionnaire}
            isComparing={compareIds.includes(h.id)}
            onToggleCompare={onToggleCompare}
          />
        ))}
      </div>

      {/* Backup section */}
      {backups.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowBackups(!showBackups)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-full py-2 hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBackups && "rotate-180")} />
            {backups.length} Backup Option{backups.length !== 1 ? "s" : ""}
          </button>
          {showBackups && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {backups.map((h) => (
                <HamperCard
                  key={h.id}
                  hamper={h}
                  selected={selectedId === h.id}
                  onSelect={onSelect}
                  questionnaire={questionnaire}
                  isComparing={compareIds.includes(h.id)}
                  onToggleCompare={onToggleCompare}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Individual hamper card ───────────────────── */

function HamperCard({
  hamper: h,
  selected,
  onSelect,
  rank,
  isTop,
  questionnaire,
  isComparing,
  onToggleCompare,
}: {
  hamper: GeneratedHamper;
  selected: boolean;
  onSelect: (h: GeneratedHamper) => void;
  rank?: number;
  isTop?: boolean;
  questionnaire?: QuestionnaireData | null;
  isComparing?: boolean;
  onToggleCompare?: (id: string) => void;
}) {
  const inv = inventoryBadge(h.inventory.status);

  const q = questionnaire;
  const bu = q ? budgetUtilization(h, q) : null;
  const typeLabel = q ? hamperTypeLabel(h, q) : null;
  const score = q ? confidenceScore(h, q) : null;
  const reasons = q ? whyThisHamper(h, q) : h.whyChosen;
  const warnings = q ? smartWarnings(h, q) : [];

  // group items by role
  const grouped: Record<string, typeof h.items> = {};
  for (const item of h.items) {
    if (!grouped[item.role]) grouped[item.role] = [];
    grouped[item.role].push(item);
  }

  return (
    <Card
      onClick={() => onSelect(h)}
      className={cn(
        "cursor-pointer transition-all duration-200 overflow-hidden group",
        "hover:shadow-md hover:-translate-y-0.5",
        selected
          ? "ring-2 ring-primary shadow-md bg-primary/[0.02]"
          : "hover:ring-1 hover:ring-border",
        isTop && !selected && "ring-1 ring-primary/30",
        isComparing && "ring-2 ring-accent"
      )}
    >
      {/* Image section */}
      <div className="relative">
        <img
          src={h.image}
          alt={h.name}
          className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {/* Rank badge */}
        {rank && (
          <div className={cn(
            "absolute top-2 left-2 h-7 w-7 rounded-full flex items-center justify-center shadow-sm",
            isTop ? "bg-primary" : "bg-muted-foreground/80"
          )}>
            <span className="text-xs font-bold text-primary-foreground">{rank}</span>
          </div>
        )}
        {/* Top match ribbon */}
        {isTop && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-primary text-primary-foreground text-[10px] gap-1 shadow-sm">
              <Crown className="h-3 w-3" /> Top Match
            </Badge>
          </div>
        )}
        {/* Confidence score pill */}
        {score !== null && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="outline" className={cn("text-[10px] gap-1 backdrop-blur-sm bg-background/80 font-bold", scoreColor(score))}>
              <Gauge className="h-3 w-3" /> {score}/100
            </Badge>
          </div>
        )}
        {/* Inventory status */}
        <div className="absolute bottom-2 right-2">
          <Badge variant="outline" className={cn("text-[10px] gap-1 backdrop-blur-sm bg-background/80", inv.cls)}>
            {inv.icon} {inv.label}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Header: name + type label + tags */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base leading-tight">{h.name}</h3>
              {typeLabel && (
                <span className="text-[10px] font-medium text-muted-foreground">{typeLabel}</span>
              )}
            </div>
          </div>
          {h.badges.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {h.badges.map((b) => (
                <Badge key={b} variant="outline" className={cn("text-[10px] px-1.5 py-0 gap-1 h-5", badgeStyle(b))}>
                  {badgeIcon(b)} {b}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Price + Budget utilization bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-primary tabular-nums">{fmt(h.totalPrice)}</span>
            {bu && bu.total > 0 && (
              <span className="text-[11px] text-muted-foreground">/ {fmt(bu.total)}</span>
            )}
          </div>
          {bu && bu.total > 0 && (
            <div className="space-y-0.5">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", budgetBarColor(bu.pct))}
                  style={{ width: `${Math.min(bu.pct, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground tabular-nums">{bu.pct}% budget used</p>
            </div>
          )}
        </div>

        {/* Product breakdown by role */}
        <div className="space-y-2 border-t border-border pt-3">
          {ROLE_ORDER.map((role) => {
            const items = grouped[role];
            if (!items || items.length === 0) return null;
            const meta = ROLE_LABELS[role];
            return (
              <div key={role}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  {meta.label}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <div key={item.name} className={cn("flex items-center justify-between", meta.cls)}>
                      <span className="truncate flex-1">{item.name}</span>
                      <span className="text-muted-foreground ml-2 tabular-nums text-xs">
                        {fmt(item.unitPrice)} ×{item.qty}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Why this hamper */}
        {reasons.length > 0 && (
          <div className="border-t border-border pt-3 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Why this hamper works
            </p>
            <ul className="space-y-0.5">
              {reasons.map((r, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Smart warnings */}
        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-accent-foreground bg-accent/10 rounded px-2 py-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            className={cn("flex-1 gap-1.5 text-xs h-9", selected && "bg-primary")}
            variant={selected ? "default" : "outline"}
            onClick={(e) => { e.stopPropagation(); onSelect(h); }}
          >
            <Eye className="h-3.5 w-3.5" />
            {selected ? "Selected" : "Select Hamper"}
          </Button>
          {onToggleCompare && (
            <Button
              size="sm"
              variant={isComparing ? "secondary" : "ghost"}
              className="gap-1 text-xs h-9 text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onToggleCompare(h.id); }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {isComparing ? "Comparing" : "Compare"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default HamperCardList;
