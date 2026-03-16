import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Crown, Package, Zap, Star, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { GeneratedHamper } from "./types";

interface HamperCardListProps {
  hampers: GeneratedHamper[];
  selectedId: string;
  onSelect: (h: GeneratedHamper) => void;
}

const badgeStyle = (label: string) => {
  switch (label) {
    case "LOW STOCK":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "FAST DELIVERY":
      return "bg-[hsl(var(--eco-green)/0.12)] text-[hsl(var(--eco-green))] border-[hsl(var(--eco-green)/0.25)]";
    case "PREMIUM":
      return "bg-accent/15 text-accent-foreground border-accent/30";
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

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const feasibilityColor: Record<string, string> = {
  green: "bg-[hsl(var(--eco-green))]",
  yellow: "bg-accent",
  red: "bg-destructive",
};

const inventoryStatusColor: Record<string, string> = {
  Safe: "text-[hsl(var(--eco-green))]",
  Low: "text-accent",
  "Out of Stock": "text-destructive",
};

const HamperCardList = ({ hampers, selectedId, onSelect }: HamperCardListProps) => {
  const [showBackups, setShowBackups] = useState(false);
  const main = hampers.filter((h) => !h.isBackup);
  const backups = hampers.filter((h) => h.isBackup);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {main.length} Suggestions
      </p>

      {main.map((h, idx) => (
        <HamperCardItem key={h.id} hamper={h} selected={selectedId === h.id} onSelect={onSelect} rank={idx + 1} />
      ))}

      {backups.length > 0 && (
        <>
          <button
            onClick={() => setShowBackups(!showBackups)}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full py-1.5 hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", showBackups && "rotate-180")} />
            {backups.length} Backup Options
          </button>
          {showBackups &&
            backups.map((h) => (
              <HamperCardItem key={h.id} hamper={h} selected={selectedId === h.id} onSelect={onSelect} />
            ))}
        </>
      )}
    </div>
  );
};

function HamperCardItem({
  hamper: h,
  selected,
  onSelect,
  rank,
}: {
  hamper: GeneratedHamper;
  selected: boolean;
  onSelect: (h: GeneratedHamper) => void;
  rank?: number;
}) {
  return (
    <Card
      onClick={() => onSelect(h)}
      className={cn(
        "cursor-pointer transition-all duration-150 overflow-hidden",
        "hover:bg-muted/40",
        selected ? "ring-2 ring-primary bg-primary/[0.03] shadow-sm" : "hover:shadow-sm"
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img src={h.image} alt={h.name} className="w-20 h-16 object-cover rounded-l-md" />
            {rank && (
              <div className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full flex items-center justify-center", feasibilityColor[h.feasibility])}>
                <span className="text-[8px] font-bold text-primary-foreground">{rank}</span>
              </div>
            )}
          </div>
          <div className="flex-1 py-2 pr-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="font-semibold text-sm truncate">{h.heroProduct}</p>
              {rank === 1 && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] px-1 py-0 gap-0.5 flex-shrink-0">
                  <Crown className="h-2.5 w-2.5" /> TOP
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{h.sideItems.join(" · ")}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold text-sm text-primary">{fmt(h.totalPrice)}</span>
              <div className="flex gap-1 flex-wrap">
                {h.badges.map((b) => (
                  <Badge key={b} variant="outline" className={cn("text-[9px] px-1 py-0 gap-0.5 h-4", badgeStyle(b))}>
                    {badgeIcon(b)} {b}
                  </Badge>
                ))}
              </div>
            </div>
            {/* Inventory indicator */}
            <div className="flex items-center gap-2 mt-0.5 text-[9px]">
              <span className="text-muted-foreground">Stock: {h.inventory.stockAvailable}</span>
              <span className="text-muted-foreground">Need: {h.inventory.requiredQuantity}</span>
              <span className={cn("font-medium", inventoryStatusColor[h.inventory.status])}>{h.inventory.status}</span>
            </div>
            {/* Why chosen */}
            {h.whyChosen.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {h.whyChosen.map((w, i) => (
                  <span key={i} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default HamperCardList;
