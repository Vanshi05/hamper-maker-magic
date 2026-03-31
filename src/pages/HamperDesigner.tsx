import { useState, useCallback, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionnaireData, GeneratedHamper } from "@/components/hamper/types";
import { generateHampersFromAirtable, fetchProducts } from "@/components/hamper/airtableGenerator";
import type { AirtableProduct } from "@/components/hamper/airtableGenerator";
import HamperWizard from "@/components/hamper/HamperWizard";
import HamperCardList, { HamperCardSkeletons, HamperEmptyState, ComparisonPanel } from "@/components/hamper/HamperCardList";
import HamperPreview from "@/components/hamper/HamperPreview";
import QuestionnaireRecap from "@/components/hamper/QuestionnaireRecap";
import { toast } from "@/hooks/use-toast";

const HamperDesigner = () => {
  const [phase, setPhase] = useState<"wizard" | "loading" | "results">("wizard");
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [hampers, setHampers] = useState<GeneratedHamper[]>([]);
  const [selected, setSelected] = useState<GeneratedHamper | null>(null);
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const [products, setProducts] = useState<AirtableProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((data) => { if (!cancelled) { setProducts(data); setIsLoadingProducts(false); } })
      .catch((err) => { if (!cancelled) { console.error("Failed to prefetch products:", err); setIsLoadingProducts(false); } });
    return () => { cancelled = true; };
  }, []);

  const applyHamperSelection = useCallback((results: GeneratedHamper[]) => {
    setHampers(results);
    setCompareIds([]);
    const first = results[0];
    setSelected(first);
    const defaults: Record<string, number> = {};
    first.items.forEach((i) => (defaults[i.name] = i.qty));
    setQtyOverrides(defaults);
  }, []);

  const handleGenerate = useCallback(async (data: QuestionnaireData) => {
    setQuestionnaire(data);
    setPhase("loading");
    try {
      const results = await generateHampersFromAirtable(data, products.length > 0 ? products : undefined);
      if (results.length === 0) {
        toast({ title: "No hampers found", description: "Couldn't find a perfect match — try adjusting filters.", variant: "destructive" });
        setPhase("wizard");
        return;
      }
      applyHamperSelection(results);
      setPhase("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate hampers";
      toast({ title: "Error", description: msg, variant: "destructive" });
      setPhase("wizard");
    }
  }, [products, applyHamperSelection]);

  const handleSelect = useCallback((h: GeneratedHamper) => {
    setSelected(h);
    const defaults: Record<string, number> = {};
    h.items.forEach((i) => (defaults[i.name] = i.qty));
    setQtyOverrides(defaults);
  }, []);

  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (!questionnaire) return;
    setIsRegenerating(true);
    try {
      const results = await generateHampersFromAirtable(questionnaire, products.length > 0 ? products : undefined);
      if (results.length === 0) {
        toast({ title: "No hampers found", description: "Couldn't find a perfect match — try adjusting filters.", variant: "destructive" });
        return;
      }
      applyHamperSelection(results);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to regenerate";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsRegenerating(false);
    }
  }, [questionnaire, products, applyHamperSelection]);

  const adjustQty = useCallback((itemName: string, delta: number) => {
    setQtyOverrides((prev) => ({
      ...prev,
      [itemName]: Math.max(1, (prev[itemName] ?? 1) + delta),
    }));
  }, []);

  const compareHampers = useMemo(
    () => hampers.filter((h) => compareIds.includes(h.id)),
    [hampers, compareIds]
  );

  // Keyboard nav
  useEffect(() => {
    if (phase !== "results") return;
    const handler = (e: KeyboardEvent) => {
      const nonBackup = hampers.filter((h) => !h.isBackup);
      const idx = nonBackup.findIndex((h) => h.id === selected?.id);
      if (idx < 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        handleSelect(nonBackup[Math.min(idx + 1, nonBackup.length - 1)]);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleSelect(nonBackup[Math.max(idx - 1, 0)]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, hampers, selected, handleSelect]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card shadow-sm sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-bold text-primary leading-tight">Hamper Designer</h1>
              <p className="text-[11px] text-muted-foreground">
                {phase === "wizard" ? "Questionnaire" : phase === "loading" ? "Finding the best hampers…" : "Your Recommendations"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {phase === "results" && (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px]">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isRegenerating && "animate-spin")} />
                  {isRegenerating ? "Regenerating…" : "Regenerate Hampers"}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1920px] mx-auto px-4 py-4 w-full">
        {phase === "wizard" && (
          <div className="flex items-start justify-center pt-6">
            <HamperWizard onGenerate={handleGenerate} products={products} isLoadingProducts={isLoadingProducts} />
          </div>
        )}

        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center pt-8 gap-6">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finding the best combinations for you…</p>
            </div>
            <div className="w-full max-w-5xl">
              <HamperCardSkeletons />
            </div>
          </div>
        )}

        {phase === "results" && selected && questionnaire && (
          <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr_360px] gap-5 h-[calc(100vh-60px)]">
            {/* Left: Minimal Recap */}
            <aside className="lg:overflow-y-auto space-y-3">
              <QuestionnaireRecap data={questionnaire} onEdit={() => setPhase("wizard")} />
            </aside>

            {/* Center: Card Grid */}
            <section className="lg:overflow-y-auto pb-4 space-y-5">
              {/* Comparison panel */}
              {compareIds.length === 2 && (
                <ComparisonPanel
                  hampers={compareHampers}
                  q={questionnaire}
                  onClear={() => setCompareIds([])}
                />
              )}

              <HamperCardList
                hampers={hampers}
                selectedId={selected.id}
                onSelect={handleSelect}
                questionnaire={questionnaire}
                compareIds={compareIds}
                onToggleCompare={handleToggleCompare}
                isRegenerating={isRegenerating}
              />
            </section>

            {/* Right: Full Detail Panel */}
            <aside className="lg:overflow-y-auto">
              <HamperPreview
                hamper={selected}
                qtyOverrides={qtyOverrides}
                onAdjustQty={adjustQty}
                questionnaire={questionnaire}
              />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

export default HamperDesigner;
