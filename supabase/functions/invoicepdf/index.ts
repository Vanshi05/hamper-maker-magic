import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const invoiceNumber = url.searchParams.get("invoiceNumber");

    if (!invoiceNumber) {
      return new Response(
        JSON.stringify({ success: false, error: "invoiceNumber is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseId = Deno.env.get("AIRTABLE_SALE_BASE_ID");
    const apiKey = Deno.env.get("AIRTABLE_SALE_TOKEN");

    if (!baseId || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Airtable Sale configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Sale record
    const saleTableName = encodeURIComponent("Sale");
    const saleFormula = encodeURIComponent(`{sales_invoice_number}="${invoiceNumber}"`);
    const saleUrl = `https://api.airtable.com/v0/${baseId}/${saleTableName}?filterByFormula=${saleFormula}&maxRecords=1`;

    const saleResponse = await fetch(saleUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!saleResponse.ok) {
      const errorText = await saleResponse.text();
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const saleData = await saleResponse.json();

    if (!saleData.records || saleData.records.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const saleRecord = saleData.records[0];
    const saleFields = saleRecord.fields;
    const saleRecordId = saleRecord.id;

    // Fetch Sale_LI (line items)
    const liTableName = encodeURIComponent("Sale_LI");
    const liFormula = encodeURIComponent(`FIND("${saleRecordId}", ARRAYJOIN({so}))`);
    const liUrl = `https://api.airtable.com/v0/${baseId}/${liTableName}?filterByFormula=${liFormula}`;

    const liResponse = await fetch(liUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!liResponse.ok) {
      const errorText = await liResponse.text();
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const liData = await liResponse.json();
    const lineItems = (liData.records || []).map((record: any) => ({
      id: record.id,
      gift_hamper_name: record.fields.gift_hamper_name || record.fields["Gift Hamper Name"] || "",
      mrp: record.fields.mrp || record.fields["MRP (Selling Price)"] || 0,
      pre_tax_price: record.fields.pre_tax_price || record.fields["Pre GST Price"] || 0,
      qty_sold: record.fields.qty_sold || record.fields["Qty"] || 1,
      gst: record.fields.gst || record.fields["GST"] || 0,
      gh_config: record.fields.gh_config || record.fields["Gift Hamper Config"] || "",
    }));

    // Calculate totals
    let taxableAmount = 0;
    let taxAmount = 0;

    lineItems.forEach((item: any) => {
      const itemTotal = (item.pre_tax_price || 0) * (item.qty_sold || 1);
      taxableAmount += itemTotal;
      taxAmount += (itemTotal * (item.gst || 0)) / 100;
    });

    const grandTotal = taxableAmount + taxAmount;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          invoice: {
            invoiceNumber: saleFields.sales_invoice_number || saleFields["Invoice Number"] || invoiceNumber,
            invoiceDate: saleFields["Invoice Date"] || saleFields.invoice_date || "",
            billingAddress: saleFields["Billing Address"] || saleFields.billing_address || "",
            gst: saleFields["GST"] || saleFields.gst || "",
            contactPerson: saleFields["SPOC Details"] || saleFields.spoc_details || "",
          },
          items: lineItems,
          totals: {
            taxableAmount: Math.round(taxableAmount * 100) / 100,
            taxAmount: Math.round(taxAmount * 100) / 100,
            grandTotal: Math.round(grandTotal * 100) / 100,
          },
          seller: {
            name: "Your Company Name",
            address: "Your Company Address",
            gst: "Your GST Number",
            phone: "Your Phone",
            email: "your@email.com",
          },
          bankDetails: {
            bankName: "Bank Name",
            accountNumber: "Account Number",
            ifsc: "IFSC Code",
            branch: "Branch Name",
          },
          terms: [
            "Payment is due within 30 days",
            "Please include invoice number in payment reference",
            "Goods once sold will not be taken back",
          ],
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
