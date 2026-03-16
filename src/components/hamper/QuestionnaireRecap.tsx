import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import type { QuestionnaireData } from "./types";
import { HERO_OPTIONS, PACKAGING_OPTIONS } from "./types";

interface QuestionnaireRecapProps {
  data: QuestionnaireData;
  onEdit: () => void;
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const QuestionnaireRecap = ({ data, onEdit }: QuestionnaireRecapProps) => {
  const heroLabel = HERO_OPTIONS.find((o) => o.value === data.heroPreference)?.label ?? data.heroPreference;
  const packLabel = PACKAGING_OPTIONS.find((o) => o.value === data.packagingType)?.label ?? data.packagingType;
  const fillerPct = Math.max(0, 100 - data.heroBudgetPercent - data.supportingBudgetPercent);

  return (
    <Card>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Brief</p>
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>

        <div className="space-y-2 text-xs">
          <Row label="Client" value={`${data.clientName}${data.company ? ` · ${data.company}` : ""}`} />
          <Row label="Delivery" value={data.deliveryDate ? format(data.deliveryDate, "dd MMM yyyy") : "—"} />
          <Row label="Budget" value={`${fmt(data.budget)} ${data.budgetMode === "total" ? "(total)" : "(each)"}`} />
          <Row label="Qty" value={String(data.quantity)} />
          <Row label="Category" value={heroLabel} />
          <Row label="Packaging" value={`${packLabel} (${fmt(data.packagingCost)})`} />
          <Row label="Structure" value={`${data.heroCount}H / ${data.supportingCount}S / ${data.fillerCount}F`} />
          <Row label="Budget %" value={`${data.heroBudgetPercent}H / ${data.supportingBudgetPercent}S / ${fillerPct}F`} />

          {data.mustHaveItems.length > 0 && (
            <div>
              <span className="text-muted-foreground text-[10px]">Must-have</span>
              <div className="flex gap-1 flex-wrap mt-0.5">
                {data.mustHaveItems.map((i) => (
                  <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">{i}</Badge>
                ))}
              </div>
            </div>
          )}

          {data.forbiddenCategories.length > 0 && (
            <div>
              <span className="text-muted-foreground text-[10px]">Forbidden</span>
              <div className="flex gap-1 flex-wrap mt-0.5">
                {data.forbiddenCategories.map((c) => (
                  <Badge key={c} variant="destructive" className="text-[9px] px-1 py-0">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {data.dietaryNotes && <Row label="Diet" value={data.dietaryNotes} />}

          <Row label="Intent" value={
            data.priorityMode === "balanced" ? "Balanced" :
            data.priorityMode === "budget" ? "Budget Safe" :
            data.priorityMode === "fast" ? "Fast Delivery" : "Premium Client"
          } />
        </div>
      </CardContent>
    </Card>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-right font-medium truncate">{value}</span>
    </div>
  );
}

export default QuestionnaireRecap;
