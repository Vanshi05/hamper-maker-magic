import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Minus, Plus, RefreshCw, FileText, Save, Send, RotateCcw,
  Shield, AlertTriangle, XCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { GeneratedHamper, Feasibility } from "./types";
import React from "react";

interface HamperPreviewProps {
  hamper: GeneratedHamper;
  qtyOverrides: Record<string, number>;
  onAdjustQty: (itemName: string, delta: number) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
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

const ROLE_BG: Record<string, string> = {
  hero: "bg-primary/5 border border-primary/10 rounded-lg p-2",
  supporting: "",
  filler: "",
  packaging: "",
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

const HamperPreview = ({ hamper, qtyOverrides, onAdjustQty, onRegenerate, isRegenerating }: HamperPreviewProps) => {
  const pricing = React.useMemo(() => {
    let taxable = 0;
    hamper.items.forEach((i) => {
      taxable += i.unitPrice * (qtyOverrides[i.name] ?? i.qty);
    });
    const tax = Math.round(taxable * (hamper.gstPercent / 100));
    return { taxable, tax, grand: taxable + tax };
  }, [hamper, qtyOverrides]);

  const fMeta = feasibilityMeta[hamper.feasibility];
  const inv = inventoryBadge(hamper.inventory.status);

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
    <div className="flex flex-col gap-3 lg:sticky lg:top-[60px] lg:max-h-[calc(100vh-72px)] lg:overflow-y-auto">
      {/* Header card with image */}
      <Card className="overflow-hidden">
        <img src={hamper.image} alt={hamper.name} className="w-full h-44 object-cover" />
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="font-bold text-base">{hamper.name}</p>
            <div className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", fMeta.color, fMeta.bg)}>
              {fMeta.label}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] gap-1", inv.cls)}>
              {inv.icon} Stock: {inv.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {hamper.inventory.stockAvailable} avail · {hamper.inventory.requiredQuantity} needed
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Items grouped by role */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Product Breakdown</p>
          {ROLE_ORDER.map((role) => {
            const items = groupedItems[role];
            if (!items || items.length === 0) return null;
            return (
              <div key={role} className={cn(ROLE_BG[role])}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{ROLE_LABELS[role]}</p>
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const qty = qtyOverrides[item.name] ?? item.qty;
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs gap-1.5">
                        <span className={cn("flex-1 truncate", role === "hero" ? "font-semibold" : "")}>{item.name}</span>
                        <span className="text-muted-foreground w-14 text-right tabular-nums">{fmt(item.unitPrice)}</span>
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

      {/* Pricing summary */}
      <Card className="border-primary/20">
        <CardContent className="p-3 space-y-1.5 text-xs">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price Summary</p>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{fmt(pricing.taxable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST ({hamper.gstPercent}%)</span>
            <span className="tabular-nums">{fmt(pricing.tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between pt-1">
            <span className="font-bold text-sm">Grand Total</span>
            <span className="font-bold text-xl text-primary tabular-nums">{fmt(pricing.grand)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Action bar — sticky */}
      <div className="grid grid-cols-2 gap-2 bg-background pt-1 pb-2 lg:sticky lg:bottom-0">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleAction("Preview PDF")}>
          <FileText className="h-3.5 w-3.5" /> Preview PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleAction("Draft Saved")}>
          <Save className="h-3.5 w-3.5" /> Save Draft
        </Button>
        <Button variant="secondary" size="sm" className="gap-1.5 text-xs h-9" onClick={() => handleAction("Quote Sent")}>
          <Send className="h-3.5 w-3.5" /> Send Quote
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs h-9" onClick={onRegenerate} disabled={isRegenerating}>
                <RotateCcw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} /> {isRegenerating ? "Generating…" : "Regenerate"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">Generates new hamper combinations using different products while keeping the same constraints.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default HamperPreview;
