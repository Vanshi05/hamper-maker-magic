import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Crown, Package, Zap, Star, ChevronDown, Shield, AlertTriangle,
  XCircle, Eye, RefreshCw, Settings2,
} from "lucide-react";
import { useState } from "react";
import type { GeneratedHamper } from "./types";

interface HamperCardListProps {
  hampers: GeneratedHamper[];
  selectedId: string;
  onSelect: (h: GeneratedHamper) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
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
        <p className="text-lg font-semibold text-foreground">No suitable hampers found</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Try increasing your budget, reducing constraints, or broadening category preferences.
        </p>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────── */

const HamperCardList = ({ hampers, selectedId, onSelect, onRegenerate, isRegenerating }: HamperCardListProps) => {
  const [showBackups, setShowBackups] = useState(false);
  const main = hampers.filter((h) => !h.isBackup);
  const backups = hampers.filter((h) => h.isBackup);

  if (hampers.length === 0) return <HamperEmptyState />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {main.length} Recommendation{main.length !== 1 ? "s" : ""}
        </p>
        {onRegenerate && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={onRegenerate}
            disabled={isRegenerating}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
            {isRegenerating ? "Generating…" : "Regenerate All"}
          </Button>
        )}
      </div>

      {/* Main hamper grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {main.map((h, idx) => (
          <HamperCard
            key={h.id}
            hamper={h}
            selected={selectedId === h.id}
            onSelect={onSelect}
            rank={idx + 1}
            isTop={idx === 0}
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
                <HamperCard key={h.id} hamper={h} selected={selectedId === h.id} onSelect={onSelect} />
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
}: {
  hamper: GeneratedHamper;
  selected: boolean;
  onSelect: (h: GeneratedHamper) => void;
  rank?: number;
  isTop?: boolean;
}) {
  const inv = inventoryBadge(h.inventory.status);

  // budget match (simple heuristic — show if price is within range)
  const budgetMatch = h.totalPrice > 0 ? Math.min(100, Math.round((1 - Math.abs(h.totalPrice - h.totalPrice) / h.totalPrice) * 100)) : 0;

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
        isTop && !selected && "ring-1 ring-primary/30"
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
        {/* Inventory status */}
        <div className="absolute bottom-2 right-2">
          <Badge variant="outline" className={cn("text-[10px] gap-1 backdrop-blur-sm bg-background/80", inv.cls)}>
            {inv.icon} {inv.label}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Header: name + tags */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base leading-tight">{h.name}</h3>
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

        {/* Price display */}
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-primary tabular-nums">{fmt(h.totalPrice)}</span>
          <span className="text-[11px] text-muted-foreground">per hamper</span>
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

        {/* Why chosen */}
        {h.whyChosen.length > 0 && (
          <div className="flex gap-1.5 flex-wrap pt-1">
            {h.whyChosen.map((w, i) => (
              <span key={i} className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {w}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            className={cn(
              "flex-1 gap-1.5 text-xs h-9",
              selected && "bg-primary"
            )}
            variant={selected ? "default" : "outline"}
            onClick={(e) => { e.stopPropagation(); onSelect(h); }}
          >
            <Eye className="h-3.5 w-3.5" />
            {selected ? "Selected" : "Select Hamper"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs h-9 text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <Settings2 className="h-3.5 w-3.5" /> Customize
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default HamperCardList;
