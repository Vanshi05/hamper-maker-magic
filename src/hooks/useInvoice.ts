import { useState, useCallback } from "react";
import { InvoiceData, RecentInvoice } from "@/types/invoice";
import { AirtableService } from "@/lib/airtable";

export function useInvoice() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async (invoiceNumber: string | number) => {
    const invoiceStr = String(invoiceNumber ?? "").trim();
    if (!invoiceStr) {
      setError("Please enter an invoice number");
      return;
    }

    setLoading(true);
    setError(null);
    setInvoiceData(null);

    try {
      const result = await AirtableService.fetchInvoiceData(invoiceStr);
      setInvoiceData(result as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch invoice");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentInvoices = useCallback(async () => {
    try {
      const result = await AirtableService.fetchRecentInvoices();
      setRecentInvoices(result);
    } catch (err) {
      console.error("Failed to fetch recent invoices:", err);
    }
  }, []);

  const fetchForPdf = useCallback(
    async (invoiceNumber: string): Promise<InvoiceData | null> => {
      try {
        const result = await AirtableService.fetchInvoiceData(invoiceNumber);
        return result as any;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch invoice for PDF",
        );
        return null;
      }
    },
    [],
  );

  const clearInvoice = useCallback(() => {
    setInvoiceData(null);
    setError(null);
  }, []);

  const updateInvoiceData = useCallback(
    (updater: (prev: InvoiceData) => InvoiceData) => {
      setInvoiceData((prev) => (prev ? updater(prev) : null));
    },
    [],
  );

  return {
    invoiceData,
    recentInvoices,
    loading,
    error,
    fetchInvoice,
    fetchRecentInvoices,
    fetchForPdf,
    clearInvoice,
    updateInvoiceData,
  };
}
