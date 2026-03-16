import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Truck } from 'lucide-react';
import { InvoiceLineItem } from '@/types/invoice';

interface AddShippingDialogProps {
  onAddShipping: (item: InvoiceLineItem) => void;
  defaultGst?: number;
}

export function AddShippingDialog({ onAddShipping, defaultGst = 18 }: AddShippingDialogProps) {
  const [open, setOpen] = useState(false);
  const [preGstPrice, setPreGstPrice] = useState('');
  const [gst, setGst] = useState(defaultGst.toString());
  const [quantity, setQuantity] = useState('1');

  const handleSubmit = () => {
    const preGstAmount = parseFloat(preGstPrice) || 0;
    const gstPercent = parseFloat(gst) || 0;
    const qty = parseInt(quantity) || 1;

    const shippingItem: InvoiceLineItem = {
      id: `shipping-${Date.now()}`,
      gift_hamper_name: 'Shipping & Handling',
      mrp: preGstAmount * (1 + gstPercent / 100),
      pre_tax_price: preGstAmount,
      qty_sold: qty,
      gst: gstPercent,
      gh_config: ''
    };

    onAddShipping(shippingItem);
    setOpen(false);
    setPreGstPrice('');
    setGst(defaultGst.toString());
    setQuantity('1');
  };

  const calculatedMrp = (parseFloat(preGstPrice) || 0) * (1 + (parseFloat(gst) || 0) / 100);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Truck className="h-4 w-4 mr-2" />
          Add Shipping Cost
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Shipping Cost</DialogTitle>
          <DialogDescription>
            Enter the shipping details. MRP will be calculated automatically based on GST.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="preGstPrice" className="text-right">
              Pre GST Price
            </Label>
            <Input
              id="preGstPrice"
              type="number"
              value={preGstPrice}
              onChange={(e) => setPreGstPrice(e.target.value)}
              placeholder="Enter amount"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="gst" className="text-right">
              GST %
            </Label>
            <Input
              id="gst"
              type="number"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
              placeholder="18"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="col-span-3"
            />
          </div>
          {preGstPrice && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-muted-foreground">
                Calculated MRP
              </Label>
              <div className="col-span-3 font-medium">
                ₹ {calculatedMrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit} disabled={!preGstPrice}>
            Add Shipping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
