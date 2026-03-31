import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
          {data.clientName && <Row label="Client" value={data.clientName} />}
          <Row label="Budget" value={`${fmt(data.budget)} ${data.budgetMode === "total" ? "(total)" : "(each)"}`} />
          <Row label="Qty" value={String(data.quantity)} />
          <Row label="Category" value={heroLabel} />
          <Row label="Packaging" value={packLabel} />
          {data.dietaryNotes && <Row label="Diet" value={data.dietaryNotes} />}
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
