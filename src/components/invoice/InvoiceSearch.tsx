import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Loader2 } from 'lucide-react';
import { RecentInvoice } from '@/types/invoice';

interface InvoiceSearchProps {
  onSearch: (invoiceNumber: string) => void;
  recentInvoices: RecentInvoice[];
  loading: boolean;
}

export function InvoiceSearch({ onSearch, recentInvoices, loading }: InvoiceSearchProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invoiceNumber.trim()) {
      onSearch(invoiceNumber.trim());
    }
  };

  const handleSelectRecent = (value: string) => {
    setInvoiceNumber(value);
    onSearch(value);
  };



  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="text"
          placeholder="Enter Invoice Number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          className="flex-1"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !invoiceNumber.trim()}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          <span className="ml-2">Fetch Invoice</span>
        </Button>
      </form>

      {recentInvoices.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Or select recent:</span>
          <Select onValueChange={handleSelectRecent}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select recent invoice" />
            </SelectTrigger>
            <SelectContent>
              {recentInvoices.map((inv) => (
                <SelectItem key={inv.srNo} value={inv.srNo}>
                  {inv.srNo} - {inv.invoiceDate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
