import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Minus, Plus, RefreshCw, FileText, Save, Send, RotateCcw,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { GeneratedHamper, Feasibility } from "./types";
import React from "react";

interface HamperPreviewProps {
  hamper: GeneratedHamper;
  qtyOverrides: Record<string, number>;
  onAdjustQty: (itemName: string, delta: number) => void;
}

const feasibilityMeta: Record<Feasibility, { label: string; color: string; bg: string }> = {
  green: { label: "Deliverable", color: "text-[hsl(var(--eco-green))]", bg: "bg-[hsl(var(--eco-green)/0.1)]" },
  yellow: { label: "Risk", color: "text-accent", bg: "bg-accent/10" },
  red: { label: "Not Possible", color: "text-destructive", bg: "bg-destructive/10" },
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const ROLE_ORDER = ["hero", "supporting", "filler", "packaging"] as const;
const ROLE_LABELS: Record<string, string> = {
  hero: "Hero",
  supporting: "Supporting",
  filler: "Fillers",
  packaging: "Packaging",
};

const inventoryStatusColor: Record<string, string> = {
  Safe: "text-[hsl(var(--eco-green))]",
  Low: "text-accent",
  "Out of Stock": "text-destructive",
};

const HamperPreview = ({ hamper, qtyOverrides, onAdjustQty }: HamperPreviewProps) => {
  const pricing = React.useMemo(() => {
    let taxable = 0;
    hamper.items.forEach((i) => {
      taxable += i.unitPrice * (qtyOverrides[i.name] ?? i.qty);
    });
    const tax = Math.round(taxable * (hamper.gstPercent / 100));
    return { taxable, tax, grand: taxable + tax };
  }, [hamper, qtyOverrides]);

  const fMeta = feasibilityMeta[hamper.feasibility];

  const handleAction = (action: string) => {
    toast({ title: action, description: `${hamper.name} — ${fmt(pricing.grand)}` });
  };

  // Group items by role
  const groupedItems = React.useMemo(() => {
    const groups: Record<string, typeof hamper.items> = {};
    for (const item of hamper.items) {
      if (!groups[item.role]) groups[item.role] = [];
      groups[item.role].push(item);
    }
    return groups;
  }, [hamper.items]);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Preview image */}
      <Card className="overflow-hidden flex-shrink-0">
        <img src={hamper.image} alt={hamper.name} className="w-full h-36 object-cover" />
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">{hamper.name}</p>
            <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", fMeta.color, fMeta.bg)}>
              {fMeta.label}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items grouped by role */}
      <Card className="flex-shrink-0">
        <CardContent className="p-2.5 space-y-2">
          {ROLE_ORDER.map((role) => {
            const items = groupedItems[role];
            if (!items || items.length === 0) return null;
            return (
              <div key={role}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{ROLE_LABELS[role]}</p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const qty = qtyOverrides[item.name] ?? item.qty;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs gap-1.5">
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className="text-muted-foreground w-14 text-right">{fmt(item.unitPrice)}</span>
                        <div className="flex items-center gap-0.5">
                          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => onAdjustQty(item.name, -1)}>
                            <Minus className="h-2.5 w-2.5" />
                          </Button>
                          <span className="w-5 text-center text-[11px] font-semibold tabular-nums">{qty}</span>
                          <Button variant="outline" size="icon" className="h-5 w-5" onClick={() => onAdjustQty(item.name, 1)}>
                            <Plus className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground">
                          <RefreshCw className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Inventory status */}
      <Card className="flex-shrink-0">
        <CardContent className="p-2.5 space-y-1 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inventory</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stock Available</span>
            <span className="tabular-nums">{hamper.inventory.stockAvailable}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Required Quantity</span>
            <span className="tabular-nums">{hamper.inventory.requiredQuantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className={cn("font-medium", inventoryStatusColor[hamper.inventory.status])}>{hamper.inventory.status}</span>
          </div>
        </CardContent>
      </Card>

      {/* Pricing summary */}
      <Card className="border-primary/20 flex-shrink-0">
        <CardContent className="p-3 space-y-1 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pricing</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxable</span>
            <span className="tabular-nums">{fmt(pricing.taxable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST ({hamper.gstPercent}%)</span>
            <span className="tabular-nums">{fmt(pricing.tax)}</span>
          </div>
          <div className="border-t border-border pt-1.5 flex justify-between">
            <span className="font-bold text-sm">Grand Total</span>
            <span className="font-bold text-lg text-primary tabular-nums transition-all duration-200">{fmt(pricing.grand)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Action bar */}
      <div className="grid grid-cols-2 gap-1.5 flex-shrink-0 lg:sticky lg:bottom-0 bg-background pt-1 pb-1">
        <Button variant="outline" size="sm" className="gap-1 text-[11px] h-8" onClick={() => handleAction("Preview PDF")}>
          <FileText className="h-3.5 w-3.5" /> Preview PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-[11px] h-8" onClick={() => handleAction("Draft Saved")}>
          <Save className="h-3.5 w-3.5" /> Save Draft
        </Button>
        <Button variant="secondary" size="sm" className="gap-1 text-[11px] h-8" onClick={() => handleAction("Quote Sent")}>
          <Send className="h-3.5 w-3.5" /> Send Quote
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="gap-1 text-[11px] h-8" onClick={() => handleAction("Regenerating...")}>
                <RotateCcw className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">Generates new hamper combinations using different supporting and filler products while keeping the same constraints.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default HamperPreview;
