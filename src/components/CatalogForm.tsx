import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Plus, Trash2, ChevronDown, ChevronUp, ImageIcon, Search, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export interface CatalogPageData {
  id: string;
  type: "template" | "full-image";
  image: string | null;
  title: string;
  description: string;
  items: string[];
  plasticPercent: string;
  carbonPercent: string;
  ghId?: string; // Optional: to track which GHID was used
  preTaxPrice?: number; // Optional: to store price
}

interface CatalogFormProps {
  pages: CatalogPageData[];
  activePageIndex: number;
  onPagesChange: (pages: CatalogPageData[]) => void;
  onActivePageChange: (index: number) => void;
}

const MAX_BULK_GHIDS = 10;

export function CatalogForm({ pages, activePageIndex, onPagesChange, onActivePageChange }: CatalogFormProps) {
  const [openPages, setOpenPages] = useState<Record<string, boolean>>({ [pages[0]?.id]: true });
  const [itemsDraftByPageId, setItemsDraftByPageId] = useState<Record<string, string>>({});
  const [itemCountByPageId, setItemCountByPageId] = useState<Record<string, string>>({});
  
  // GHID fetch states
  const [ghidInput, setGhidInput] = useState<Record<string, string>>({});
  const [fetchingGhid, setFetchingGhid] = useState<Record<string, boolean>>({});
  
  // Bulk GHID states
  const [bulkGhids, setBulkGhids] = useState("");
  const [isBulkFetching, setIsBulkFetching] = useState(false);

  const activePage = pages[activePageIndex];

  const handleImageUpload = (pageId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newPages = pages.map(p => 
          p.id === pageId ? { ...p, image: event.target?.result as string } : p
        );
        onPagesChange(newPages);
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePage = (pageId: string, updates: Partial<CatalogPageData>) => {
    const newPages = pages.map(p => 
      p.id === pageId ? { ...p, ...updates } : p
    );
    onPagesChange(newPages);
  };

  const getItemsText = (items: string[]) => items.filter(Boolean).join(", ");

  const getExpectedItemCount = (pageId: string, override?: string) => {
    const raw = (override ?? itemCountByPageId[pageId] ?? "").trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const parseItems = (raw: string, expectedCount?: number) => {
    const parsed = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (expectedCount) return parsed.slice(0, expectedCount);
    return parsed;
  };

  const handleItemsChange = (pageId: string, raw: string) => {
    setItemsDraftByPageId((prev) => ({ ...prev, [pageId]: raw }));

    const expectedCount = getExpectedItemCount(pageId);
    const items = parseItems(raw, expectedCount);
    updatePage(pageId, { items: items.length > 0 ? items : [""] });
  };

  // GHID Fetch Function
  const handleFetchGhid = async (pageId: string) => {
    const ghId = ghidInput[pageId]?.trim();
    
    if (!ghId) {
      toast.error("Please enter a GHID");
      return;
    }

    setFetchingGhid((prev) => ({ ...prev, [pageId]: true }));

    try {
      const SUPABASE_URL = 'https://dpwdnuqvnclbjarowgmv.supabase.co';
      const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwd2RudXF2bmNsYmphcm93Z212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTM2OTMsImV4cCI6MjA4NDU4OTY5M30.m2GnYhntrBdwTmK3rp0svWysTEMdss8g_KgqpN7_usg';
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hamper?gh_id=${encodeURIComponent(ghId)}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        toast.error(result?.error || "Failed to fetch gift hamper");
        return;
      }

      const data = result.data;

      // Parse items from gh_bom (assuming it's comma-separated or similar format)
      const bomItems = data.gh_bom 
        ? data.gh_bom.split(',').map((item: string) => item.trim()).filter(Boolean)
        : [];

      // Update the page with fetched data
      updatePage(pageId, {
        title: data.name,
        image: data.image,
        description: data.fancy_config || "",
        items: bomItems.length > 0 ? bomItems : [""],
        ghId: ghId,
        preTaxPrice: data.pre_tax_sale_price_without_shipping,
      });

      // Update items draft and count
      setItemsDraftByPageId((prev) => ({ 
        ...prev, 
        [pageId]: bomItems.join(", ") 
      }));
      
      setItemCountByPageId((prev) => ({ 
        ...prev, 
        [pageId]: String(bomItems.length) 
      }));

      toast.success(`Gift hamper "${data.name}" loaded successfully!`);
    } catch (error) {
      console.error("Error fetching GHID:", error);
      toast.error("Failed to fetch gift hamper. Please try again.");
    } finally {
      setFetchingGhid((prev) => ({ ...prev, [pageId]: false }));
    }
  };

  // Bulk GHID Fetch Function
  const handleBulkFetchGhids = async () => {
    const ghidList = bulkGhids
      .split(/[,\n]+/)
      .map(g => g.trim())
      .filter(Boolean);
    
    if (ghidList.length === 0) {
      toast.error("Please enter at least one GHID");
      return;
    }

    if (ghidList.length > MAX_BULK_GHIDS) {
      toast.error(`Maximum ${MAX_BULK_GHIDS} GHIDs allowed at once`);
      return;
    }

    setIsBulkFetching(true);
    
    const newPages: CatalogPageData[] = [];
    const newOpenPages: Record<string, boolean> = {};
    const newItemsDraft: Record<string, string> = {};
    const newItemCount: Record<string, string> = {};
    const newGhidInput: Record<string, string> = {};
    
    let successCount = 0;
    let failedGhids: string[] = [];

    for (const ghId of ghidList) {
      try {
        const SUPABASE_URL = 'https://dpwdnuqvnclbjarowgmv.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwd2RudXF2bmNsYmphcm93Z212Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTM2OTMsImV4cCI6MjA4NDU4OTY5M30.m2GnYhntrBdwTmK3rp0svWysTEMdss8g_KgqpN7_usg';
        const response = await fetch(`${SUPABASE_URL}/functions/v1/hamper?gh_id=${encodeURIComponent(ghId)}`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          failedGhids.push(ghId);
          continue;
        }

        const data = result.data;
        const bomItems = data.gh_bom 
          ? data.gh_bom.split(',').map((item: string) => item.trim()).filter(Boolean)
          : [];

        const pageId = crypto.randomUUID();
        const newPage: CatalogPageData = {
          id: pageId,
          type: "template",
          image: data.image,
          title: data.name,
          description: data.fancy_config || "",
          items: bomItems.length > 0 ? bomItems : [""],
          plasticPercent: "",
          carbonPercent: "",
          ghId: ghId,
          preTaxPrice: data.pre_tax_sale_price_without_shipping,
        };

        newPages.push(newPage);
        newOpenPages[pageId] = false;
        newItemsDraft[pageId] = bomItems.join(", ");
        newItemCount[pageId] = String(bomItems.length);
        newGhidInput[pageId] = ghId;
        successCount++;
      } catch (error) {
        console.error(`Error fetching GHID ${ghId}:`, error);
        failedGhids.push(ghId);
      }
    }

    if (newPages.length > 0) {
      // Replace all pages with new ones (or keep first empty if all failed)
      onPagesChange(newPages);
      setOpenPages({ ...newOpenPages, [newPages[0].id]: true });
      setItemsDraftByPageId(newItemsDraft);
      setItemCountByPageId(newItemCount);
      setGhidInput(newGhidInput);
      onActivePageChange(0);
      setBulkGhids("");
    }

    if (successCount > 0) {
      toast.success(`Loaded ${successCount} hamper(s) successfully!`);
    }
    if (failedGhids.length > 0) {
      toast.error(`Failed to load: ${failedGhids.join(", ")}`);
    }

    setIsBulkFetching(false);
  };

  const addNewPage = (type: "template" | "full-image" = "template") => {
    const newPage: CatalogPageData = {
      id: crypto.randomUUID(),
      type,
      image: null,
      title: type === "full-image" ? "Full Page Image" : "",
      description: "",
      items: [""],
      plasticPercent: "",
      carbonPercent: "",
    };
    onPagesChange([...pages, newPage]);
    setOpenPages({ ...openPages, [newPage.id]: true });
    setItemsDraftByPageId((prev) => ({ ...prev, [newPage.id]: "" }));
    setItemCountByPageId((prev) => ({ ...prev, [newPage.id]: "" }));
    setGhidInput((prev) => ({ ...prev, [newPage.id]: "" }));
    onActivePageChange(pages.length);
  };

  const insertFullImagePage = (atPosition: number) => {
    const newPage: CatalogPageData = {
      id: crypto.randomUUID(),
      type: "full-image",
      image: null,
      title: "Full Page Image",
      description: "",
      items: [""],
      plasticPercent: "",
      carbonPercent: "",
    };
    const newPages = [...pages.slice(0, atPosition), newPage, ...pages.slice(atPosition)];
    onPagesChange(newPages);
    setOpenPages({ ...openPages, [newPage.id]: true });
    onActivePageChange(atPosition);
    setInsertPosition("");
  };

  const [insertPosition, setInsertPosition] = useState("");

  const removePage = (pageId: string) => {
    if (pages.length <= 1) return;
    const pageIndex = pages.findIndex(p => p.id === pageId);
    const newPages = pages.filter(p => p.id !== pageId);
    onPagesChange(newPages);

    setItemsDraftByPageId((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setItemCountByPageId((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });
    setGhidInput((prev) => {
      const next = { ...prev };
      delete next[pageId];
      return next;
    });

    if (activePageIndex >= newPages.length) {
      onActivePageChange(newPages.length - 1);
    } else if (pageIndex <= activePageIndex && activePageIndex > 0) {
      onActivePageChange(activePageIndex - 1);
    }
  };

  const togglePage = (pageId: string) => {
    setOpenPages({ ...openPages, [pageId]: !openPages[pageId] });
  };

  return (
    <Card className="h-full border-border/50 bg-card shadow-lg">
      <CardHeader className="border-b border-border/50 bg-plum-light/50 flex-col gap-3">
        {/* Bulk GHID Input */}
        <div className="w-full p-3 bg-primary/10 rounded-lg border border-primary/30 space-y-2">
          <Label className="text-xs font-semibold text-primary flex items-center gap-2">
            <Search className="h-3 w-3" />
            Bulk Load from Airtable (Max {MAX_BULK_GHIDS})
          </Label>
          <Textarea
            placeholder="Enter GHIDs separated by commas or new lines&#10;e.g., GH001, GH002, GH003"
            value={bulkGhids}
            onChange={(e) => setBulkGhids(e.target.value)}
            className="h-20 text-sm resize-none"
            disabled={isBulkFetching}
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {bulkGhids.split(/[,\n]+/).filter(g => g.trim()).length} GHID(s) entered
            </p>
            <Button
              type="button"
              onClick={handleBulkFetchGhids}
              disabled={isBulkFetching || !bulkGhids.trim()}
              size="sm"
              className="h-8"
            >
              {isBulkFetching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-1" />
                  Load All
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2 text-primary text-base">
            📄 Catalog Pages ({pages.length})
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addNewPage("template")}
            className="h-8 text-xs border-primary/30 hover:bg-plum-light"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Template Page
          </Button>
        </div>
        
        {/* Insert Full Image Page */}
        <div className="flex items-center gap-2 w-full">
          <Select value={insertPosition} onValueChange={setInsertPosition}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Insert full-image at position..." />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: pages.length + 1 }, (_, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {i === 0 ? "At start (Page 1)" : i === pages.length ? `At end (Page ${i + 1})` : `After Page ${i} (becomes Page ${i + 1})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => insertPosition && insertFullImagePage(Number(insertPosition) - 1)}
            disabled={!insertPosition}
            className="h-8 text-xs"
          >
            <ImageIcon className="h-3 w-3 mr-1" />
            Insert
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 overflow-y-auto max-h-[calc(100vh-200px)] space-y-3">
        {pages.map((page, index) => (
          <Collapsible
            key={page.id}
            open={openPages[page.id]}
            onOpenChange={() => togglePage(page.id)}
          >
            <div 
              className={`border rounded-lg overflow-hidden transition-all ${
                activePageIndex === index 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'border-border/50 hover:border-primary/30'
              }`}
              onClick={() => onActivePageChange(index)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 bg-secondary/30 cursor-pointer hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full text-primary-foreground text-xs flex items-center justify-center font-medium ${
                      page.type === "full-image" ? "bg-accent" : "bg-primary"
                    }`}>
                      {page.type === "full-image" ? <ImageIcon className="h-3 w-3" /> : index + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[160px]">
                        {page.title || `Page ${index + 1}`}
                      </span>
                      {page.type === "full-image" && (
                        <span className="text-[10px] text-accent">Full Image Page</span>
                      )}
                      {page.ghId && (
                        <span className="text-[10px] text-muted-foreground">GHID: {page.ghId}</span>
                      )}
                    </div>
                    {page.image && (
                      <span className="text-xs text-eco">✓ Photo</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {pages.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePage(page.id);
                        }}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {openPages[page.id] ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="p-4 space-y-4 bg-card">
                  {page.type === "full-image" ? (
                    /* Full Image Page - Only image upload */
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Full Page Image</Label>
                      <p className="text-[10px] text-muted-foreground">
                        This image will cover the entire page (1200×630px recommended)
                      </p>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(page.id, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="border-2 border-dashed border-accent/50 rounded-lg p-4 text-center hover:border-accent transition-all bg-accent/10">
                          {page.image ? (
                            <div className="flex items-center gap-3">
                              <img
                                src={page.image}
                                alt="Preview"
                                className="w-24 h-14 object-cover rounded-lg shadow-md"
                              />
                              <p className="text-xs text-muted-foreground">Click to change</p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 justify-center py-4">
                              <ImageIcon className="h-6 w-6 text-accent/50" />
                              <p className="text-xs text-muted-foreground">Upload full page image</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Template Page - Full form with GHID fetch */
                    <>
                      {/* GHID Fetch Section */}
                      <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <Label className="text-xs font-medium text-primary">Quick Fill from Airtable</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter GHID"
                            value={ghidInput[page.id] || ""}
                            onChange={(e) => setGhidInput((prev) => ({ 
                              ...prev, 
                              [page.id]: e.target.value 
                            }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleFetchGhid(page.id);
                              }
                            }}
                            className="h-9 text-sm flex-1"
                            disabled={fetchingGhid[page.id]}
                          />
                          <Button
                            type="button"
                            onClick={() => handleFetchGhid(page.id)}
                            disabled={fetchingGhid[page.id] || !ghidInput[page.id]?.trim()}
                            className="h-9 px-3"
                            size="sm"
                          >
                            {fetchingGhid[page.id] ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Fetching...
                              </>
                            ) : (
                              <>
                                <Search className="h-4 w-4 mr-1" />
                                Fetch
                              </>
                            )}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Enter a GHID to auto-fill title, image, and items from your Airtable
                        </p>
                      </div>

                      {/* Image Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Hamper Photo</Label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(page.id, e)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className="border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:border-primary/60 transition-all bg-plum-light/30">
                            {page.image ? (
                              <div className="flex items-center gap-3">
                                <img
                                  src={page.image}
                                  alt="Preview"
                                  className="w-16 h-16 object-cover rounded-lg shadow-md"
                                />
                                <p className="text-xs text-muted-foreground">Click to change</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-center py-2">
                                <Upload className="h-5 w-5 text-primary/50" />
                                <p className="text-xs text-muted-foreground">Upload photo</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Title */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Title</Label>
                        <Input
                          placeholder="e.g., Diwali Delights Gift Hamper"
                          value={page.title}
                          onChange={(e) => updatePage(page.id, { title: e.target.value })}
                          className="h-9 text-sm"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1">
                        <Label className="text-xs font-medium">Description</Label>
                        <Textarea
                          placeholder="Write a description..."
                          value={page.description}
                          onChange={(e) => updatePage(page.id, { description: e.target.value })}
                          rows={3}
                          className="text-sm resize-none"
                        />
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        <div className="flex items-end justify-between gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-medium">Number of items</Label>
                            <Input
                              type="number"
                              min="1"
                              placeholder="e.g., 12"
                              value={itemCountByPageId[page.id] ?? ""}
                              onChange={(e) => {
                                const next = e.target.value;
                                setItemCountByPageId((prev) => ({ ...prev, [page.id]: next }));

                                const raw = itemsDraftByPageId[page.id] ?? getItemsText(page.items);
                                const expected = getExpectedItemCount(page.id, next);
                                const items = parseItems(raw, expected);
                                updatePage(page.id, { items: items.length > 0 ? items : [""] });
                              }}
                              className="h-9 text-sm w-32"
                            />
                          </div>

                          <p className="text-[10px] text-muted-foreground">
                            {page.items.filter(Boolean).length} item(s) detected
                          </p>
                        </div>

                        <Label className="text-xs font-medium">Items (comma separated)</Label>
                        <Textarea
                          placeholder="Item 1, Item 2, Item 3, ..."
                          value={itemsDraftByPageId[page.id] ?? getItemsText(page.items)}
                          onChange={(e) => handleItemsChange(page.id, e.target.value)}
                          rows={3}
                          className="text-sm resize-none"
                        />
                      </div>

                      {/* Eco Stats */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-eco">Eco Stats</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Plastic %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="76"
                              value={page.plasticPercent}
                              onChange={(e) => updatePage(page.id, { plasticPercent: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Carbon %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              placeholder="60"
                              value={page.carbonPercent}
                              onChange={(e) => updatePage(page.id, { carbonPercent: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Price Info (if fetched) */}
                      {page.preTaxPrice !== undefined && page.preTaxPrice > 0 && (
                        <div className="p-2 bg-secondary/30 rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            Pre-tax Price: <span className="font-medium text-foreground">₹{page.preTaxPrice}</span>
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}