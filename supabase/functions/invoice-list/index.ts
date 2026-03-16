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
    const baseId = Deno.env.get("AIRTABLE_SALE_BASE_ID");
    const apiKey = Deno.env.get("AIRTABLE_SALE_TOKEN");

    if (!baseId || !apiKey) {
      console.error("Missing AIRTABLE_SALE_BASE_ID or AIRTABLE_SALE_TOKEN");
      return new Response(
        JSON.stringify({ success: false, error: "Missing Airtable Sale configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tableName = encodeURIComponent("Sale");
    const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?maxRecords=20&sort%5B0%5D%5Bfield%5D=Invoice%20Date&sort%5B0%5D%5Bdirection%5D=desc`;

    console.log("Fetching recent invoices");

    const response = await fetch(airtableUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const invoices = (data.records || [])
      .map((record: any) => ({
        srNo: String(record.fields["Sr No"] ?? ""),
        invoiceNumber: String(record.fields.sales_invoice_number || record.fields["Invoice Number"] || ""),
        invoiceDate: record.fields["Invoice Date"] || record.fields.invoice_date || "",
        billingAddress: record.fields["Billing Address"] || record.fields.billing_address || "",
      }))
      .filter((inv: any) => inv.srNo !== "");

    return new Response(
      JSON.stringify({ success: true, data: invoices }),
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
