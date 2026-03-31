import type { GeneratedHamper, QuestionnaireData } from "./types";

/* ── Budget utilization ───────────────────────── */
export function budgetUtilization(hamper: GeneratedHamper, q: QuestionnaireData) {
  const perHamperBudget =
    q.budgetMode === "total" ? q.budget / Math.max(q.quantity, 1) : q.budget;
  if (perHamperBudget <= 0) return { pct: 0, used: hamper.totalPrice, total: 0 };
  const pct = Math.min(100, Math.round((hamper.totalPrice / perHamperBudget) * 100));
  return { pct, used: hamper.totalPrice, total: perHamperBudget };
}

/* ── Hamper type label ────────────────────────── */
export function hamperTypeLabel(hamper: GeneratedHamper, q: QuestionnaireData): string {
  const bu = budgetUtilization(hamper, q);
  const heroItems = hamper.items.filter((i) => i.role === "hero");
  const fillerItems = hamper.items.filter((i) => i.role === "filler");
  const heroValue = heroItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const heroRatio = hamper.totalPrice > 0 ? heroValue / hamper.totalPrice : 0;

  if (heroRatio > 0.55) return "Premium Leaning";
  if (bu.pct < 70) return "Budget Optimized";
  if (hamper.inventory.status === "Safe" && hamper.badges.includes("FAST DELIVERY"))
    return "Fast Delivery Safe";
  if (fillerItems.length >= 3) return "Variety Pack";
  return "Balanced Mix";
}

/* ── Confidence score ─────────────────────────── */
export function confidenceScore(hamper: GeneratedHamper, q: QuestionnaireData): number {
  let score = 0;

  // Budget utilization (max 35)
  const bu = budgetUtilization(hamper, q);
  if (bu.pct >= 85 && bu.pct <= 100) score += 35;
  else if (bu.pct >= 70) score += 25;
  else if (bu.pct >= 50) score += 15;
  else score += 5;

  // Inventory safety (max 25)
  if (hamper.inventory.status === "Safe") score += 25;
  else if (hamper.inventory.status === "Low") score += 12;
  else score += 0;

  // Constraint satisfaction (max 25)
  // must-have items present
  const mustHaveCount = q.mustHaveItems.length;
  const presentCount = q.mustHaveItems.filter((m) =>
    hamper.items.some((i) => i.name.toLowerCase().includes(m.toLowerCase()))
  ).length;
  if (mustHaveCount === 0) score += 25;
  else score += Math.round((presentCount / mustHaveCount) * 25);

  // Feasibility (max 15)
  if (hamper.feasibility === "green") score += 15;
  else if (hamper.feasibility === "yellow") score += 8;
  else score += 0;

  return Math.min(100, score);
}

/* ── Dynamic "Why this hamper" reasons ────────── */
export function whyThisHamper(hamper: GeneratedHamper, q: QuestionnaireData): string[] {
  const reasons: string[] = [];
  const bu = budgetUtilization(hamper, q);

  if (bu.pct >= 85 && bu.pct <= 100) reasons.push("Fits budget efficiently");
  else if (bu.pct < 85 && bu.pct >= 50) reasons.push("Leaves room in budget for add-ons");

  const heroItems = hamper.items.filter((i) => i.role === "hero");
  if (heroItems.length > 0) {
    const heroVal = heroItems.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    if (heroVal > hamper.totalPrice * 0.4) reasons.push("Includes high-value hero product");
  }

  const uniqueRoles = new Set(hamper.items.map((i) => i.role));
  if (uniqueRoles.size >= 3) reasons.push("Balanced mix of product types");

  if (hamper.inventory.status === "Safe") reasons.push("Safe inventory for bulk orders");
  else if (hamper.inventory.status === "Low") reasons.push("Stock available but limited");

  if (hamper.badges.includes("FAST DELIVERY")) reasons.push("Quick turnaround possible");
  if (hamper.badges.includes("PREMIUM")) reasons.push("Premium quality selection");

  if (q.mustHaveItems.length > 0) {
    const matched = q.mustHaveItems.filter((m) =>
      hamper.items.some((i) => i.name.toLowerCase().includes(m.toLowerCase()))
    ).length;
    if (matched === q.mustHaveItems.length) reasons.push("All must-have items included");
    else if (matched > 0) reasons.push(`${matched}/${q.mustHaveItems.length} must-have items included`);
  }

  return reasons.slice(0, 4);
}

/* ── Smart warnings ──────────────────────────── */
export function smartWarnings(hamper: GeneratedHamper, q: QuestionnaireData): string[] {
  const warnings: string[] = [];
  const bu = budgetUtilization(hamper, q);

  if (hamper.inventory.status === "Low")
    warnings.push("Inventory is limited for large quantities");
  if (hamper.inventory.status === "Out of Stock")
    warnings.push("Some items may be out of stock");

  if (bu.pct < 65)
    warnings.push("Budget underused — consider adding a supporting item");

  const fillers = hamper.items.filter((i) => i.role === "filler");
  if (fillers.length >= 4)
    warnings.push("Many fillers — consider replacing one with a supporting product");

  if (bu.pct > 100)
    warnings.push("Exceeds budget — adjust quantities or swap items");

  return warnings;
}
