import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { InvoiceData } from '@/types/invoice';
import { toast } from '@/hooks/use-toast';
import { pdf } from '@react-pdf/renderer';
import { InvoicePdfTemplate } from './InvoicePdfTemplate';

interface InvoiceActionsProps {
  invoiceData: InvoiceData;
}

export function InvoiceActions({ invoiceData }: InvoiceActionsProps) {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Generate PDF using react-pdf (vector-based, crisp text)
      const blob = await pdf(<InvoicePdfTemplate data={invoiceData} />).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${invoiceData.invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated",
        description: `Invoice ${invoiceData.invoice.invoiceNumber} has been downloaded.`
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <Button onClick={generatePDF} disabled={generating}>
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <FileDown className="h-4 w-4 mr-2" />
        )}
        {generating ? 'Generating...' : 'Download PDF'}
      </Button>
    </div>
  );
}
