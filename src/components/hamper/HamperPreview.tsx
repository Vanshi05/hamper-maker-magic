import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Minus, Plus, RefreshCw, FileText, Save, Send,
  Shield, AlertTriangle, XCircle, Lightbulb,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { GeneratedHamper, Feasibility, QuestionnaireData } from "./types";
import {
  budgetUtilization,
  whyThisHamper,
  smartWarnings,
  confidenceScore,
  hamperTypeLabel,
} from "./hamperIntelligence";
import React, { useState } from "react";
import HamperPdfDialog from "./HamperPdfDialog";

interface HamperPreviewProps {
  hamper: GeneratedHamper;
  qtyOverrides: Record<string, number>;
  onAdjustQty: (itemName: string, delta: number) => void;
  questionnaire?: QuestionnaireData | null;
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
  hero: "bg-primary/5 border border-primary/10 rounded-lg p-2.5",
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

const budgetBarColor = (pct: number) => {
  if (pct >= 85 && pct <= 100) return "bg-[hsl(var(--eco-green))]";
  if (pct >= 70) return "bg-primary";
  if (pct > 100) return "bg-destructive";
  return "bg-accent";
};

const HamperPreview = ({ hamper, qtyOverrides, onAdjustQty, questionnaire }: HamperPreviewProps) => {
  const [pdfOpen, setPdfOpen] = useState(false);
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
  const q = questionnaire;
  const bu = q ? budgetUtilization(hamper, q) : null;
  const reasons = q ? whyThisHamper(hamper, q) : hamper.whyChosen;
  const warns = q ? smartWarnings(hamper, q) : [];
  const score = q ? confidenceScore(hamper, q) : null;
  const typeLabel = q ? hamperTypeLabel(hamper, q) : null;

  const handleAction = (action: string) => {
    toast({ title: action, description: `${hamper.name} — ${fmt(pricing.grand)}` });
  };

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
      {/* Image + header */}
      <Card className="overflow-hidden">
        <img src={hamper.image} alt={hamper.name} className="w-full h-48 object-cover" />
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-base">{hamper.name}</p>
              {typeLabel && <span className="text-[10px] font-medium text-muted-foreground">{typeLabel}</span>}
            </div>
            <div className={cn("flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0", fMeta.color, fMeta.bg)}>
              {fMeta.label}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] gap-1", inv.cls)}>
              {inv.icon} {inv.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {hamper.inventory.stockAvailable} avail · {hamper.inventory.requiredQuantity} needed
            </span>
            {score !== null && (
              <Badge variant="outline" className="text-[10px] gap-1 font-bold">
                Score: {score}/100
              </Badge>
            )}
          </div>
          {/* Budget bar */}
          {bu && bu.total > 0 && (
            <div className="space-y-0.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                <span>{fmt(bu.used)} / {fmt(bu.total)}</span>
                <span>{bu.pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", budgetBarColor(bu.pct))}
                  style={{ width: `${Math.min(bu.pct, 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product breakdown */}
      <Card>
        <CardContent className="p-4 space-y-3">
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

      {/* Why this hamper + warnings */}
      {(reasons.length > 0 || warns.length > 0) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {reasons.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Why this hamper works
                </p>
                <ul className="space-y-1">
                  {reasons.map((r, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {warns.length > 0 && (
              <div className="space-y-1">
                {warns.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-accent-foreground bg-accent/10 rounded px-2.5 py-1.5">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing */}
      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-1.5 text-xs">
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

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2 bg-background pt-1 pb-2 lg:sticky lg:bottom-0">
        <Button variant="outline" size="sm" className="gap-1 text-[11px] h-9" onClick={() => setPdfOpen(true)}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-1 text-[11px] h-9" onClick={() => handleAction("Draft Saved")}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
        <Button variant="secondary" size="sm" className="gap-1 text-[11px] h-9" onClick={() => handleAction("Quote Sent")}>
          <Send className="h-3.5 w-3.5" /> Quote
        </Button>
      </div>

      {questionnaire && (
        <HamperPdfDialog
          open={pdfOpen}
          onOpenChange={setPdfOpen}
          hamper={hamper}
          qtyOverrides={qtyOverrides}
          questionnaire={questionnaire}
        />
      )}
    </div>
  );
};

export default HamperPreview;
