import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { QuestionnaireData, GeneratedHamper } from "@/components/hamper/types";
import { generateHampers } from "@/components/hamper/mockGenerator";
import HamperWizard from "@/components/hamper/HamperWizard";
import HamperCardList from "@/components/hamper/HamperCardList";
import HamperPreview from "@/components/hamper/HamperPreview";
import QuestionnaireRecap from "@/components/hamper/QuestionnaireRecap";

const HamperDesigner = () => {
  const [phase, setPhase] = useState<"wizard" | "results">("wizard");
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [hampers, setHampers] = useState<GeneratedHamper[]>([]);
  const [selected, setSelected] = useState<GeneratedHamper | null>(null);
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});

  const handleGenerate = useCallback((data: QuestionnaireData) => {
    setQuestionnaire(data);
    const results = generateHampers(data);
    setHampers(results);
    const first = results[0];
    setSelected(first);
    const defaults: Record<string, number> = {};
    first.items.forEach((i) => (defaults[i.name] = i.qty));
    setQtyOverrides(defaults);
    setPhase("results");
  }, []);

  const handleSelect = useCallback((h: GeneratedHamper) => {
    setSelected(h);
    const defaults: Record<string, number> = {};
    h.items.forEach((i) => (defaults[i.name] = i.qty));
    setQtyOverrides(defaults);
  }, []);

  const adjustQty = useCallback((itemName: string, delta: number) => {
    setQtyOverrides((prev) => ({
      ...prev,
      [itemName]: Math.max(1, (prev[itemName] ?? 1) + delta),
    }));
  }, []);

  // Keyboard nav for results
  useEffect(() => {
    if (phase !== "results") return;
    const handler = (e: KeyboardEvent) => {
      const nonBackup = hampers.filter((h) => !h.isBackup);
      const idx = nonBackup.findIndex((h) => h.id === selected?.id);
      if (idx < 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = nonBackup[Math.min(idx + 1, nonBackup.length - 1)];
        handleSelect(next);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = nonBackup[Math.max(idx - 1, 0)];
        handleSelect(prev);
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
                {phase === "wizard" ? "Questionnaire" : "Generated Suggestions"}
              </p>
            </div>
          </div>
          {phase === "results" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px]">↑↓</kbd>
              <span>Navigate hampers</span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[1920px] mx-auto px-3 py-3 w-full">
        {phase === "wizard" && (
          <div className="flex items-start justify-center pt-6">
            <HamperWizard onGenerate={handleGenerate} />
          </div>
        )}

        {phase === "results" && selected && questionnaire && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-3 h-[calc(100vh-56px)]">
            {/* Left: Recap */}
            <aside className="lg:overflow-y-auto lg:pr-1 space-y-2">
              <QuestionnaireRecap data={questionnaire} onEdit={() => setPhase("wizard")} />
            </aside>

            {/* Center: Cards */}
            <section className="lg:overflow-y-auto lg:pr-1">
              <HamperCardList hampers={hampers} selectedId={selected.id} onSelect={handleSelect} />
            </section>

            {/* Right: Preview */}
            <aside className="lg:overflow-y-auto">
              <HamperPreview hamper={selected} qtyOverrides={qtyOverrides} onAdjustQty={adjustQty} />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
};

export default HamperDesigner;
