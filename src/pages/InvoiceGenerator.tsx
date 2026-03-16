import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InvoiceSearch } from '@/components/invoice/InvoiceSearch';
import { InvoicePreview } from '@/components/invoice/InvoicePreview';
import { InvoiceActions } from '@/components/invoice/InvoiceActions';
import { AddShippingDialog } from '@/components/invoice/AddShippingDialog';
import { useInvoice } from '@/hooks/useInvoice';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertCircle, Undo2, CheckCircle2, ArrowLeft, PenLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InvoiceData, InvoiceLineItem } from '@/types/invoice';
import { Badge } from '@/components/ui/badge';

export default function InvoiceGenerator() {
  const [searchParams] = useSearchParams();
  const {
    invoiceData,
    recentInvoices,
    loading,
    error,
    fetchInvoice,
    fetchRecentInvoices,
    updateInvoiceData
  } = useInvoice();

  // Undo history
  const [history, setHistory] = useState<InvoiceData[]>([]);
  const [draftDirty, setDraftDirty] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchRecentInvoices();
    const invoiceNumber = searchParams.get('number');
    if (invoiceNumber) {
      fetchInvoice(invoiceNumber);
    }
  }, [searchParams, fetchRecentInvoices, fetchInvoice]);

  // Reset state when new invoice loads
  useEffect(() => {
    if (invoiceData) {
      setHistory([]);
      setDraftDirty(false);
      setShowReview(false);
    }
  }, [invoiceData?.invoice?.invoiceNumber]);

  const handleUpdate = useCallback((newData: InvoiceData) => {
    // Push current state to history before update
    updateInvoiceData((prev) => {
      setHistory(h => [...h.slice(-19), prev]); // keep last 20
      return newData;
    });
    setDraftDirty(true);
    // Reset draft indicator after 2s
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => setDraftDirty(false), 2000);
  }, [updateInvoiceData]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    updateInvoiceData(() => prev);
  }, [history, updateInvoiceData]);

  const handleAddShipping = (shippingItem: InvoiceLineItem) => {
    if (!invoiceData) return;
    handleUpdate({
      ...invoiceData,
      items: [...invoiceData.items, shippingItem],
      totals: (() => {
        const newItems = [...invoiceData.items, shippingItem];
        let taxableAmount = 0;
        let taxAmount = 0;
        newItems.forEach(item => {
          const itemTotal = (item.pre_tax_price || 0) * (item.qty_sold || 1);
          taxableAmount += itemTotal;
          taxAmount += (itemTotal * (item.gst || 0)) / 100;
        });
        return {
          taxableAmount: Math.round(taxableAmount * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          grandTotal: Math.round((taxableAmount + taxAmount) * 100) / 100,
        };
      })(),
    });
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Invoice Generator</h1>
              <p className="text-muted-foreground">Search, edit, and download invoices</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Invoice</CardTitle>
            <CardDescription>Enter an invoice number or select from recent invoices</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceSearch onSearch={fetchInvoice} recentInvoices={recentInvoices} loading={loading} />
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <Card className="mb-8">
            <CardContent className="p-8">
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Editor or Review */}
        {invoiceData && !loading && !showReview && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold">Invoice Editor</h2>
                {draftDirty && (
                  <Badge variant="outline" className="text-xs animate-pulse gap-1">
                    <PenLine className="h-3 w-3" /> Editing...
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndo}
                  disabled={history.length === 0}
                >
                  <Undo2 className="h-4 w-4 mr-1" /> Undo
                </Button>
                <AddShippingDialog onAddShipping={handleAddShipping} />
                <Button onClick={() => setShowReview(true)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Review & Generate
                </Button>
              </div>
            </div>

            {/* Preview */}
            <div className="overflow-auto">
              <InvoicePreview data={invoiceData} onUpdate={handleUpdate} />
            </div>
          </div>
        )}

        {/* Pre-send Review Panel — full invoice preview */}
        {invoiceData && !loading && showReview && (
          <div className="space-y-4">
            {/* Review header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Review Before Generating PDF</h2>
                  <p className="text-sm text-muted-foreground">This is exactly what will be downloaded. Editing is disabled.</p>
                </div>
              </div>
            </div>

            {/* Full read-only invoice preview */}
            <div className="overflow-auto">
              <InvoicePreview data={invoiceData} onUpdate={() => {}} readOnly />
            </div>

            {/* Action bar */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setShowReview(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Edit
              </Button>
              <InvoiceActions invoiceData={invoiceData} />
            </div>
          </div>
        )}

        {/* Empty */}
        {!invoiceData && !loading && !error && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Invoice Selected</h3>
              <p className="text-muted-foreground max-w-sm">
                Enter an invoice number above or select from recent invoices to preview and download.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
