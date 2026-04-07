import { useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Lightbulb } from "lucide-react";
import jsPDF from "jspdf";
import type { GeneratedHamper, QuestionnaireData } from "./types";
import { budgetUtilization, whyThisHamper, confidenceScore, hamperTypeLabel } from "./hamperIntelligence";

interface HamperPdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hamper: GeneratedHamper;
  qtyOverrides: Record<string, number>;
  questionnaire: QuestionnaireData;
}

const fmt = (n: number) => `Rs.${n.toLocaleString("en-IN")}`;

function generatePdf(
  hamper: GeneratedHamper,
  qtyOverrides: Record<string, number>,
  questionnaire: QuestionnaireData
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const margin = 18;
  const contentW = W - margin * 2;
  let y = 0;

  const colors = {
    primary: [88, 55, 100] as [number, number, number],
    primaryLight: [138, 100, 150] as [number, number, number],
    dark: [30, 30, 35] as [number, number, number],
    mid: [100, 100, 110] as [number, number, number],
    light: [160, 160, 168] as [number, number, number],
    bg: [248, 246, 250] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    green: [34, 139, 34] as [number, number, number],
    accent: [200, 160, 60] as [number, number, number],
    line: [220, 215, 225] as [number, number, number],
  };

  // ─── Header band ───
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, W, 38, "F");

  doc.setFillColor(...colors.primaryLight);
  doc.rect(0, 38, W, 2, "F");

  doc.setTextColor(...colors.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("GIFT HAMPER PROPOSAL", margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Prepared for ${questionnaire.clientName || "Client"}`, margin, 26);
  doc.text(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), margin, 32);

  if (questionnaire.company) {
    doc.text(questionnaire.company, W - margin, 26, { align: "right" });
  }

  y = 50;

  // ─── Hamper title section ───
  const typeLabel = hamperTypeLabel(hamper, questionnaire);
  const score = confidenceScore(hamper, questionnaire);

  doc.setTextColor(...colors.dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(hamper.name, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...colors.mid);
  doc.text(`${typeLabel}  ·  Score: ${score}/100  ·  ${hamper.inventory.status} stock`, margin, y);
  y += 10;

  // ─── Order summary card ───
  doc.setFillColor(...colors.bg);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, "F");

  doc.setDrawColor(...colors.line);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, "S");

  doc.setFontSize(7);
  doc.setTextColor(...colors.light);
  doc.setFont("helvetica", "bold");
  doc.text("ORDER SUMMARY", margin + 5, y + 6);

  doc.setFontSize(8.5);
  doc.setTextColor(...colors.dark);
  doc.setFont("helvetica", "normal");

  const col1 = margin + 5;
  const col2 = margin + contentW / 3;
  const col3 = margin + (contentW * 2) / 3;
  const summaryY = y + 13;

  doc.setFont("helvetica", "bold");
  doc.text("Client:", col1, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(questionnaire.clientName || "—", col1 + 14, summaryY);

  doc.setFont("helvetica", "bold");
  doc.text("Quantity:", col2, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(`${questionnaire.quantity} hampers`, col2 + 18, summaryY);

  doc.setFont("helvetica", "bold");
  doc.text("Delivery:", col3, summaryY);
  doc.setFont("helvetica", "normal");
  doc.text(
    questionnaire.deliveryDate
      ? new Date(questionnaire.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "TBD",
    col3 + 18,
    summaryY
  );

  const summaryY2 = summaryY + 7;
  const bu = budgetUtilization(hamper, questionnaire);
  doc.setFont("helvetica", "bold");
  doc.text("Budget:", col1, summaryY2);
  doc.setFont("helvetica", "normal");
  doc.text(`${fmt(bu.total)} per hamper`, col1 + 14, summaryY2);

  doc.setFont("helvetica", "bold");
  doc.text("Packaging:", col2, summaryY2);
  doc.setFont("helvetica", "normal");
  doc.text(questionnaire.packagingType || "Standard", col2 + 22, summaryY2);

  doc.setFont("helvetica", "bold");
  doc.text("Budget Used:", col3, summaryY2);
  doc.setFont("helvetica", "normal");
  doc.text(`${bu.pct}%`, col3 + 26, summaryY2);

  y += 36;

  // ─── Product table ───
  doc.setFontSize(7);
  doc.setTextColor(...colors.light);
  doc.setFont("helvetica", "bold");
  doc.text("PRODUCT BREAKDOWN", margin, y);
  y += 5;

  // Table header
  doc.setFillColor(...colors.primary);
  doc.rect(margin, y, contentW, 8, "F");

  doc.setTextColor(...colors.white);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM", margin + 4, y + 5.5);
  doc.text("ROLE", margin + contentW * 0.55, y + 5.5);
  doc.text("QTY", margin + contentW * 0.72, y + 5.5, { align: "center" });
  doc.text("UNIT PRICE", margin + contentW * 0.85, y + 5.5, { align: "center" });
  doc.text("TOTAL", margin + contentW - 4, y + 5.5, { align: "right" });
  y += 8;

  const roleLabels: Record<string, string> = {
    hero: "Hero",
    supporting: "Supporting",
    filler: "Filler",
    packaging: "Packaging",
  };

  let subtotal = 0;
  hamper.items.forEach((item, idx) => {
    const qty = qtyOverrides[item.name] ?? item.qty;
    const lineTotal = item.unitPrice * qty;
    subtotal += lineTotal;

    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(252, 250, 254);
      doc.rect(margin, y, contentW, 7, "F");
    }

    doc.setTextColor(...colors.dark);
    doc.setFontSize(8);
    doc.setFont("helvetica", item.role === "hero" ? "bold" : "normal");

    const nameMaxW = contentW * 0.5;
    const displayName = item.name.length > 40 ? item.name.substring(0, 38) + "..." : item.name;
    doc.text(displayName, margin + 4, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...colors.mid);
    doc.text(roleLabels[item.role] || item.role, margin + contentW * 0.55, y + 5);

    doc.setTextColor(...colors.dark);
    doc.setFontSize(8);
    doc.text(String(qty), margin + contentW * 0.72, y + 5, { align: "center" });
    doc.text(fmt(item.unitPrice), margin + contentW * 0.85, y + 5, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(fmt(lineTotal), margin + contentW - 4, y + 5, { align: "right" });

    y += 7;
  });

  // Separator
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1, margin + contentW, y + 1);
  y += 5;

  // ─── Pricing summary ───
  const tax = Math.round(subtotal * (hamper.gstPercent / 100));
  const grand = subtotal + tax;
  const perUnit = grand;
  const totalOrder = grand * questionnaire.quantity;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colors.mid);

  const priceCol = margin + contentW * 0.7;
  const priceVal = margin + contentW - 4;

  doc.text("Subtotal", priceCol, y);
  doc.setTextColor(...colors.dark);
  doc.text(fmt(subtotal), priceVal, y, { align: "right" });
  y += 6;

  doc.setTextColor(...colors.mid);
  doc.text(`GST (${hamper.gstPercent}%)`, priceCol, y);
  doc.setTextColor(...colors.dark);
  doc.text(fmt(tax), priceVal, y, { align: "right" });
  y += 6;

  // Grand total highlight
  doc.setFillColor(...colors.primary);
  doc.roundedRect(priceCol - 2, y - 3, contentW - (priceCol - margin) + 6, 10, 1.5, 1.5, "F");
  doc.setTextColor(...colors.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Per Hamper", priceCol + 2, y + 4);
  doc.text(fmt(perUnit), priceVal, y + 4, { align: "right" });
  y += 16;

  doc.setTextColor(...colors.dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Order (${questionnaire.quantity} hampers):`, priceCol - 10, y);
  doc.setTextColor(...colors.primary);
  doc.setFontSize(12);
  doc.text(fmt(totalOrder), priceVal, y, { align: "right" });
  y += 14;

  // ─── Why this hamper ───
  const reasons = whyThisHamper(hamper, questionnaire);
  if (reasons.length > 0) {
    doc.setFillColor(...colors.bg);
    const reasonsH = 8 + reasons.length * 6;
    doc.roundedRect(margin, y, contentW, reasonsH, 2, 2, "F");

    doc.setFontSize(7);
    doc.setTextColor(...colors.light);
    doc.setFont("helvetica", "bold");
    doc.text("WHY THIS HAMPER", margin + 5, y + 6);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(...colors.dark);
    doc.setFont("helvetica", "normal");
    reasons.forEach((r) => {
      doc.text(`•  ${r}`, margin + 5, y + 2);
      y += 6;
    });
    y += 4;
  }

  // ─── Footer ───
  const footerY = 282;
  doc.setDrawColor(...colors.line);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, W - margin, footerY);

  doc.setFontSize(7);
  doc.setTextColor(...colors.light);
  doc.setFont("helvetica", "normal");
  doc.text("This proposal is valid for 7 days from the date of issue. Prices are subject to availability.", margin, footerY + 5);
  doc.text("Generated by Hamper Designer", W - margin, footerY + 5, { align: "right" });

  return doc;
}

