import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
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

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

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

export default function HamperPdfDialog({
  open,
  onOpenChange,
  hamper,
  qtyOverrides,
  questionnaire,
}: HamperPdfDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const pdfRef = useRef<jsPDF | null>(null);

  const generate = useCallback(() => {
    setIsGenerating(true);
    // Use setTimeout to allow the loading state to render
    setTimeout(() => {
      try {
        const doc = generatePdf(hamper, qtyOverrides, questionnaire);
        pdfRef.current = doc;
        const blob = doc.output("blob");
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch (err) {
        console.error("PDF generation failed:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  }, [hamper, qtyOverrides, questionnaire]);

  useEffect(() => {
    if (open) {
      generate();
    } else {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      pdfRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDownload = () => {
    if (!pdfRef.current) return;
    const safeName = hamper.name.replace(/[^a-zA-Z0-9]/g, "_");
    pdfRef.current.save(`${safeName}_proposal.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-semibold">
              PDF Preview — {hamper.name}
            </DialogTitle>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={handleDownload}
              disabled={!previewUrl}
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/50 overflow-hidden">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating PDF…
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Failed to generate PDF
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
