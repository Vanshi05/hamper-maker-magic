import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Crown, Package, ChevronDown, Shield, AlertTriangle,
  XCircle, Gauge, Scale,
} from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import type { GeneratedHamper, QuestionnaireData } from "./types";
import {
  budgetUtilization,
  hamperTypeLabel,
  confidenceScore,
} from "./hamperIntelligence";

interface HamperCardListProps {
  hampers: GeneratedHamper[];
  selectedId: string;
  onSelect: (h: GeneratedHamper) => void;
  questionnaire?: QuestionnaireData | null;
  compareIds?: string[];
  onToggleCompare?: (id: string) => void;
  isRegenerating?: boolean;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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

const invMeta = (status: string) => {
  if (status === "Safe") return { cls: "text-[hsl(var(--eco-green))]", label: "Safe stock" };
  if (status === "Low") return { cls: "text-accent-foreground", label: "Limited stock" };
  return { cls: "text-destructive", label: "Stock risk" };
};

/* ── Skeletons ───────────────────────────────── */
export function HamperCardSkeletons() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="h-36 w-full rounded-none" />
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
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
        <p className="text-lg font-semibold text-foreground">No matching hampers found</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Try relaxing your constraints or increasing your budget.
        </p>
      </div>
    </div>
  );
}

/* ── Comparison Modal ────────────────────────── */
export function ComparisonPanel({
  hampers,
  q,
  onClear,
}: {
  hampers: GeneratedHamper[];
  q: QuestionnaireData;
  onClear: () => void;
}) {
  if (hampers.length !== 2) return null;
  const [a, b] = hampers;
  const buA = budgetUtilization(a, q);
  const buB = budgetUtilization(b, q);
  const scoreA = confidenceScore(a, q);
  const scoreB = confidenceScore(b, q);

  const rows = [
    { label: "Price", a: fmt(a.totalPrice), b: fmt(b.totalPrice) },
    { label: "Hero Item", a: a.heroProduct, b: b.heroProduct },
    { label: "Total Items", a: String(a.items.length), b: String(b.items.length) },
    { label: "Budget Used", a: `${buA.pct}%`, b: `${buB.pct}%` },
    { label: "Inventory", a: a.inventory.status, b: b.inventory.status },
    { label: "Score", a: `${scoreA}/100`, b: `${scoreB}/100` },
  ];

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" /> Comparing 2 Hampers
          </p>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={onClear}>
            Clear
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
          <span className="text-muted-foreground font-medium">Feature</span>
          <span className="font-semibold truncate text-center">{a.name}</span>
          <span className="font-semibold truncate text-center">{b.name}</span>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <span className="text-muted-foreground">{r.label}</span>
              <span className="text-center tabular-nums">{r.a}</span>
              <span className="text-center tabular-nums">{r.b}</span>
            </Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main list ───────────────────────────────── */
const HamperCardList = ({
  hampers, selectedId, onSelect,
  questionnaire, compareIds = [], onToggleCompare, isRegenerating,
}: HamperCardListProps) => {
  const [showBackups, setShowBackups] = useState(false);
  const main = hampers.filter((h) => !h.isBackup);
  const backups = hampers.filter((h) => h.isBackup);

  if (hampers.length === 0) return <HamperEmptyState />;

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {main.length} Recommendation{main.length !== 1 ? "s" : ""}
      </p>

      <div className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-opacity duration-300",
        isRegenerating && "opacity-40 pointer-events-none"
      )}>
        {main.map((h, idx) => (
          <MinimalHamperCard
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

      {backups.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowBackups(!showBackups)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-full py-2 hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showBackups && "rotate-180")} />
            {backups.length} Backup Option{backups.length !== 1 ? "s" : ""}
          </button>
          {showBackups && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {backups.map((h) => (
                <MinimalHamperCard
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

/* ── Minimal card ────────────────────────────── */
function MinimalHamperCard({
  hamper: h,
  selected,
  onSelect,
  rank,
  isTop,
  questionnaire: q,
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
  const bu = q ? budgetUtilization(h, q) : null;
  const typeLabel = q ? hamperTypeLabel(h, q) : "Hamper";
  const score = q ? confidenceScore(h, q) : null;
  const inv = invMeta(h.inventory.status);

  // Pick 2 highlights
  const highlights: string[] = [];
  const heroItems = h.items.filter((i) => i.role === "hero");
  if (heroItems.length > 0) highlights.push(`Hero: ${heroItems[0].name}`);
  highlights.push(inv.label);

  return (
    <Card
      onClick={() => onSelect(h)}
      className={cn(
        "cursor-pointer transition-all duration-200 overflow-hidden group",
        "hover:shadow-md hover:-translate-y-0.5",
        selected
          ? "ring-2 ring-primary shadow-lg"
          : "hover:ring-1 hover:ring-border",
        isComparing && !selected && "ring-2 ring-accent"
      )}
    >
      {/* Image */}
      <div className="relative">
        <img
          src={h.image}
          alt={h.name}
          className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        {rank && (
          <div className={cn(
            "absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center shadow-sm text-[10px] font-bold text-primary-foreground",
            isTop ? "bg-primary" : "bg-muted-foreground/80"
          )}>
            {rank}
          </div>
        )}
        {isTop && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-primary text-primary-foreground text-[9px] gap-0.5 shadow-sm px-1.5 py-0">
              <Crown className="h-2.5 w-2.5" /> Top
            </Badge>
          </div>
        )}
        {score !== null && (
          <div className="absolute bottom-2 left-2">
            <Badge variant="outline" className={cn("text-[9px] gap-0.5 backdrop-blur-sm bg-background/80 font-bold px-1.5 py-0", scoreColor(score))}>
              <Gauge className="h-2.5 w-2.5" /> {score}
            </Badge>
          </div>
        )}
      </div>

      {/* Content — minimal */}
      <CardContent className="p-4 space-y-2.5">
        {/* Name + type */}
        <div>
          <h3 className="font-bold text-sm leading-tight truncate">{h.name}</h3>
          <span className="text-[10px] font-medium text-muted-foreground">{typeLabel}</span>
        </div>

        {/* Price + budget bar */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-primary tabular-nums">{fmt(h.totalPrice)}</span>
            {bu && bu.total > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">/ {fmt(bu.total)}</span>
            )}
          </div>
          {bu && bu.total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", budgetBarColor(bu.pct))}
                  style={{ width: `${Math.min(bu.pct, 100)}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground tabular-nums w-8">{bu.pct}%</span>
            </div>
          )}
        </div>

        {/* 2 key highlights */}
        <div className="space-y-0.5">
          {highlights.slice(0, 2).map((hl, i) => (
            <p key={i} className="text-[11px] text-muted-foreground truncate">
              <span className="text-primary mr-1">•</span>{hl}
            </p>
          ))}
        </div>

        {/* Compare button */}
        {onToggleCompare && (
          <div className="pt-1">
            <Button
              size="sm"
              variant={isComparing ? "secondary" : "ghost"}
              className="w-full gap-1.5 text-[11px] h-7"
              onClick={(e) => { e.stopPropagation(); onToggleCompare(h.id); }}
            >
              <Scale className="h-3 w-3" />
              {isComparing ? "Comparing" : "Compare"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HamperCardList;