/* ── HTML Preview Component ── */
function ProposalPreview({
  hamper,
  qtyOverrides,
  questionnaire,
}: {
  hamper: GeneratedHamper;
  qtyOverrides: Record<string, number>;
  questionnaire: QuestionnaireData;
}) {
  const bu = budgetUtilization(hamper, questionnaire);
  const typeLabel = hamperTypeLabel(hamper, questionnaire);
  const score = confidenceScore(hamper, questionnaire);
  const reasons = whyThisHamper(hamper, questionnaire);

  const pricing = useMemo(() => {
    let subtotal = 0;
    hamper.items.forEach((i) => {
      subtotal += i.unitPrice * (qtyOverrides[i.name] ?? i.qty);
    });
    const tax = Math.round(subtotal * (hamper.gstPercent / 100));
    return { subtotal, tax, grand: subtotal + tax, totalOrder: (subtotal + tax) * questionnaire.quantity };
  }, [hamper, qtyOverrides, questionnaire]);

  const fmtDisplay = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const dateStr = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const deliveryStr = questionnaire.deliveryDate
    ? new Date(questionnaire.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "TBD";

  const roleLabels: Record<string, string> = { hero: "Hero", supporting: "Supporting", filler: "Filler", packaging: "Packaging" };

  return (
    <div className="bg-white text-gray-900 shadow-2xl rounded-lg overflow-hidden max-w-[700px] w-full mx-auto" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div className="bg-primary px-8 py-6 text-primary-foreground">
        <h1 className="text-xl font-bold tracking-wide">GIFT HAMPER PROPOSAL</h1>
        <div className="flex items-center justify-between mt-2 text-xs opacity-90">
          <span>Prepared for {questionnaire.clientName || "Client"} · {dateStr}</span>
          {questionnaire.company && <span>{questionnaire.company}</span>}
        </div>
      </div>
      <div className="h-0.5 bg-primary/40" />

      <div className="px-8 py-6 space-y-6">
        {/* Title */}
        <div>
          <h2 className="text-lg font-bold text-gray-900">{hamper.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{typeLabel} · Score: {score}/100 · {hamper.inventory.status} stock</p>
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Order Summary</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="font-semibold text-gray-600">Client:</span> <span>{questionnaire.clientName || "—"}</span></div>
            <div><span className="font-semibold text-gray-600">Quantity:</span> <span>{questionnaire.quantity} hampers</span></div>
            <div><span className="font-semibold text-gray-600">Delivery:</span> <span>{deliveryStr}</span></div>
            <div><span className="font-semibold text-gray-600">Budget:</span> <span>{fmtDisplay(bu.total)} per hamper</span></div>
            <div><span className="font-semibold text-gray-600">Packaging:</span> <span className="capitalize">{questionnaire.packagingType || "Standard"}</span></div>
            <div><span className="font-semibold text-gray-600">Budget Used:</span> <span>{bu.pct}%</span></div>
          </div>
        </div>

        {/* Product table */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Product Breakdown</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground text-xs">
                <th className="text-left px-3 py-2 font-semibold">Item</th>
                <th className="text-left px-3 py-2 font-semibold">Role</th>
                <th className="text-center px-3 py-2 font-semibold">Qty</th>
                <th className="text-right px-3 py-2 font-semibold">Unit Price</th>
                <th className="text-right px-3 py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {hamper.items.map((item, idx) => {
                const qty = qtyOverrides[item.name] ?? item.qty;
                const lineTotal = item.unitPrice * qty;
                return (
                  <tr key={item.name} className={idx % 2 === 0 ? "bg-purple-50/40" : ""}>
                    <td className={`px-3 py-2 ${item.role === "hero" ? "font-semibold" : ""}`}>
                      {item.name.length > 35 ? item.name.substring(0, 33) + "…" : item.name}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{roleLabels[item.role] || item.role}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDisplay(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtDisplay(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pricing */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span className="tabular-nums text-gray-900">{fmtDisplay(pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>GST ({hamper.gstPercent}%)</span>
              <span className="tabular-nums text-gray-900">{fmtDisplay(pricing.tax)}</span>
            </div>
            <div className="flex justify-between items-center bg-primary text-primary-foreground rounded-md px-3 py-2 font-bold">
              <span>Per Hamper</span>
              <span className="tabular-nums">{fmtDisplay(pricing.grand)}</span>
            </div>
            <div className="flex justify-between pt-2 text-base font-bold">
              <span>Total ({questionnaire.quantity} hampers)</span>
              <span className="tabular-nums text-primary">{fmtDisplay(pricing.totalOrder)}</span>
            </div>
          </div>
        </div>

        {/* Why this hamper */}
        {reasons.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" /> Why This Hamper
            </p>
            <ul className="space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 px-8 py-3 flex justify-between text-[10px] text-gray-400">
        <span>Valid for 7 days. Prices subject to availability.</span>
        <span>Generated by Hamper Designer</span>
      </div>
    </div>
  );
}

export default function HamperPdfDialog({
  open,
  onOpenChange,
  hamper,
  qtyOverrides,
  questionnaire,
}: HamperPdfDialogProps) {
  const pdfRef = useRef<jsPDF | null>(null);

  const handleDownload = useCallback(() => {
    try {
      const doc = generatePdf(hamper, qtyOverrides, questionnaire);
      const safeName = hamper.name.replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(`${safeName}_proposal.pdf`);
    } catch (err: any) {
      console.error("[HamperPdfDialog] PDF generation failed:", err);
      import("sonner").then(({ toast }) =>
        toast.error("PDF generation failed: " + (err?.message || "Unknown error"))
      );
    }
  }, [hamper, qtyOverrides, questionnaire]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in-0 duration-200">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-card shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Proposal Preview</h2>
            <p className="text-[11px] text-muted-foreground">{hamper.name}</p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 text-xs h-9 px-4"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto p-6 bg-muted/30">
        <ProposalPreview
          hamper={hamper}
          qtyOverrides={qtyOverrides}
          questionnaire={questionnaire}
        />
      </div>
    </div>
  );
}
