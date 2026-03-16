import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { CatalogForm, CatalogPageData } from "@/components/CatalogForm";
import { CatalogPreview } from "@/components/CatalogPreview";
import { MultiPagePreview } from "@/components/MultiPagePreview";
import { Button } from "@/components/ui/button";
import { Download, Eye, Sparkles, ChevronLeft, ChevronRight, FileText, Presentation, Receipt, Gift } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import PptxGenJS from "pptxgenjs";
import { toast } from "sonner";

const createEmptyPage = (): CatalogPageData => ({
  id: crypto.randomUUID(),
  type: "template",
  image: null,
  title: "",
  description: "",
  items: [""],
  plasticPercent: "",
  carbonPercent: "",
});

const Index = () => {
  const multiPageRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePageIndex, setActivePageIndex] = useState(0);
  
  const [pages, setPages] = useState<CatalogPageData[]>([createEmptyPage()]);

  const activePage = pages[activePageIndex];

  const handleDownloadPDF = async () => {
    if (!multiPageRef.current) return;

    const invalidPages = pages.filter((p) => !p.image);
    if (invalidPages.length > 0) {
      toast.error(`Please add an image to all ${pages.length} pages`);
      return;
    }

    setIsGenerating(true);

    try {
      const nodes = Array.from(
        multiPageRef.current.querySelectorAll<HTMLElement>(".pdf-page")
      );

      const pdf = new jsPDF({
        unit: "px",
        format: [1200, 630],
        orientation: "landscape",
      });

      for (let i = 0; i < nodes.length; i++) {
        const canvas = await html2canvas(nodes[i], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: 1200,
          height: 630,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);

        if (i > 0) pdf.addPage([1200, 630], "landscape");
        pdf.addImage(imgData, "JPEG", 0, 0, 1200, 630);
      }

      pdf.save(`catalog_${pages.length}_pages.pdf`);
      toast.success(`PDF with ${pages.length} page(s) downloaded!`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPPT = async () => {
    if (!multiPageRef.current) return;

    const invalidPages = pages.filter((p) => !p.image);
    if (invalidPages.length > 0) {
      toast.error(`Please add an image to all ${pages.length} pages`);
      return;
    }

    setIsGenerating(true);

    try {
      const pptx = new PptxGenJS();
      pptx.defineLayout({ name: 'CATALOG', width: 10, height: 5.25 });
      pptx.layout = 'CATALOG';

      const nodes = Array.from(
        multiPageRef.current.querySelectorAll<HTMLElement>(".pdf-page")
      );

      for (const node of nodes) {
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: 1200,
          height: 630,
        });

        const imgData = canvas.toDataURL("image/png");
        const slide = pptx.addSlide();
        slide.addImage({
          data: imgData,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
        });
      }

      await pptx.writeFile({ fileName: `catalog_${pages.length}_pages.pptx` });
      toast.success(`PowerPoint with ${pages.length} slide(s) downloaded!`);
    } catch (error) {
      console.error("Error generating PPT:", error);
      toast.error("Failed to generate PowerPoint. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const goToPrevPage = () => {
    if (activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
    }
  };

  const goToNextPage = () => {
    if (activePageIndex < pages.length - 1) {
      setActivePageIndex(activePageIndex + 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card shadow-sm sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">∞</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary">Catalog Generator</h1>
              <p className="text-xs text-muted-foreground">Create multi-page PDF catalogs</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Link to="/invoice">
              <Button variant="outline" className="gap-2">
                <Receipt className="h-4 w-4" />
                Invoice
              </Button>
            </Link>
            <Link to="/staff/hamper-designer">
              <Button variant="outline" className="gap-2">
                <Gift className="h-4 w-4" />
                Hamper Designer
              </Button>
            </Link>
            <Button
              onClick={handleDownloadPDF}
              disabled={isGenerating}
              variant="outline"
              className="gap-2"
            >
              {isGenerating ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              PDF
            </Button>
            <Button
              onClick={handleDownloadPPT}
              disabled={isGenerating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-md"
            >
              {isGenerating ? (
                <Sparkles className="h-4 w-4 animate-spin" />
              ) : (
                <Presentation className="h-4 w-4" />
              )}
              PPT ({pages.length})
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[380px,1fr] gap-8">
          {/* Form Section */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CatalogForm 
              pages={pages} 
              activePageIndex={activePageIndex}
              onPagesChange={setPages} 
              onActivePageChange={setActivePageIndex}
            />
          </aside>

          {/* Preview Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>Live Preview</span>
              </div>
              
              {/* Page Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevPage}
                  disabled={activePageIndex === 0}
                  className="h-8 px-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[80px] text-center">
                  Page {activePageIndex + 1} of {pages.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={activePageIndex === pages.length - 1}
                  className="h-8 px-2"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Single Page Preview */}
            <div className="catalog-preview rounded-xl overflow-hidden border border-border/50">
              <div className="overflow-x-auto">
                <CatalogPreview page={activePage} />
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Previewing page {activePageIndex + 1}. All {pages.length} pages will be included in PDF.
            </p>

            {/* Page Thumbnails */}
            {pages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {pages.map((page, index) => (
                  <button
                    key={page.id}
                    onClick={() => setActivePageIndex(index)}
                    className={`relative shrink-0 w-24 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      index === activePageIndex 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    {page.image ? (
                      <img src={page.image} alt={`Page ${index + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        page.type === "full-image" ? "bg-accent/20" : "bg-secondary/50"
                      }`}>
                        <span className="text-xs text-muted-foreground">
                          {page.type === "full-image" ? "🖼️" : index + 1}
                        </span>
                      </div>
                    )}
                    <div className={`absolute bottom-0 left-0 right-0 text-primary-foreground text-[10px] text-center py-0.5 ${
                      page.type === "full-image" ? "bg-accent/80" : "bg-foreground/70"
                    }`}>
                      {page.type === "full-image" 
                        ? "Full Image" 
                        : (page.title ? page.title.slice(0, 10) + (page.title.length > 10 ? '...' : '') : `Page ${index + 1}`)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Hidden multi-page container for PDF generation */}
      <div className="fixed left-0 top-0 opacity-0 pointer-events-none -z-10">
        <MultiPagePreview ref={multiPageRef} pages={pages} />
      </div>
      <footer className="border-t border-border/50 mt-12 py-6">
        <div className="max-w-[1800px] mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>Corporate Gifting Catalog Generator • Made with care for your sales team</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
