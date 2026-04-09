import { useState, useCallback } from 'react';
import { InvoiceData, RecentInvoice } from '@/types/invoice';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function useInvoice() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async (invoiceNumber: string | number) => {
    const invoiceStr = String(invoiceNumber ?? '').trim();
    if (!invoiceStr) {
      setError('Please enter an invoice number');
      return;
    }

    setLoading(true);
    setError(null);
    setInvoiceData(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/invoicedata?invoiceNumber=${encodeURIComponent(invoiceStr)}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Failed to fetch invoice');
        return;
      }

      setInvoiceData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentInvoices = useCallback(async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/invoice-list`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const result = await response.json();

      if (result.success) {
        setRecentInvoices(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent invoices:', err);
    }
  }, []);

  const fetchForPdf = useCallback(async (invoiceNumber: string): Promise<InvoiceData | null> => {
    try {
      const response = await fetch(`/api/invoice/pdf?invoiceNumber=${encodeURIComponent(invoiceNumber)}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch invoice for PDF');
      }

      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice for PDF');
      return null;
    }
  }, []);

  const clearInvoice = useCallback(() => {
    setInvoiceData(null);
    setError(null);
  }, []);

  const updateInvoiceData = useCallback((updater: (prev: InvoiceData) => InvoiceData) => {
    setInvoiceData(prev => prev ? updater(prev) : null);
  }, []);

  return {
    invoiceData,
    recentInvoices,
    loading,
    error,
    fetchInvoice,
    fetchRecentInvoices,
    fetchForPdf,
    clearInvoice,
    updateInvoiceData
  };
}
